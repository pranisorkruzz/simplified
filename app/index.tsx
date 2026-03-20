import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (!loading) {
    if (!session) {
      return <Redirect href="/onboarding" />;
    }

    if (!profile) {
      return (
        <Redirect
          href={{
            pathname: '/paywall',
            params: { entry: 'new_user' },
          }}
        />
      );
    }

    return <Redirect href="/(tabs)" />;
  }

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
