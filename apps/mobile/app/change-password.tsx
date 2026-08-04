import { router } from 'expo-router';
import * as React from 'react';
import { Alert, Text, View } from 'react-native';

import { PrimaryButton, Screen, TextField } from '@/components/ui';
import { useColorScheme } from '@/components/useColorScheme';
import { changePassword } from '@/lib/auth';
import { spacing, themeSurface, typography } from '@/constants/theme';

const CHANGE_PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CURRENT_PASSWORD: 'Current password is incorrect.',
  WEAK_PASSWORD: 'New password must be at least 6 characters.',
  UNAUTHENTICATED: 'Sign in first, then try again.',
};

export default function ChangePasswordScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit() {
    if (submitting) return;
    if (!currentPassword.trim()) {
      Alert.alert('Current password', 'Enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('New password', 'Use at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords don’t match', 'Re-enter the new password to confirm.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Password updated', 'Your password has been changed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      Alert.alert('Couldn’t change password', CHANGE_PASSWORD_ERROR_MESSAGES[code] ?? 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg, paddingTop: spacing.md }}>
        <Text style={[typography.title, { color: surface.textDisplay }]}>Change password</Text>
        <TextField
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Current password"
        />
        <TextField
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="New password"
        />
        <TextField
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Confirm new password"
        />
        <PrimaryButton
          label={submitting ? 'Saving…' : 'Save new password'}
          accessibilityLabel="Save new password"
          disabled={submitting}
          onPress={() => void onSubmit()}
        />
      </View>
    </Screen>
  );
}
