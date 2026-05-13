import { Stack } from 'expo-router';

import DecideWizardProvider from './context';

export default function DecideNavigator() {
  return (
    <DecideWizardProvider>
      <Stack
        screenOptions={{
          headerTintColor: '#0d1324',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#f4f6fb' },
        }}>
        <Stack.Screen name="index" options={{ title: 'AI intake' }} />
        <Stack.Screen name="details" options={{ title: 'Manual details (legacy)' }} />
        <Stack.Screen name="confirm" options={{ title: 'Review draft' }} />
        <Stack.Screen name="result" options={{ headerBackVisible: false, title: 'ShouldI briefing' }} />
      </Stack>
    </DecideWizardProvider>
  );
}
