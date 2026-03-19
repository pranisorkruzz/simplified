import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { X, Check, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaywallScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{flex: 1}} />
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <X size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.appIconContainer}>
          <Sparkles size={40} color="#0F4737" />
        </View>

        <View style={styles.titleWrapper}>
          <Text style={styles.title}>Get Clarix Pro</Text>
        </View>

        <Text style={styles.subtitle}>
          Get personalized insights to conquer your tasks 3x faster.
        </Text>

        <View style={styles.awardContainer}>
          <Text style={styles.laurel}>🌿</Text>
          <View style={styles.awardTextContainer}>
            <Text style={styles.awardTextSmall}>The Download</Text>
            <Text style={styles.awardTextBold}>Productivity App</Text>
            <Text style={styles.awardTextSmall}>of the Year 2025</Text>
          </View>
          <Text style={styles.laurel}>🌿</Text>
        </View>

        <View style={styles.testimonialCard}>
          <Text style={styles.testimonialTitle}>Task whisperer in your pocket</Text>
          <View style={styles.starsContainer}>
            {'★★★★★'.split('').map((star, i) => (
              <Text key={i} style={styles.star}>{star}</Text>
            ))}
          </View>
          <Text style={styles.testimonialText}>
            Never understood how to manage my chaotic life until Clarix automatically broke everything down into simple steps. Now I'm shipping daily!
          </Text>
          <Text style={styles.testimonialAuthor}>MakerSarah</Text>
        </View>

        <View style={styles.paginationContainer}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <View style={styles.pricingContainer}>
          <TouchableOpacity
            style={[styles.pricingCard, selectedPlan === 'monthly' && styles.pricingCardActive]}
            activeOpacity={0.9}
            onPress={() => setSelectedPlan('monthly')}
          >
            {selectedPlan === 'monthly' && (
              <View style={styles.checkBadge}>
                <Check size={14} color={PRIMARY_BRAND} strokeWidth={3} />
              </View>
            )}
            <Text style={[styles.pricingPeriod, selectedPlan === 'monthly' && styles.textWhite]}>1</Text>
            <Text style={[styles.pricingLabel, selectedPlan === 'monthly' && styles.textWhite]}>MONTH</Text>
            <Text style={[styles.pricingPrice, selectedPlan === 'monthly' && styles.textWhite]}>$6.99</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pricingCard, selectedPlan === 'yearly' && styles.pricingCardActive]}
            activeOpacity={0.9}
            onPress={() => setSelectedPlan('yearly')}
          >
            {selectedPlan === 'yearly' && (
              <View style={styles.checkBadge}>
                <Check size={14} color={PRIMARY_BRAND} strokeWidth={3} />
              </View>
            )}
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>SAVE 28%</Text>
            </View>
            <Text style={[styles.pricingPeriod, selectedPlan === 'yearly' && styles.textWhite]}>12</Text>
            <Text style={[styles.pricingLabel, selectedPlan === 'yearly' && styles.textWhite]}>MONTHS</Text>
            <Text style={[styles.pricingPrice, selectedPlan === 'yearly' && styles.textWhite]}>$59.99</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.continueButton} 
          activeOpacity={0.8}
          onPress={() => alert(`Payment integration for ${selectedPlan} coming soon!`)}
        >
          <Text style={styles.continueButtonText}>
            Continue with {selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'}
          </Text>
        </TouchableOpacity>

        <View style={styles.footerLinks}>
          <TouchableOpacity><Text style={styles.footerLinkText}>Restore Purchases</Text></TouchableOpacity>
          <TouchableOpacity><Text style={styles.footerLinkText}>Terms</Text></TouchableOpacity>
          <TouchableOpacity><Text style={styles.footerLinkText}>Privacy</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const PRIMARY_BRAND = '#0F4737';
const ACCENT_GOLD = '#D7B989';

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
    width: '100%',
    backgroundColor: '#FBF8F2',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: ACCENT_GOLD,
    marginBottom: 24,
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
    backgroundColor: '#888',
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
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  footerLinkText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
});
