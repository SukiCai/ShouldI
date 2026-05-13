import { PropsWithChildren } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, ViewStyle } from 'react-native';

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
    backgroundColor: palette.accent,
    shadowColor: palette.accent,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccd9f7',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
