import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { restoreSessionFromUrl } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export default function ResetPasswordScreen() {
  const confirmPasswordRef = useRef<TextInput>(null);
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const url = Linking.useURL();
  const handledUrlRef = useRef<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(Boolean(session));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (session) {
      setRecoveryReady(true);
    }
  }, [session]);

  useEffect(() => {
    let active = true;

    const prepareRecovery = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        const recoveryUrl = url || initialUrl;

        if (!active) {
          return;
        }

        if (!recoveryUrl) {
          setRecoveryReady(Boolean(session));
          setError(
            session
              ? ''
              : 'Open the password reset link from your email to set a new password.',
          );
          setInitializing(false);
          return;
        }

        if (handledUrlRef.current === recoveryUrl) {
          setInitializing(false);
          return;
        }

        handledUrlRef.current = recoveryUrl;
        const restored = await restoreSessionFromUrl(recoveryUrl);

        if (!active) {
          return;
        }

        if (!restored && !session) {
          setError('This password reset link is invalid or has expired.');
          setRecoveryReady(false);
        } else {
          setError('');
          setRecoveryReady(true);
        }
      } catch (recoveryError: any) {
        if (!active) {
          return;
        }

        setRecoveryReady(Boolean(session));
        setError(
          recoveryError?.message || 'Unable to validate the password reset link.',
        );
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    };

    void prepareRecovery();

    return () => {
      active = false;
    };
  }, [session, url]);

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      setError('Enter and confirm your new password');
      setSuccess('');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setSuccess('');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setSuccess('');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      setPassword('');
      setConfirmPassword('');
      setSuccess('Password updated. You can continue to Clarix now.');
    } catch (updateError: any) {
      setError(updateError?.message || 'Failed to update password');
    } finally {
      setSubmitting(false);
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false} disabled={Platform.OS === 'web'}>
          <View style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
            <LinearGradient
              colors={['#103B31', '#1C6A57', '#D7B989']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroIcon}>
                <ShieldCheck size={22} color="#103B31" />
              </View>
              <Text style={styles.eyebrow}>SECURE RECOVERY</Text>
              <Text style={styles.heroTitle}>Choose a new password</Text>
              <Text style={styles.heroSubtitle}>
                Finish recovery here and get back into your briefs, tasks, and
                profile without creating a new account.
              </Text>
            </LinearGradient>

            <View style={styles.formCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionPill}>
                  <KeyRound size={14} color="#103B31" />
                  <Text style={styles.sectionPillText}>Password Reset</Text>
                </View>
                <Text style={styles.sectionTitle}>Update Password</Text>
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={styles.noticeBanner}>
                  <Text style={styles.noticeText}>{success}</Text>
                </View>
              ) : null}

              {initializing ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color="#103B31" />
                  <Text style={styles.loadingText}>Validating reset link</Text>
                </View>
              ) : recoveryReady ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter a new password"
                      placeholderTextColor="#7B8A83"
                      secureTextEntry
                      autoComplete="password-new"
                      returnKeyType="next"
                      onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                      ref={confirmPasswordRef}
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm your new password"
                      placeholderTextColor="#7B8A83"
                      secureTextEntry
                      autoComplete="password-new"
                      returnKeyType="done"
                      onSubmitEditing={handleUpdatePassword}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.buttonWrap}
                    onPress={() => void handleUpdatePassword()}
                    disabled={submitting}
                  >
                    <LinearGradient
                      colors={['#0F4737', '#216B56']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.button}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color="#F7F3EA" />
                      ) : (
                        <>
                          <Text style={styles.buttonText}>Save New Password</Text>
                          <ArrowRight size={16} color="#F7F3EA" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : null}

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.replace('/login')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>
                  {success ? 'Back to sign in' : 'Return to sign in'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
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
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F3EA',
    alignItems: 'center',
    justifyContent: 'center',
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
  loadingWrap: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#5A6A63',
    fontSize: 14,
    fontWeight: '600',
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
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryButtonText: {
    color: '#0F4737',
    fontSize: 13,
    fontWeight: '800',
  },
});
