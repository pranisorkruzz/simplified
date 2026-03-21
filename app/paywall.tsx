import {
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Sparkles, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { UserType } from '@/types/database';

const PRIMARY_BRAND = '#0F4737';
const ACCENT_GOLD = '#D7B989';

type PlanId = 'free' | 'monthly' | 'yearly';

type PlanOption = {
  id: PlanId;
  period: string;
  label: string;
  price: string;
  badge?: string;
};

const BASE_PLANS: PlanOption[] = [
  { id: 'monthly', period: '1', label: 'MONTH', price: '$6.99' },
  {
    id: 'yearly',
    period: '12',
    label: 'MONTHS',
    price: '$59.99',
    badge: 'SAVE 28%',
  },
];

const NEW_USER_PLANS: PlanOption[] = [
  { id: 'free', period: 'FREE', label: 'MODEL', price: '$0' },
  ...BASE_PLANS,
];

export default function PaywallScreen() {
  const router = useRouter();
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{
    entry?: string | string[];
    userType?: string | string[];
  }>();

  const entryParam = Array.isArray(params.entry) ? params.entry[0] : params.entry;
  const rawUserType = Array.isArray(params.userType)
    ? params.userType[0]
    : params.userType;
  const userTypeParam: UserType | undefined =
    rawUserType === 'student' || rawUserType === 'professional'
      ? rawUserType
      : undefined;
  const isNewUserEntry = entryParam === 'new_user';

  const [selectedPlan, setSelectedPlan] = useState<PlanId>(
    isNewUserEntry ? 'free' : 'yearly'
  );
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [continuing, setContinuing] = useState(false);
  const reviewScrollRef = useRef<ScrollView>(null);
  const absoluteIndexRef = useRef(0);
  const lastRealIndexRef = useRef(0);
  const { width: windowWidth } = useWindowDimensions();
  const reviewPageWidth = Math.max(windowWidth - 40, 280);

  const reviews = [
    {
      title: 'Task whisperer in your pocket',
      text: 'Clarix takes vague work, turns it into a simple plan, and makes it obvious what to do next.',
      author: 'Aditi, Product Designer',
    },
    {
      title: 'Finally clear daily priorities',
      text: 'I paste messy requests and get focused, actionable tasks with deadlines I can actually follow.',
      author: 'Rohan, Startup Operator',
    },
    {
      title: 'The fastest way to unblock work',
      text: 'Clarix removes decision fatigue. I know the next task immediately instead of re-reading long messages.',
      author: 'Maya, Engineering Lead',
    },
  ];
  const loopRepeatCount = reviews.length > 1 ? 8 : 1;
  const middleBlockIndex = reviews.length > 1 ? Math.floor(loopRepeatCount / 2) : 0;
  const baseAbsoluteIndex = middleBlockIndex * reviews.length;
  const carouselItems =
    reviews.length > 1
      ? Array.from(
          { length: reviews.length * loopRepeatCount },
          (_, index) => reviews[index % reviews.length],
        )
      : reviews;

  const planOptions = isNewUserEntry ? NEW_USER_PLANS : BASE_PLANS;

  useEffect(() => {
    setSelectedPlan(isNewUserEntry ? 'free' : 'yearly');
  }, [isNewUserEntry]);

  useEffect(() => {
    if (reviews.length <= 1) {
      absoluteIndexRef.current = 0;
      return;
    }

    absoluteIndexRef.current = baseAbsoluteIndex;
    reviewScrollRef.current?.scrollTo({
      x: baseAbsoluteIndex * reviewPageWidth,
      animated: false,
    });
  }, [baseAbsoluteIndex, reviewPageWidth, reviews.length]);

  const showBillingPreview = () => {
    Alert.alert(
      'Billing not wired yet',
      'The paywall UI is ready, but checkout, restore purchases, terms, and privacy links still need real integrations.',
    );
  };

  const handleContinue = async () => {
    if (!isNewUserEntry) {
      showBillingPreview();
      return;
    }

    if (!user) {
      router.replace('/login');
      return;
    }

    setContinuing(true);

    try {
      if (!profile) {
        if (!userTypeParam) {
          Alert.alert(
            'Choose your focus first',
            'Please pick Student or Working Professional before continuing.',
            [
              {
                text: 'Go to onboarding',
                onPress: () => router.replace('/onboarding'),
              },
            ],
          );
          return;
        }

        await updateProfile({ user_type: userTypeParam });
      }

      if (selectedPlan === 'free') {
        router.replace('/(tabs)');
        return;
      }

      Alert.alert(
        'Billing not wired yet',
        'Checkout is not connected yet. We will continue with free access for now.',
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/(tabs)'),
          },
        ],
      );
    } catch (error) {
      console.error('Error finishing onboarding paywall:', error);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setContinuing(false);
    }
  };

  const handleReviewScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (reviews.length <= 1) {
      setActiveReviewIndex(0);
      return;
    }

    const absoluteIndex = Math.round(
      event.nativeEvent.contentOffset.x / reviewPageWidth,
    );
    const normalized =
      ((absoluteIndex % reviews.length) + reviews.length) % reviews.length;
    absoluteIndexRef.current = absoluteIndex;
    const realIndex = normalized;
    lastRealIndexRef.current = realIndex;
    setActiveReviewIndex(realIndex);

    // Recenter around the middle block to preserve infinite swiping in both directions.
    if (
      absoluteIndex <= reviews.length ||
      absoluteIndex >= carouselItems.length - reviews.length
    ) {
      const recenteredIndex = baseAbsoluteIndex + normalized;
      absoluteIndexRef.current = recenteredIndex;
      reviewScrollRef.current?.scrollTo({
        x: recenteredIndex * reviewPageWidth,
        animated: false,
      });
    }
  };

  const handleReviewScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (reviews.length <= 1) {
      return;
    }

    const absoluteIndex = Math.round(
      event.nativeEvent.contentOffset.x / reviewPageWidth,
    );
    const realIndex =
      ((absoluteIndex % reviews.length) + reviews.length) % reviews.length;

    if (lastRealIndexRef.current !== realIndex) {
      lastRealIndexRef.current = realIndex;
      setActiveReviewIndex(realIndex);
    }
  };

  const jumpToReview = (index: number) => {
    const absoluteIndex = reviews.length > 1 ? baseAbsoluteIndex + index : index;
    absoluteIndexRef.current = absoluteIndex;
    lastRealIndexRef.current = index;
    setActiveReviewIndex(index);
    reviewScrollRef.current?.scrollTo({
      x: absoluteIndex * reviewPageWidth,
      animated: true,
    });
  };

  if (authLoading && isNewUserEntry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_BRAND} />
        </View>
      </SafeAreaView>
    );
  }

  if (isNewUserEntry && profile) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          disabled={continuing}
        >
          <X size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.appIconContainer}>
          <Sparkles size={40} color={PRIMARY_BRAND} />
        </View>

        <View style={styles.titleWrapper}>
          <Text style={styles.title}>
            {isNewUserEntry ? 'Choose your plan' : 'Get Clarix Pro'}
          </Text>
        </View>

        <Text style={styles.subtitle}>
          {isNewUserEntry
            ? 'Start free today, or pick Pro to unlock premium insights when billing goes live.'
            : 'Get personalized insights to conquer your tasks 3x faster.'}
        </Text>

        <View style={styles.awardContainer}>
          <Text style={styles.laurel}>*</Text>
          <View style={styles.awardTextContainer}>
            <Text style={styles.awardTextSmall}>Subscription Preview</Text>
            <Text style={styles.awardTextBold}>
              {isNewUserEntry ? 'New User Access' : 'Clarix Pro'}
            </Text>
            <Text style={styles.awardTextSmall}>
              Billing integration still required
            </Text>
          </View>
          <Text style={styles.laurel}>*</Text>
        </View>

        <View style={styles.reviewCarousel}>
          <ScrollView
            ref={reviewScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleReviewScrollEnd}
            onScroll={handleReviewScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            bounces={false}
          >
            {carouselItems.map((review, index) => (
              <View
                key={`${review.author}-${index}`}
                style={[styles.testimonialCard, { width: reviewPageWidth }]}
              >
                <Text style={styles.testimonialTitle}>{review.title}</Text>
                <View style={styles.starsContainer}>
                  {'*****'.split('').map((star, starIndex) => (
                    <Text key={starIndex} style={styles.star}>
                      {star}
                    </Text>
                  ))}
                </View>
                <Text style={styles.testimonialText}>{review.text}</Text>
                <Text style={styles.testimonialAuthor}>{review.author}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.paginationContainer}>
          {reviews.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => jumpToReview(index)}
              style={[styles.dot, activeReviewIndex === index && styles.dotActive]}
              activeOpacity={0.8}
            />
          ))}
        </View>

        <View
          style={[
            styles.pricingContainer,
            isNewUserEntry ? styles.pricingContainerStacked : styles.pricingContainerRow,
          ]}
        >
          {planOptions.map((plan) => {
            const isSelected = selectedPlan === plan.id;

            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.pricingCard,
                  isNewUserEntry ? styles.pricingCardFull : styles.pricingCardHalf,
                  isSelected && styles.pricingCardActive,
                ]}
                activeOpacity={0.9}
                onPress={() => setSelectedPlan(plan.id)}
                disabled={continuing}
              >
                {isSelected ? (
                  <View style={styles.checkBadge}>
                    <Check size={14} color={PRIMARY_BRAND} strokeWidth={3} />
                  </View>
                ) : null}

                {plan.badge ? (
                  <View style={styles.saveBadge}>
                    <Text style={styles.saveBadgeText}>{plan.badge}</Text>
                  </View>
                ) : null}

                <Text style={[styles.pricingPeriod, isSelected && styles.textWhite]}>
                  {plan.period}
                </Text>
                <Text style={[styles.pricingLabel, isSelected && styles.textWhite]}>
                  {plan.label}
                </Text>
                <Text style={[styles.pricingPrice, isSelected && styles.textWhite]}>
                  {plan.price}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, continuing && styles.continueButtonDisabled]}
          activeOpacity={0.8}
          onPress={() => void handleContinue()}
          disabled={continuing}
        >
          {continuing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>
              {isNewUserEntry && selectedPlan === 'free' ? 'Start Free' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerSpacer: {
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4EFE6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  appIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#D1E6DF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#A8CCBF',
  },
  titleWrapper: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#EFEFEF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    paddingHorizontal: 10,
    marginBottom: 20,
    lineHeight: 22,
  },
  awardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  laurel: {
    fontSize: 28,
    color: '#999',
    opacity: 0.5,
  },
  awardTextContainer: {
    alignItems: 'center',
  },
  awardTextSmall: {
    fontSize: 12,
    color: '#999',
  },
  awardTextBold: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginVertical: 2,
  },
  testimonialCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: ACCENT_GOLD,
    marginBottom: 12,
  },
  reviewCarousel: {
    width: '100%',
  },
  testimonialTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102D24',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  star: {
    color: '#FFB800',
    fontSize: 16,
    marginRight: 2,
  },
  testimonialText: {
    fontSize: 14,
    color: '#102D24',
    lineHeight: 20,
    marginBottom: 12,
  },
  testimonialAuthor: {
    fontSize: 14,
    color: '#5A6A63',
    fontStyle: 'italic',
  },
  paginationContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D9D9D9',
  },
  dotActive: {
    width: 18,
    borderRadius: 999,
    backgroundColor: PRIMARY_BRAND,
  },
  pricingContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  pricingContainerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pricingContainerStacked: {
    flexDirection: 'column',
  },
  pricingCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    position: 'relative',
  },
  pricingCardHalf: {
    flex: 1,
  },
  pricingCardFull: {
    width: '100%',
  },
  pricingCardActive: {
    backgroundColor: PRIMARY_BRAND,
    borderColor: PRIMARY_BRAND,
    transform: [{ scale: 1.05 }],
    shadowColor: PRIMARY_BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1,
  },
  checkBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: PRIMARY_BRAND,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  saveBadge: {
    position: 'absolute',
    top: -12,
    backgroundColor: ACCENT_GOLD,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 2,
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#102D24',
  },
  pricingPeriod: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    marginBottom: 2,
  },
  pricingLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  pricingPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  textWhite: {
    color: '#fff',
  },
  continueButton: {
    width: '100%',
    backgroundColor: PRIMARY_BRAND,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: PRIMARY_BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
