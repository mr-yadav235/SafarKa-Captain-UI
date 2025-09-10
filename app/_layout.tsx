import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { RideProvider } from '@/contexts/RideContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const router = useRouter();
  const { user, hydrate, loading } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    // Navigate based on auth state
    if (!loading && loaded) {
      const navigate = () => {
        if (user) {
          router.replace('/(tabs)');
        } else {
          router.replace('/auth/login');
        }
      };
      
      // Add a small delay to ensure navigation stack is ready
      setTimeout(navigate, 100);
    }
  }, [user, loading, loaded, router]);

  if (!loaded || loading) {
    // Async font loading only occurs in development.
    return null;
  }


  return (
    <RideProvider>
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </View>
    </RideProvider>
  );
}
