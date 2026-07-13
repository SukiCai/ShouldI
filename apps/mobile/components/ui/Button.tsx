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
import { elevation, palette, profileLight, radius, semantic, themeSurface, typography } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gradient';
type ButtonIntent = 'default' | 'affirm' | 'danger';

type Props = PropsWithChildren<{
  variant?: ButtonVariant;
  intent?: ButtonIntent;
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
  intent = 'default',
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
  const resolvedPrimary =
    intent === 'affirm' ? semantic.actionAffirm : intent === 'danger' ? semantic.actionDanger : semantic.actionPrimary;

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
          colors={
            intent === 'danger'
              ? ['#c97a82', '#a85d64']
              : intent === 'affirm'
                ? ['#79bdaa', '#5fa995']
                : [semantic.actionPrimaryHover, semantic.actionPrimary]
          }
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
        variant === 'primary' && {
          backgroundColor: resolvedPrimary,
          borderColor: `${resolvedPrimary}66`,
        },
        variant === 'secondary' && {
          backgroundColor: surface.groupedSurface,
          borderColor: surface.groupedBorder,
        },
        variant === 'ghost' && {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.82)',
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
    borderWidth: StyleSheet.hairlineWidth,
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
