import {
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
import { useRouter } from 'expo-router';
import { Check, Sparkles, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY_BRAND = '#0F4737';
const ACCENT_GOLD = '#D7B989';

export default function PaywallScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>(
    'yearly'
  );
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
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
          (_, index) => reviews[index % reviews.length]
        )
      : reviews;

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
      'The paywall UI is ready, but checkout, restore purchases, terms, and privacy links still need real integrations.'
    );
  };

  const handleReviewScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (reviews.length <= 1) {
      setActiveReviewIndex(0);
      return;
    }

    const absoluteIndex = Math.round(
      event.nativeEvent.contentOffset.x / reviewPageWidth
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

  const handleReviewScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (reviews.length <= 1) {
      return;
    }

    const absoluteIndex = Math.round(
      event.nativeEvent.contentOffset.x / reviewPageWidth
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
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
          <Text style={styles.title}>Get Clarix Pro</Text>
        </View>

        <Text style={styles.subtitle}>
          Get personalized insights to conquer your tasks 3x faster.
        </Text>

        <View style={styles.awardContainer}>
          <Text style={styles.laurel}>*</Text>
          <View style={styles.awardTextContainer}>
            <Text style={styles.awardTextSmall}>Subscription Preview</Text>
            <Text style={styles.awardTextBold}>Clarix Pro</Text>
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
                  {'*****'.split('').map((star, index) => (
                    <Text key={index} style={styles.star}>
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
              style={[
                styles.dot,
                activeReviewIndex === index && styles.dotActive,
              ]}
              activeOpacity={0.8}
            />
          ))}
        </View>

        <View style={styles.pricingContainer}>
          <TouchableOpacity
            style={[
              styles.pricingCard,
              selectedPlan === 'monthly' && styles.pricingCardActive,
            ]}
            activeOpacity={0.9}
            onPress={() => setSelectedPlan('monthly')}
          >
            {selectedPlan === 'monthly' ? (
              <View style={styles.checkBadge}>
                <Check size={14} color={PRIMARY_BRAND} strokeWidth={3} />
              </View>
            ) : null}
            <Text
              style={[
                styles.pricingPeriod,
                selectedPlan === 'monthly' && styles.textWhite,
              ]}
            >
              1
            </Text>
            <Text
              style={[
                styles.pricingLabel,
                selectedPlan === 'monthly' && styles.textWhite,
              ]}
            >
              MONTH
            </Text>
            <Text
              style={[
                styles.pricingPrice,
                selectedPlan === 'monthly' && styles.textWhite,
              ]}
            >
              $6.99
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pricingCard,
              selectedPlan === 'yearly' && styles.pricingCardActive,
            ]}
            activeOpacity={0.9}
            onPress={() => setSelectedPlan('yearly')}
          >
            {selectedPlan === 'yearly' ? (
              <View style={styles.checkBadge}>
                <Check size={14} color={PRIMARY_BRAND} strokeWidth={3} />
              </View>
            ) : null}
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>SAVE 28%</Text>
            </View>
            <Text
              style={[
                styles.pricingPeriod,
                selectedPlan === 'yearly' && styles.textWhite,
              ]}
            >
              12
            </Text>
            <Text
              style={[
                styles.pricingLabel,
                selectedPlan === 'yearly' && styles.textWhite,
              ]}
            >
              MONTHS
            </Text>
            <Text
              style={[
                styles.pricingPrice,
                selectedPlan === 'yearly' && styles.textWhite,
              ]}
            >
              $59.99
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.continueButton}
          activeOpacity={0.8}
          onPress={showBillingPreview}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  pricingCard: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    position: 'relative',
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
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
