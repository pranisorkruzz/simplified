import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, Check, X } from 'lucide-react-native';

export default function PaywallScreen() {
  const router = useRouter();

  const handleUpgrade = () => {
    alert('Payment integration coming soon!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Crown size={64} color="#FFD700" />
        </View>

        <Text style={styles.title}>Upgrade to Pro</Text>
        <Text style={styles.subtitle}>
          Unlock the full potential of your AI assistant
        </Text>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <View style={styles.checkIcon}>
              <Check size={20} color="#34C759" strokeWidth={3} />
            </View>
            <Text style={styles.featureText}>
              Unlimited AI conversations with advanced models
            </Text>
          </View>

          <View style={styles.feature}>
            <View style={styles.checkIcon}>
              <Check size={20} color="#34C759" strokeWidth={3} />
            </View>
            <Text style={styles.featureText}>
              Priority file processing for PDFs and images
            </Text>
          </View>

          <View style={styles.feature}>
            <View style={styles.checkIcon}>
              <Check size={20} color="#34C759" strokeWidth={3} />
            </View>
            <Text style={styles.featureText}>
              Advanced task management with team collaboration
            </Text>
          </View>
        </View>

        <View style={styles.pricingCard}>
          <Text style={styles.pricingTitle}>Pro Plan</Text>
          <View style={styles.pricingRow}>
            <Text style={styles.price}>$9.99</Text>
            <Text style={styles.period}>/month</Text>
          </View>
          <Text style={styles.pricingSubtext}>
            Cancel anytime, no questions asked
          </Text>
        </View>

        <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
          <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          This is a placeholder screen. Payment integration will be added in
          production.
        </Text>
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
    justifyContent: 'flex-end',
    padding: 16,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8F8ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  pricingCard: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 48,
    fontWeight: '700',
    color: '#000',
  },
  period: {
    fontSize: 18,
    color: '#666',
    marginLeft: 4,
  },
  pricingSubtext: {
    fontSize: 14,
    color: '#666',
  },
  upgradeButton: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  upgradeButtonText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
