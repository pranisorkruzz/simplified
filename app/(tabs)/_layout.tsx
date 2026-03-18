import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckSquare,
  MessageSquare,
  User,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { session, profile, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F4737" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F6D8AB',
        tabBarInactiveTintColor: '#9FB5AD',
        tabBarStyle: [
          styles.tabBar,
          {
            bottom: Math.max(insets.bottom, 10) + 8,
            height: 62 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Briefs',
          tabBarIcon: ({ size, color }) => (
            <MessageSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ size, color }) => (
            <CheckSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4EFE6',
  },
  tabBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderRadius: 24,
    borderTopWidth: 0,
    backgroundColor: '#102D24',
    paddingTop: 8,
    shadowColor: '#0D231C',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 18,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  tabItem: {
    borderRadius: 18,
  },
});
