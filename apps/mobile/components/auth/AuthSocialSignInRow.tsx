import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { palette, profileTypography, radius, typography } from '@/constants/theme';

type Mode = 'sign-up' | 'sign-in';

type Provider = 'apple' | 'google';

async function tapFeedback() {
  try {
    if (Platform.OS === 'ios')
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* noop */
  }
}

function placeholderAlert(provider: 'Apple' | 'Google') {
  Alert.alert(
    `${provider} sign-in`,
    `Hook this up with your auth backend (for example expo-apple-authentication, expo-auth-session + Google OAuth, Clerk, or Supabase).`,
    [{ text: 'OK' }],
  );
}

function SocialChip({
  provider,
  accessibilityLabel,
  displayTitle,
  onPress,
}: {
  provider: Provider;
  accessibilityLabel: string;
  displayTitle: string;
  onPress: () => void;
}) {
  const icon =
    provider === 'apple'
      ? ('logo-apple' as const)
      : ('logo-google' as const);
  const iconColor =
    provider === 'apple'
      ? palette.heroInk
      : Platform.OS === 'ios'
        ? '#1a73e8'
        : '#4285F4';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={styles.chipBrand} numberOfLines={1}>
        {displayTitle}
      </Text>
    </Pressable>
  );
}

export function AuthSocialSignInRow({ mode }: { mode: Mode }) {
  const verb = mode === 'sign-up' ? 'Continue' : 'Sign in';
  const showApple = Platform.OS === 'ios';

  return (
    <View style={styles.wrap} pointerEvents="auto">
      <View style={styles.row}>
        {showApple ? (
          <SocialChip
            provider="apple"
            displayTitle="Apple"
            accessibilityLabel={`${verb} with Apple`}
            onPress={() => {
              void tapFeedback();
              placeholderAlert('Apple');
            }}
          />
        ) : null}
        <SocialChip
          provider="google"
          displayTitle="Google"
          accessibilityLabel={`${verb} with Google`}
          onPress={() => {
            void tapFeedback();
            placeholderAlert('Google');
          }}
        />
      </View>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerCap}>or use phone</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

const chipShadow =
  Platform.select({
    ios: {
      shadowColor: palette.heroInk,
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
    },
    android: {
      elevation: 2,
    },
    default: {},
  }) ?? {};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 2,
    alignSelf: 'stretch',
    pointerEvents: 'auto',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  chip: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: palette.sheet,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth + 0.33,
    borderColor: 'rgba(13,13,17,0.11)',
    ...chipShadow,
  },
  chipPressed: {
    backgroundColor: 'rgba(247,247,249,1)',
    borderColor: 'rgba(13,13,17,0.16)',
    transform: [{ scale: 0.992 }],
  },
  chipBrand: {
    ...typography.compact,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: profileTypography.ink,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
    marginBottom: 0,
    paddingHorizontal: 2,
    opacity: 0.94,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(107,117,130,0.22)',
  },
  dividerCap: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: profileTypography.subdued,
    paddingHorizontal: 2,
  },
});
