import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  GraduationCap,
  Heart,
  Lightbulb,
  Sparkles,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});
const WELCOME_IMAGE = require('../assets/images/onboarding-desk.jpg');

type UserType = 'student' | 'professional';
type GoalType = 'study' | 'work' | 'personal' | 'skills';

const GOALS: {
  id: GoalType;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'study',
    title: 'Study / Assignments',
    subtitle: 'Master your curriculum and deadlines.',
  },
  {
    id: 'work',
    title: 'Work Tasks',
    subtitle: 'Boost productivity and professional flow.',
  },
  {
    id: 'personal',
    title: 'Personal Goals',
    subtitle: 'Focus on habits, routines, and consistency.',
  },
  {
    id: 'skills',
    title: 'Learning New Skills',
    subtitle: 'Explore courses and expand your skillset.',
  },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [selectedUserType, setSelectedUserType] = useState<UserType | null>(
    null,
  );
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const stepLabel = useMemo(() => `Step ${step + 1} of 3`, [step]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0F4737" />
        </View>
      </SafeAreaView>
    );
  }

  if (user && profile) {
    return <Redirect href="/(tabs)" />;
  }

  const canContinue =
    step === 0 ||
    (step === 1 && !!selectedUserType) ||
    (step === 2 && !!selectedGoal);

  const handleContinue = () => {
    if (!canContinue || loading) {
      return;
    }

    if (step === 0) {
      setStep(1);
      return;
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    if (!selectedUserType) {
      return;
    }

    setLoading(true);

    if (user && !profile) {
      router.push({
        pathname: '/paywall',
        params: {
          entry: 'new_user',
          userType: selectedUserType,
          ...(selectedGoal ? { goal: selectedGoal } : {}),
        },
      });
      setLoading(false);
      return;
    }

    router.push({
      pathname: '/signup',
      params: {
        entry: 'new_user',
        userType: selectedUserType,
        ...(selectedGoal ? { goal: selectedGoal } : {}),
      },
    });
    setLoading(false);
  };

  const renderWelcomeStep = () => (
    <>
      <View style={styles.brandCard}>
        <Text style={styles.brandText}>Clarix</Text>
        <Text style={styles.brandCaption}>THE CURATOR OF LOGIC</Text>
      </View>

      <View style={styles.imageCard}>
        <Image
          source={WELCOME_IMAGE}
          style={styles.imageGradient}
          resizeMode="cover"
        />
      </View>

      <Text style={styles.welcomeTitle}>
        Turn any problem into a simple, clear, step-by-step plan.
      </Text>
      <Text style={styles.welcomeCopy}>
        Clarix helps you break big tasks into focused action so you always know
        what to do next.
      </Text>

      <View style={styles.primaryButtonWrap}>
        <TouchableOpacity
          style={styles.primaryButtonTouch}
          onPress={handleContinue}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#0F4737', '#216B56']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <ArrowRight size={17} color="#F7F3EA" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {!user ? (
        <View style={styles.authFooter}>
          <Text style={styles.authFooterText}>Existing user?</Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/login',
                params: {
                  entry: 'new_user',
                  ...(selectedUserType ? { userType: selectedUserType } : {}),
                  ...(selectedGoal ? { goal: selectedGoal } : {}),
                },
              })
            }
          >
            <Text style={styles.authFooterLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );

  const renderIdentityStep = () => (
    <>
      <Text style={styles.sectionEyebrow}>CLARIX</Text>
      <Text style={styles.sectionTitle}>Tell us about yourself</Text>
      <Text style={styles.sectionCopy}>
        We will personalize your breakdown style based on your daily context.
      </Text>

      <View style={styles.optionGroup}>
        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedUserType === 'student' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedUserType('student')}
          activeOpacity={0.9}
        >
          <View
            style={[
              styles.iconBubble,
              selectedUserType === 'student' && styles.iconBubbleSelected,
            ]}
          >
            <GraduationCap
              size={22}
              color={selectedUserType === 'student' ? '#F7F3EA' : '#0F4737'}
            />
          </View>
          <View style={styles.optionCopyWrap}>
            <Text style={styles.optionTitle}>Student</Text>
            <Text style={styles.optionSubtitle}>
              Optimized for exams, assignments, and deep-learning routines.
            </Text>
          </View>
          <View
            style={[
              styles.checkCircle,
              selectedUserType === 'student' && styles.checkCircleSelected,
            ]}
          >
            {selectedUserType === 'student' ? (
              <Check size={14} color="#F7F3EA" />
            ) : null}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedUserType === 'professional' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedUserType('professional')}
          activeOpacity={0.9}
        >
          <View
            style={[
              styles.iconBubble,
              selectedUserType === 'professional' && styles.iconBubbleSelected,
            ]}
          >
            <Briefcase
              size={22}
              color={
                selectedUserType === 'professional' ? '#F7F3EA' : '#0F4737'
              }
            />
          </View>
          <View style={styles.optionCopyWrap}>
            <Text style={styles.optionTitle}>Working Professional</Text>
            <Text style={styles.optionSubtitle}>
              Designed for project delivery, productivity, and focus.
            </Text>
          </View>
          <View
            style={[
              styles.checkCircle,
              selectedUserType === 'professional' && styles.checkCircleSelected,
            ]}
          >
            {selectedUserType === 'professional' ? (
              <Check size={14} color="#F7F3EA" />
            ) : null}
          </View>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderGoalIcon = (goal: GoalType, selected: boolean) => {
    const color = selected ? '#F7F3EA' : '#0F4737';

    if (goal === 'study') {
      return <BookOpen size={18} color={color} />;
    }

    if (goal === 'work') {
      return <Briefcase size={18} color={color} />;
    }

    if (goal === 'personal') {
      return <Heart size={18} color={color} />;
    }

    return <Lightbulb size={18} color={color} />;
  };

  const renderGoalStep = () => (
    <>
      <Text style={styles.sectionEyebrow}>CLARIX</Text>
      <Text style={styles.sectionTitle}>What are your goals?</Text>
      <Text style={styles.sectionCopy}>
        Choose what you want to focus on first. You can always adjust this
        later.
      </Text>

      <View style={styles.goalList}>
        {GOALS.map((goal) => {
          const isSelected = selectedGoal === goal.id;

          return (
            <TouchableOpacity
              key={goal.id}
              style={styles.goalCardWrap}
              onPress={() => setSelectedGoal(goal.id)}
              activeOpacity={0.9}
            >
              {isSelected ? (
                <LinearGradient
                  colors={['#0F4737', '#175B49']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.goalCard, styles.goalCardSelected]}
                >
                  <View
                    style={[styles.goalIconWrap, styles.goalIconWrapSelected]}
                  >
                    {renderGoalIcon(goal.id, true)}
                  </View>
                  <View style={styles.goalCopyWrap}>
                    <Text style={[styles.goalTitle, styles.goalTitleSelected]}>
                      {goal.title}
                    </Text>
                    <Text
                      style={[styles.goalSubtitle, styles.goalSubtitleSelected]}
                    >
                      {goal.subtitle}
                    </Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.goalCard}>
                  <View style={styles.goalIconWrap}>
                    {renderGoalIcon(goal.id, false)}
                  </View>
                  <View style={styles.goalCopyWrap}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={styles.goalSubtitle}>{goal.subtitle}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  const continueLabel =
    step === 0
      ? 'Get Started'
      : step === 1
        ? 'Continue'
        : user
          ? 'Continue to paywall'
          : 'Continue to sign up';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#F7F3EA', '#FBF8F2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.mainCard}
        >
          <View style={styles.topRow}>
            {step > 0 ? (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep((prev) => Math.max(prev - 1, 0))}
                activeOpacity={0.8}
              >
                <ArrowLeft size={18} color="#1B5A49" />
              </TouchableOpacity>
            ) : (
              <View style={styles.backSpacer} />
            )}

            <View style={styles.stepPill}>
              <Sparkles size={13} color="#103B31" />
              <Text style={styles.stepPillText}>{stepLabel}</Text>
            </View>
          </View>

          {step === 0 ? renderWelcomeStep() : null}
          {step === 1 ? renderIdentityStep() : null}
          {step === 2 ? renderGoalStep() : null}

          {step > 0 ? (
            <TouchableOpacity
              style={styles.primaryButtonTouch}
              onPress={handleContinue}
              disabled={!canContinue || loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={
                  !canContinue || loading
                    ? ['#8B9B94', '#8B9B94']
                    : ['#0F4737', '#216B56']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#F7F3EA" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>
                      {continueLabel}
                    </Text>
                    <ArrowRight size={17} color="#F7F3EA" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          <View style={styles.progressDots}>
            {[0, 1, 2].map((idx) => (
              <View
                key={idx}
                style={[
                  styles.progressDot,
                  step === idx && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE6',
  },
  content: {
    padding: 18,
    paddingBottom: 34,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCard: {
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    minHeight: Platform.select({ android: 690, default: 720 }),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EFEA',
  },
  backSpacer: {
    width: 32,
    height: 32,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6D8AB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepPillText: {
    color: '#103B31',
    fontSize: 11,
    fontWeight: '700',
  },
  brandCard: {
    alignItems: 'center',
    marginTop: 8,
  },
  brandText: {
    color: '#0F4737',
    fontFamily: DISPLAY_FONT,
    fontSize: 56,
    lineHeight: 64,
  },
  brandCaption: {
    color: '#799188',
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  imageCard: {
    borderRadius: 24,
    marginTop: 16,
    overflow: 'hidden',
  },
  imageGradient: {
    height: 175,
    width: '100%',
  },
  welcomeTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: 41,
    lineHeight: 45,
    marginTop: 18,
  },
  welcomeCopy: {
    color: '#5A6A63',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  sectionEyebrow: {
    color: '#1B5A49',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: 52,
    lineHeight: 54,
    textAlign: 'center',
    marginTop: 10,
  },
  sectionCopy: {
    color: '#6F8179',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },
  optionGroup: {
    marginTop: 20,
    gap: 12,
  },
  optionCard: {
    backgroundColor: '#F6F1E8',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E3DACB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionCardSelected: {
    backgroundColor: '#ECF4F0',
    borderColor: '#1B5A49',
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#DCE6DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleSelected: {
    backgroundColor: '#1B5A49',
  },
  optionCopyWrap: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    color: '#102D24',
    fontSize: 21,
    fontFamily: DISPLAY_FONT,
  },
  optionSubtitle: {
    color: '#5A6A63',
    fontSize: 13,
    lineHeight: 18,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C6D4CD',
    backgroundColor: '#FBF8F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: '#1B5A49',
    borderColor: '#1B5A49',
  },
  goalList: {
    marginTop: 18,
    gap: 10,
  },
  goalCardWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  goalCard: {
    backgroundColor: '#F7F1E6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8DED0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalCardSelected: {
    borderWidth: 0,
  },
  goalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCE6DF',
  },
  goalIconWrapSelected: {
    backgroundColor: '#2C7863',
  },
  goalCopyWrap: {
    flex: 1,
    gap: 2,
  },
  goalTitle: {
    color: '#102D24',
    fontSize: 16,
    fontWeight: '700',
  },
  goalTitleSelected: {
    color: '#F7F3EA',
  },
  goalSubtitle: {
    color: '#657970',
    fontSize: 12,
    lineHeight: 17,
  },
  goalSubtitleSelected: {
    color: '#D7E8E1',
  },
  primaryButtonWrap: {
    marginTop: 22,
  },
  primaryButtonTouch: {
    marginTop: 18,
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: '#F7F3EA',
    fontSize: 15,
    fontWeight: '700',
  },
  authFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  authFooterText: {
    color: '#5A6A63',
    fontSize: 13,
  },
  authFooterLink: {
    color: '#0F4737',
    fontSize: 13,
    fontWeight: '700',
  },
  progressDots: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#D4DCD7',
  },
  progressDotActive: {
    width: 20,
    backgroundColor: '#1B5A49',
  },
});
