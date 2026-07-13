import { Stack } from 'expo-router';

import DecideWizardProvider from './context';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, themeSurface, typography } from '@/constants/theme';

export default function DecideNavigator() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);

  return (
    <DecideWizardProvider>
      <Stack
        screenOptions={{
          headerTintColor: palette.accent,
          headerStyle: { backgroundColor: surface.canvas },
          headerShadowVisible: false,
          headerTitleStyle: { color: surface.textDisplay, ...typography.titleSm },
          contentStyle: { backgroundColor: surface.canvas },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="details" options={{ title: 'Manual details (legacy)' }} />
        <Stack.Screen
          name="confirm"
          options={{
            headerShown: true,
            title: 'Ask the community',
            headerBackTitle: '',
            headerTintColor: surface.textPrimary,
            headerTitleStyle: { color: surface.textDisplay, ...typography.titleSm, fontWeight: '700' },
          }}
        />
        <Stack.Screen name="result" options={{ headerBackVisible: false, title: 'Recommendation' }} />
      </Stack>
    </DecideWizardProvider>
  );
}
