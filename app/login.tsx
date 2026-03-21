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
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Sparkles } from 'lucide-react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { getPasswordResetRedirectUrl } from '@/lib/auth';
import { getSupabaseErrorMessage, supabase } from '@/lib/supabase';
import { UserType } from '@/types/database';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { signIn, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    entry?: string | string[];
    userType?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const entryParam = Array.isArray(params.entry) ? params.entry[0] : params.entry;
  const rawUserType = Array.isArray(params.userType)
    ? params.userType[0]
    : params.userType;
  const userTypeParam: UserType | undefined =
    rawUserType === 'student' || rawUserType === 'professional'
      ? rawUserType
      : undefined;
  const isNewUserEntry = entryParam === 'new_user';

  if (!authLoading && session) {
    return <Redirect href="/" />;
  }

  const getResetRequestErrorMessage = async (error: unknown) => {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response | undefined;

      if (response) {
        try {
          const payload = (await response.json()) as { error?: string };

          if (payload?.error) {
            return payload.error;
          }
        } catch {
          // Ignore parse errors and fall through to the generic formatter.
        }
      }
    }

    return getSupabaseErrorMessage(error, 'Failed to send reset link');
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError('Please fill in all fields');
      setNotice('');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      await signIn(trimmedEmail, password);
      if (!isNewUserEntry) {
        router.replace('/');
        return;
      }

      const {
        data: { user: authedUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authedUser) {
        router.replace('/');
        return;
      }

      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authedUser.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (existingProfile) {
        router.replace('/');
        return;
      }

      router.replace({
        pathname: '/paywall',
        params: {
          entry: 'new_user',
          ...(userTypeParam ? { userType: userTypeParam } : {}),
        },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Enter your email first to receive a reset link');
      setNotice('');
      return;
    }

    setResetLoading(true);
    setError('');
    setNotice('');

    try {
      const { error: resetError } = await supabase.functions.invoke(
        'request-password-reset',
        {
          body: {
            email: trimmedEmail,
            redirectTo: getPasswordResetRedirectUrl(),
          },
        },
      );

      if (resetError) {
        throw resetError;
      }

      setNotice(
        'Password reset link sent. Check your email and open the link on this device.',
      );
    } catch (err: unknown) {
      setError(await getResetRequestErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.keyboardView,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === 'android' ? 14 : 0,
            ),
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
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.heroTitle}>Sign in to your workflow</Text>
          <Text style={styles.heroSubtitle}>
            Pick up your briefs, deadlines, and finished tasks exactly where you
            left them.
          </Text>
        </LinearGradient>

        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionPill}>
              <Sparkles size={14} color="#103B31" />
              <Text style={styles.sectionPillText}>Account Access</Text>
            </View>
            <Text style={styles.sectionTitle}>Login</Text>
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
            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity
                onPress={() => void handleForgotPassword()}
                activeOpacity={0.75}
                disabled={loading || resetLoading}
              >
                <Text style={styles.forgotLink}>
                  {resetLoading ? 'Sending...' : 'Forgot password?'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#7B8A83"
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={styles.buttonWrap}
            onPress={handleLogin}
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
                  <Text style={styles.buttonText}>Sign In</Text>
                  <ArrowRight size={16} color="#F7F3EA" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Do not have an account?</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/signup',
                  params: {
                    ...(isNewUserEntry ? { entry: 'new_user' } : {}),
                    ...(userTypeParam ? { userType: userTypeParam } : {}),
                  },
                })
              }
            >
              <Text style={styles.link}>Sign Up</Text>
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
  errorText: {
    color: '#8D2D20',
    fontSize: 13,
    lineHeight: 18,
  },
  noticeBanner: {
    backgroundColor: '#E4F2EB',
    borderRadius: 14,
    padding: 12,
  },
  noticeText: {
    color: '#155240',
    fontSize: 13,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: '#163D32',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  forgotLink: {
    color: '#0F4737',
    fontSize: 13,
    fontWeight: '800',
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
