import { PropsWithChildren, ReactNode } from 'react';
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useColorScheme } from '@/components/useColorScheme';
import { MOTION } from '@/constants/motion';
import { elevation, palette, profileLight, radius, themeSurface, typography } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gradient';

type Props = PropsWithChildren<{
  variant?: ButtonVariant;
  label?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
  leftIcon?: ReactNode;
}>;

export default function Button({
  children,
  variant = 'primary',
  label,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  onPress,
  style,
  leftIcon,
}: Props) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  const content = label ? (
    <Text
      style={[
        typography.compact,
        styles.label,
        variant === 'primary' || variant === 'gradient'
          ? { color: palette.white }
          : { color: surface.textPrimary },
        variant === 'ghost' && { color: isDark ? palette.textOnCanvas : profileLight.body },
      ]}>
      {label}
    </Text>
  ) : (
    children
  );

  const handlePress = (event: GestureResponderEvent) => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onPress?.(event);
  };

  if (variant === 'gradient') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.base,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}>
        <LinearGradient
          colors={isDark ? ['#7c3aed', '#6d28d9', '#4c1d95'] : [profileLight.sky, profileLight.mint]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientFill}>
          {leftIcon}
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' ? styles.ghost : variant === 'secondary' ? styles.secondary : styles.primary,
        variant === 'secondary' && {
          backgroundColor: surface.groupedSurface,
          borderColor: surface.groupedBorder,
        },
        variant === 'ghost' && {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
          borderColor: isDark ? palette.chromeHairline : surface.hairline,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {leftIcon ? <View style={styles.iconSlot}>{leftIcon}</View> : null}
      {content}
    </Pressable>
  );
}

/** @deprecated Import `Button` from `@/components/ui` — alias kept for migration. */
export { Button as PrimaryButton };

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    width: '100%',
  },
  primary: {
    backgroundColor: palette.heroInk,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.signUpMintHairline,
    paddingVertical: 14,
    paddingHorizontal: 20,
    ...elevation.raised,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 20,
    ...elevation.rest,
  },
  ghost: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  label: {
    fontWeight: '700',
    textAlign: 'center',
  },
  iconSlot: {
    marginRight: 4,
  },
  pressed: {
    transform: [{ scale: MOTION.press.scale }],
  },
  disabled: {
    opacity: 0.55,
  },
});
