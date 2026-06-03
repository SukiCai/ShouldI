import { Stack } from 'expo-router';

import DecideWizardProvider from './context';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, profileLight, themeSurface } from '@/constants/theme';

export default function DecideNavigator() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';

  return (
    <DecideWizardProvider>
      <Stack
        screenOptions={{
          headerTintColor: isDark ? palette.neonMint : profileLight.sky,
          headerStyle: { backgroundColor: surface.canvas },
          headerShadowVisible: false,
          headerTitleStyle: { color: surface.textDisplay, fontWeight: '700', fontSize: 17 },
          contentStyle: { backgroundColor: surface.canvas },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="details" options={{ title: 'Manual details (legacy)' }} />
        <Stack.Screen name="confirm" options={{ headerShown: false, title: 'Review draft' }} />
        <Stack.Screen name="result" options={{ headerBackVisible: false, title: 'ShouldI briefing' }} />
      </Stack>
    </DecideWizardProvider>
  );
}
