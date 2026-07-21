import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import JumpUpSheet from '@/components/ui/JumpUpSheet';
import Button from '@/components/ui/Button';
import { dismissSaveProgressPrompt } from '@/lib/guestSignupPrompt';
import { typography, type themeSurface } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  surface: ReturnType<typeof themeSurface>;
  returnTo?: string;
};

/** Post-first-vote prompt — defer account creation until after meaningful action (PMF §15). */
export default function SaveProgressSheet({ visible, onClose, surface, returnTo = '/explore' }: Props) {
  const insets = useSafeAreaInsets();

  const handleDismiss = React.useCallback(() => {
    void dismissSaveProgressPrompt();
    onClose();
  }, [onClose]);

  const handleCreateAccount = React.useCallback(() => {
    onClose();
    router.push({
      pathname: '/sign-up',
      params: { returnTo },
    });
  }, [onClose, returnTo]);

  return (
    <JumpUpSheet
      visible={visible}
      onClose={handleDismiss}
      backgroundColor={surface.sheet}
      borderTopColor={surface.hairline}
      bottomInset={insets.bottom}
      maxHeight="52%"
      dismissAccessibilityLabel="Not now">
      <View style={styles.body}>
        <Text style={[styles.title, { color: surface.textDisplay }]}>Save your vote</Text>
        <Text style={[styles.bodyCopy, { color: surface.textMuted }]}>
          Create a free account to keep your prediction and unlock Outcome Replay.
        </Text>
        <Button
          label="Create account"
          accessibilityLabel="Create account"
          onPress={handleCreateAccount}
          style={styles.primary}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          onPress={handleDismiss}
          hitSlop={10}
          style={styles.secondaryPress}>
          <Text style={[styles.secondary, { color: surface.textMuted }]}>Not now</Text>
        </Pressable>
      </View>
    </JumpUpSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 22,
    paddingTop: 4,
    gap: 12,
    alignItems: 'stretch',
  },
  title: {
    ...typography.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyCopy: {
    ...typography.compact,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  primary: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  secondaryPress: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  secondary: {
    ...typography.compact,
    fontWeight: '600',
  },
});
