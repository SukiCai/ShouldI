import { Stack } from 'expo-router';

import DecideWizardProvider from './context';

import { palette } from '@/constants/theme';

export default function DecideNavigator() {
  return (
    <DecideWizardProvider>
      <Stack
        screenOptions={{
          headerTintColor: palette.neonMint,
          headerStyle: { backgroundColor: palette.mist },
          headerShadowVisible: false,
          headerTitleStyle: { color: palette.textOnCanvas, fontWeight: '700', fontSize: 17 },
          contentStyle: { backgroundColor: palette.mist },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="details" options={{ title: 'Manual details (legacy)' }} />
        <Stack.Screen name="confirm" options={{ title: 'Review draft' }} />
        <Stack.Screen name="result" options={{ headerBackVisible: false, title: 'ShouldI briefing' }} />
      </Stack>
    </DecideWizardProvider>
  );
}
