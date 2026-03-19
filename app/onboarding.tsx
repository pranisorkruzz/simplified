import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Briefcase } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const [selected, setSelected] = useState<'student' | 'professional' | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (profile) {
    return <Redirect href="/(tabs)" />;
  }

  const handleContinue = async () => {
    if (!selected) return;

    setLoading(true);
    try {
      await updateProfile(selected);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Save failed', 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>Let us personalize your experience</Text>

        <Text style={styles.question}>
          Are you a Student or Working Professional?
        </Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.option,
              selected === 'student' && styles.optionSelected,
            ]}
            onPress={() => setSelected('student')}
          >
            <View style={styles.iconContainer}>
              <GraduationCap
                size={48}
                color={selected === 'student' ? '#fff' : '#007AFF'}
              />
            </View>
            <Text
              style={[
                styles.optionText,
                selected === 'student' && styles.optionTextSelected,
              ]}
            >
              Student
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.option,
              selected === 'professional' && styles.optionSelected,
            ]}
            onPress={() => setSelected('professional')}
          >
            <View style={styles.iconContainer}>
              <Briefcase
                size={48}
                color={selected === 'professional' ? '#fff' : '#007AFF'}
              />
            </View>
            <Text
              style={[
                styles.optionText,
                selected === 'professional' && styles.optionTextSelected,
              ]}
            >
              Working Professional
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !selected && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selected || loading}
        >
          <Text style={styles.continueButtonText}>
            {loading ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 48,
    textAlign: 'center',
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 32,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
    marginBottom: 48,
  },
  option: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  optionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  iconContainer: {
    marginBottom: 12,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  optionTextSelected: {
    color: '#fff',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
