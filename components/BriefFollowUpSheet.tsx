import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FollowUpQuestion,
  UserAiContext,
  UserAiContextResponse,
} from '@/lib/ai-context';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

type AnswerState = {
  answerSource: 'option' | 'other' | null;
  answer: string;
  otherText: string;
};

function buildInitialState(
  questions: FollowUpQuestion[],
  context: UserAiContext | null,
) {
  return questions.reduce<Record<string, AnswerState>>((acc, question) => {
    const existing = context?.responses.find(
      (response) => response.questionId === question.id,
    );
    const matchesOption = existing
      ? question.options.includes(existing.answer)
      : false;

    acc[question.id] = {
      answerSource: existing ? (matchesOption ? 'option' : 'other') : null,
      answer: existing?.answer ?? '',
      otherText: matchesOption ? '' : existing?.answer ?? '',
    };

    return acc;
  }, {});
}

function isAnswerComplete(answer: AnswerState | undefined) {
  if (!answer?.answerSource) {
    return false;
  }

  if (answer.answerSource === 'other') {
    return Boolean(answer.otherText.trim());
  }

  return Boolean(answer.answer.trim());
}

export default function BriefFollowUpSheet({
  visible,
  questions,
  initialContext,
  firstName,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  questions: FollowUpQuestion[];
  initialContext: UserAiContext | null;
  firstName?: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (responses: UserAiContextResponse[]) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [sheetError, setSheetError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) {
      return;
    }

    const initialAnswers = buildInitialState(questions, initialContext);
    const firstIncompleteIndex = questions.findIndex(
      (question) => !isAnswerComplete(initialAnswers[question.id]),
    );

    setAnswers(initialAnswers);
    setCurrentIndex(
      firstIncompleteIndex >= 0
        ? firstIncompleteIndex
        : Math.max(questions.length - 1, 0),
    );
    setSheetError('');
  }, [initialContext, questions, visible]);

  const headerName = firstName?.trim() || 'you';
  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const currentIsComplete = isAnswerComplete(currentAnswer);
  const totalQuestions = questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const answeredCount = useMemo(
    () =>
      questions.filter((question) => isAnswerComplete(answers[question.id])).length,
    [answers, questions],
  );

  const selectOption = (questionId: string, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        answerSource: 'option',
        answer: option,
        otherText: '',
      },
    }));
    setSheetError('');
  };

  const selectOther = (questionId: string) => {
    setAnswers((prev) => {
      const current = prev[questionId];

      return {
        ...prev,
        [questionId]: {
          answerSource: 'other',
          answer: current?.answerSource === 'other' ? current.otherText : '',
          otherText:
            current?.answerSource === 'other' ? current.otherText : '',
        },
      };
    });
    setSheetError('');
  };

  const updateOtherText = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        answerSource: 'other',
        answer: text,
        otherText: text,
      },
    }));
    setSheetError('');
  };

  const handlePrimaryPress = async () => {
    if (!currentQuestion) {
      return;
    }

    if (!currentIsComplete) {
      setSheetError('Please answer this question to continue.');
      return;
    }

    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1);
      setSheetError('');
      return;
    }

    if (answeredCount !== totalQuestions) {
      setSheetError(`Answer all ${totalQuestions} questions before continuing.`);
      return;
    }

    const responses = questions.map((question) => {
      const answer = answers[question.id];
      const finalAnswer =
        answer.answerSource === 'other'
          ? answer.otherText.trim()
          : answer.answer.trim();

      return {
        questionId: question.id,
        question: question.question,
        answer: finalAnswer,
        answerSource: answer.answerSource === 'other' ? 'other' : 'option',
      } satisfies UserAiContextResponse;
    });

    await onSave(responses);
  };

  if (!currentQuestion) {
    return null;
  }

  const otherSelected = currentAnswer?.answerSource === 'other';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View
                style={[
                  styles.sheet,
                  { paddingBottom: Math.max(insets.bottom, 24) },
                ]}
              >
                <View style={styles.header}>
                  <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>PERSONALIZE CLARIX</Text>
                    <Text style={styles.title}>5 follow-up questions</Text>
                    <Text style={styles.copy}>
                      Quick context from {headerName} helps Clarix generate a smarter workflow.
                    </Text>
                  </View>
                </View>

                <View style={styles.progressWrap}>
                  <Text style={styles.progressText}>{`Question ${currentIndex + 1} of ${totalQuestions}`}</Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${((currentIndex + 1) / Math.max(totalQuestions, 1)) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                <ScrollView
                  style={styles.scrollArea}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.questionBlock}>
                    <Text style={styles.questionEyebrow}>{`QUESTION ${currentIndex + 1}`}</Text>
                    <Text style={styles.questionText}>{currentQuestion.question}</Text>

                    <View style={styles.optionWrap}>
                      {currentQuestion.options.map((option) => {
                        const selected =
                          currentAnswer?.answerSource === 'option' &&
                          currentAnswer.answer === option;

                        return (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.optionChip,
                              selected && styles.optionChipSelected,
                            ]}
                            onPress={() => selectOption(currentQuestion.id, option)}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={[
                                styles.optionChipText,
                                selected && styles.optionChipTextSelected,
                              ]}
                            >
                              {option}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                      <TouchableOpacity
                        style={[
                          styles.optionChip,
                          otherSelected && styles.optionChipSelected,
                        ]}
                        onPress={() => selectOther(currentQuestion.id)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            otherSelected && styles.optionChipTextSelected,
                          ]}
                        >
                          {currentQuestion.otherLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {otherSelected ? (
                      <TextInput
                        style={styles.otherInput}
                        value={currentAnswer?.otherText ?? ''}
                        onChangeText={(text) => updateOtherText(currentQuestion.id, text)}
                        placeholder="Write your own answer"
                        placeholderTextColor="#7B8A83"
                        returnKeyType="done"
                        onSubmitEditing={handlePrimaryPress}
                      />
                    ) : null}
                  </View>

                  {sheetError ? (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>{sheetError}</Text>
                    </View>
                  ) : null}
                </ScrollView>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      currentIndex === 0 && styles.secondaryButtonDisabled,
                    ]}
                    onPress={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                    activeOpacity={0.85}
                    disabled={currentIndex === 0 || saving}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (!currentIsComplete || saving) && styles.primaryButtonDisabled,
                    ]}
                    onPress={() => void handlePrimaryPress()}
                    activeOpacity={0.85}
                    disabled={!currentIsComplete || saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#F7F3EA" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {isLastQuestion ? 'Generate Kanban' : 'Continue'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      default: {
        flex: 1,
      },
    }),
    backgroundColor: 'rgba(16, 45, 36, 0.34)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    alignSelf: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  sheet: {
    backgroundColor: '#FBF8F2',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    height: '76%',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: '#1B5A49',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: 30,
    lineHeight: 34,
  },
  copy: {
    color: '#5A6A63',
    fontSize: 14,
    lineHeight: 21,
  },
  progressWrap: {
    marginTop: 16,
    gap: 8,
  },
  progressText: {
    color: '#3F5A51',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#E7DED0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#1B5A49',
  },
  scrollArea: {
    marginTop: 16,
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 8,
  },
  questionBlock: {
    gap: 12,
  },
  questionEyebrow: {
    color: '#799188',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  questionText: {
    color: '#102D24',
    fontSize: 24,
    fontFamily: DISPLAY_FONT,
    lineHeight: 30,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D6CCBC',
    backgroundColor: '#F2ECE1',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipSelected: {
    borderColor: '#102D24',
    backgroundColor: '#102D24',
  },
  optionChipText: {
    color: '#29433A',
    fontSize: 13,
    fontWeight: '700',
  },
  optionChipTextSelected: {
    color: '#F7F3EA',
  },
  otherInput: {
    backgroundColor: '#F2ECE1',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#102D24',
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: '#FFE2DC',
    borderRadius: 16,
    padding: 12,
  },
  errorText: {
    color: '#8D2D20',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 0.7,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#E8E1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: '#163D32',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#102D24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#6E847C',
  },
  primaryButtonText: {
    color: '#F7F3EA',
    fontSize: 14,
    fontWeight: '700',
  },
});
