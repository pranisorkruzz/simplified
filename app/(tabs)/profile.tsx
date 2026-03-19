import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  Crown,
  LogOut,
  GraduationCap,
  Briefcase,
  ChevronRight,
  User,
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

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const isStudent = profile?.user_type === 'student';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === 'android' ? 14 : 6,
            paddingBottom: 112 + Math.max(insets.bottom, 12),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>

        <LinearGradient
          colors={['#103B31', '#1C6A57', '#D7B989']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.emailText} numberOfLines={1}>
                {user?.email || 'User Name'}
              </Text>
              <View style={styles.badgeWrap}>
                {isStudent ? (
                  <GraduationCap size={14} color="#103B31" />
                ) : (
                  <Briefcase size={14} color="#103B31" />
                )}
                <Text style={styles.badgeText}>
                  {isStudent ? 'Student' : 'Professional'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Subscription</Text>
        </View>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => router.push('/paywall')}
        >
          <View style={styles.cardRow}>
            <View style={[styles.iconBox, { backgroundColor: '#FDF7E8' }]}>
              <Crown size={22} color="#D7B989" />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>Clarix Pro</Text>
              <Text style={styles.cardSubtitle}>
                Unlock premium task insights
              </Text>
            </View>
            <ChevronRight size={20} color="#103B31" />
          </View>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
        </View>

        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.iconBox, { backgroundColor: '#E8EFEA' }]}>
              <User size={20} color="#1C6A57" />
            </View>
            <Text style={styles.menuText}>Personal Information</Text>
            <ChevronRight size={20} color="#99A69F" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <View style={[styles.iconBox, { backgroundColor: '#FFE2DC' }]}>
              <LogOut size={20} color="#D33F2E" />
            </View>
            <Text style={[styles.menuText, { color: '#D33F2E' }]}>
              Sign Out
            </Text>
            <ChevronRight size={20} color="#99A69F" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE6',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  header: {
    marginBottom: 20,
    marginTop: 10,
  },
  eyebrow: {
    color: '#1B5A49',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  pageTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: Platform.select({ android: 36, default: 40 }),
    lineHeight: Platform.select({ android: 44, default: 48 }),
  },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 32,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F7F3EA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(215, 185, 137, 0.5)',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#103B31',
  },
  userInfo: {
    flex: 1,
  },
  emailText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F7F3EA',
    marginBottom: 6,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F6D8AB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#103B31',
  },
  sectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5A6A63',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FBF8F2',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 32,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102D24',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#5A6A63',
  },
  menuGroup: {
    backgroundColor: '#FBF8F2',
    borderRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#102D24',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5DED4',
    marginLeft: 60,
  },
});
