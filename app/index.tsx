import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.replace('/login');
      } else if (!profile) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [loading, session, profile]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
