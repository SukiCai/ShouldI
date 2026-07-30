import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { selection } from '@/lib/haptics';
import { palette, profileTypography, radius, semantic, typography } from '@/constants/theme';

export type AuthSocialProvider = 'apple' | 'google';

type Mode = 'sign-up' | 'sign-in';

/** Official Google "G" mark (4-color) — Google branding guidelines require full color. */
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden>
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

function AppleMark({ size = 20 }: { size?: number }) {
  return <Ionicons name="logo-apple" size={size} color={palette.heroInk} />;
}

function SocialChip({
  provider,
  accessibilityLabel,
  displayTitle,
  busy,
  disabled,
  onPress,
}: {
  provider: AuthSocialProvider;
  accessibilityLabel: string;
  displayTitle: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        pressed && !disabled && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={semantic.actionPrimary} />
      ) : provider === 'apple' ? (
        <AppleMark />
      ) : (
        <GoogleMark />
      )}
      <Text style={styles.chipBrand} numberOfLines={1}>
        {displayTitle}
      </Text>
    </Pressable>
  );
}

type Props = {
  mode: Mode;
  /** Called when the user picks Apple / Google. Parent owns auth + navigation. */
  onProviderPress: (provider: AuthSocialProvider) => void | Promise<void>;
};

/**
 * Equal-prominence Apple + Google chips (App Store 4.8 / Google SIWG peers),
 * then quiet phone divider — standard 2025 mobile signup pattern.
 */
export function AuthSocialSignInRow({ mode, onProviderPress }: Props) {
  const verb = mode === 'sign-up' ? 'Continue' : 'Sign in';
  const [busyProvider, setBusyProvider] = React.useState<AuthSocialProvider | null>(null);

  async function handlePress(provider: AuthSocialProvider) {
    if (busyProvider) return;
    selection();
    setBusyProvider(provider);
    try {
      await onProviderPress(provider);
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <View style={styles.wrap} pointerEvents="auto">
      <View style={styles.row}>
        <SocialChip
          provider="apple"
          displayTitle="Apple"
          accessibilityLabel={`${verb} with Apple`}
          busy={busyProvider === 'apple'}
          disabled={busyProvider !== null && busyProvider !== 'apple'}
          onPress={() => void handlePress('apple')}
        />
        <SocialChip
          provider="google"
          displayTitle="Google"
          accessibilityLabel={`${verb} with Google`}
          busy={busyProvider === 'google'}
          disabled={busyProvider !== null && busyProvider !== 'google'}
          onPress={() => void handlePress('google')}
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

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
    alignSelf: 'stretch',
    pointerEvents: 'auto',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  chip: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.sheet,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth + 0.33,
    borderColor: 'rgba(13,13,17,0.12)',
  },
  chipPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  chipDisabled: {
    opacity: 0.55,
  },
  chipBrand: {
    ...typography.compact,
    fontWeight: '600',
    color: profileTypography.ink,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 2,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(107,117,130,0.2)',
  },
  dividerCap: {
    ...typography.caption,
    fontWeight: '500',
    color: profileTypography.subdued,
  },
});
