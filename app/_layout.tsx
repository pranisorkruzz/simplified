import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { KanbanProvider } from '@/contexts/KanbanContext';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <KanbanProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </KanbanProvider>
    </AuthProvider>
  );
}
