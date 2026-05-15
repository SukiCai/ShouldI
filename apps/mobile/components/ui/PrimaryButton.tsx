import { PropsWithChildren } from 'react';
import { GestureResponderEvent, Platform, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { palette, radius } from '@/constants/theme';

type Props = PropsWithChildren<{
  variant?: 'primary' | 'ghost';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
}>;

export default function PrimaryButton({
  children,
  variant = 'primary',
  accessibilityLabel,
  accessibilityHint,
  disabled,
  onPress,
  style,
}: Props) {
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isGhost ? styles.ghost : styles.primary,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#000000',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.signUpMintHairline,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.5,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 8,
      },
      default: {
        elevation: 6,
      },
    }),
  },
  ghost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
