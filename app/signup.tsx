import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Sparkles } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { signUp, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!authLoading && session) {
    return <Redirect href="/" />;
  }

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const result = await signUp(email, password);

      if (result.emailConfirmationRequired) {
        setNotice('Check your email to confirm your account, then sign in.');
        return;
      }

      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.keyboardView,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 14 : 0),
            paddingBottom: Math.max(insets.bottom, 14),
          },
        ]}
      >
        <LinearGradient
          colors={['#103B31', '#1C6A57', '#D7B989']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.eyebrow}>CREATE ACCOUNT</Text>
          <Text style={styles.heroTitle}>Start with a cleaner workflow</Text>
          <Text style={styles.heroSubtitle}>
            Create an account to turn email into trackable tasks, deadlines, and
            finished work.
          </Text>
        </LinearGradient>

        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionPill}>
              <Sparkles size={14} color="#103B31" />
              <Text style={styles.sectionPillText}>New Workspace</Text>
            </View>
            <Text style={styles.sectionTitle}>Sign Up</Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {notice ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#7B8A83"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor="#7B8A83"
              secureTextEntry
              autoComplete="password-new"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor="#7B8A83"
              secureTextEntry
              autoComplete="password-new"
            />
          </View>

          <TouchableOpacity
            style={styles.buttonWrap}
            onPress={handleSignup}
            disabled={loading}
          >
            <LinearGradient
              colors={['#0F4737', '#216B56']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#F7F3EA" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Create Account</Text>
                  <ArrowRight size={16} color="#F7F3EA" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE6',
  },
  keyboardView: {
    flex: 1,
    padding: 18,
    justifyContent: 'center',
    gap: 18,
  },
  heroCard: {
    borderRadius: 30,
    padding: Platform.select({ android: 22, default: 24 }),
    minHeight: Platform.select({ android: 208, default: 220 }),
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#F7F3EA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.2,
  },
  heroTitle: {
    color: '#F7F3EA',
    fontFamily: DISPLAY_FONT,
    fontSize: Platform.select({ android: 34, default: 38 }),
    lineHeight: Platform.select({ android: 39, default: 43 }),
    marginTop: 8,
  },
  heroSubtitle: {
    color: '#E5DDD1',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: '92%',
  },
  formCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 28,
    padding: Platform.select({ android: 20, default: 22 }),
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    gap: 16,
  },
  sectionHeader: {
    gap: 12,
  },
  sectionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6D8AB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionPillText: {
    color: '#103B31',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: 30,
  },
  errorBanner: {
    backgroundColor: '#FFE2DC',
    borderRadius: 14,
    padding: 12,
  },
  noticeBanner: {
    backgroundColor: '#E4F3E8',
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    color: '#8D2D20',
    fontSize: 13,
    lineHeight: 18,
  },
  noticeText: {
    color: '#24553A',
    fontSize: 13,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#163D32',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: '#F2ECE1',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: '#102D24',
    fontSize: 15,
  },
  buttonWrap: {
    marginTop: 4,
  },
  button: {
    minHeight: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#F7F3EA',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  footerText: {
    color: '#5A6A63',
    fontSize: 13,
  },
  link: {
    color: '#0F4737',
    fontSize: 13,
    fontWeight: '800',
  },
});
