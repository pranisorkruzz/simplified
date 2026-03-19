import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  CheckSquare,
  MessageSquare,
  User,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import FloatingTabBar from '@/components/FloatingTabBar';

export default function TabLayout() {
  const { session, profile, loading } = useAuth();

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
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarActiveTintColor: '#F6D8AB',
        tabBarInactiveTintColor: '#9FB5AD',
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
});
