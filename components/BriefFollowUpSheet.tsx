import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) {
      return;
    }

    setAnswers(buildInitialState(questions, initialContext));
    setSheetError('');
  }, [initialContext, questions, visible]);

  const headerName = firstName?.trim() || 'you';

  const isComplete = useMemo(
    () =>
      questions.every((question) => {
        const answer = answers[question.id];

        if (!answer?.answerSource) {
          return false;
        }

        if (answer.answerSource === 'other') {
          return Boolean(answer.otherText.trim());
        }

        return Boolean(answer.answer.trim());
      }),
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

  const handleSave = async () => {
    if (!isComplete) {
      setSheetError(
        `Answer all ${questions.length} questions before saving this context.`,
      );
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>PERSONALIZE CLARIX</Text>
                <Text style={styles.title}>A few follow-up questions</Text>
                <Text style={styles.copy}>
                  Answer these so Clarix can tailor future breakdowns around {headerName}.
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {questions.map((question, index) => {
                const answer = answers[question.id];
                const otherSelected = answer?.answerSource === 'other';

                return (
                  <View key={question.id} style={styles.questionBlock}>
                    <Text style={styles.questionEyebrow}>{`QUESTION ${index + 1}`}</Text>
                    <Text style={styles.questionText}>{question.question}</Text>

                    <View style={styles.optionWrap}>
                      {question.options.map((option) => {
                        const selected =
                          answer?.answerSource === 'option' && answer.answer === option;

                        return (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.optionChip,
                              selected && styles.optionChipSelected,
                            ]}
                            onPress={() => selectOption(question.id, option)}
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
                        onPress={() => selectOther(question.id)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            otherSelected && styles.optionChipTextSelected,
                          ]}
                        >
                          {question.otherLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {otherSelected ? (
                      <TextInput
                        style={styles.otherInput}
                        value={answer.otherText}
                        onChangeText={(text) => updateOtherText(question.id, text)}
                        placeholder="Write your own answer"
                        placeholderTextColor="#7B8A83"
                      />
                    ) : null}
                  </View>
                );
              })}

              {sheetError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{sheetError}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!isComplete || saving) && styles.primaryButtonDisabled,
                ]}
                onPress={() => void handleSave()}
                activeOpacity={0.85}
                disabled={!isComplete || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#F7F3EA" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Context</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
    // paddingBottom handled via inline styles
    height: '80%',
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
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    marginTop: 18,
    flex: 1,
  },
  scrollContent: {
    gap: 18,
    paddingBottom: 8,
  },
  questionBlock: {
    gap: 10,
  },
  questionEyebrow: {
    color: '#799188',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  questionText: {
    color: '#102D24',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#E8E1D6',
    alignItems: 'center',
    justifyContent: 'center',
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