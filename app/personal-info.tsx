import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Pencil,
  Check,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export default function PersonalInfoScreen() {
  const { user, profile, updateProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile && firstName === '' && lastName === '') {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
    if (user && email === '') {
      setEmail(user.email || '');
    }
  }, [profile, user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await updateProfile({
        first_name: firstName,
        last_name: lastName,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Your profile has been updated.');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()
    : 'OCT 2023';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#103B31" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Personal Information</Text>
          <Text style={styles.logoText}>Clarix</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarSection}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitial}>
                  {firstName?.charAt(0) || email?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <TouchableOpacity style={styles.editAvatarButton} activeOpacity={0.9}>
                <Pencil size={16} color="#F7F3EA" />
              </TouchableOpacity>
            </View>
            <Text style={styles.userName}>
              {firstName} {lastName}
            </Text>
            <Text style={styles.memberSince}>MEMBER SINCE {memberSince}</Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FIRST NAME</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First Name"
                placeholderTextColor="#99A69F"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>LAST NAME</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last Name"
                placeholderTextColor="#99A69F"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={styles.emailInputWrap}>
                <TextInput
                  style={[styles.input, styles.emailInput]}
                  value={email}
                  editable={false}
                  placeholder="Email Address"
                  placeholderTextColor="#99A69F"
                />
                <View style={styles.verifiedBadge}>
                  <ShieldCheck size={12} color="#1C6A57" />
                  <Text style={styles.verifiedText}>VERIFIED</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.securityItem} activeOpacity={0.7}>
              <View style={styles.securityTextWrap}>
                <Text style={styles.label}>SECURITY</Text>
                <Text style={styles.securityValue}>Change Password</Text>
              </View>
              <ChevronRight size={20} color="#103B31" />
            </TouchableOpacity>
          </View>

          <Text style={styles.privacyNote}>
            Your personal data is managed according to our{' '}
            <Text style={styles.privacyLink}>Privacy Standards</Text>.
          </Text>

          <TouchableOpacity
            style={styles.saveButtonWrap}
            onPress={handleSave}
            disabled={saving}
          >
            <LinearGradient
              colors={['#103B31', '#1C6A57']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButton}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#F7F3EA" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
                  <Check size={18} color="#F7F3EA" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: DISPLAY_FONT,
    color: '#103B31',
  },
  logoText: {
    fontSize: 22,
    fontFamily: DISPLAY_FONT,
    color: '#103B31',
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  avatarOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    padding: 4,
    backgroundColor: '#F7F3EA',
    borderWidth: 1,
    borderColor: 'rgba(16, 59, 49, 0.1)',
    position: 'relative',
    marginBottom: 16,
    shadowColor: '#103B31',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 56,
    backgroundColor: '#D7B989',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: '700',
    color: '#103B31',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#103B31',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F4EFE6',
  },
  userName: {
    fontSize: 32,
    fontFamily: DISPLAY_FONT,
    color: '#103B31',
    fontWeight: '700',
    marginBottom: 6,
  },
  memberSince: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A6A63',
    letterSpacing: 1.5,
  },
  formSection: {
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: {
    backgroundColor: '#FBF8F2',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#103B31',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5A6A63',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    fontSize: 20,
    fontFamily: DISPLAY_FONT,
    color: '#103B31',
    paddingVertical: 0,
  },
  emailInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emailInput: {
    flex: 1,
    opacity: 0.8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECF4F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1C6A57',
  },
  securityItem: {
    backgroundColor: '#FBF8F2',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#103B31',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  securityTextWrap: {
    flex: 1,
  },
  securityValue: {
    fontSize: 18,
    fontFamily: DISPLAY_FONT,
    color: '#103B31',
  },
  privacyNote: {
    fontSize: 13,
    color: '#5A6A63',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  privacyLink: {
    color: '#103B31',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  saveButtonWrap: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#103B31',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  saveButton: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveButtonText: {
    color: '#F7F3EA',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
