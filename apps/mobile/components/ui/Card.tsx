import { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { council, elevation, palette, radius, themeSurface } from '@/constants/theme';

type CardVariant = 'surface' | 'elevated' | 'council';

type Props = PropsWithChildren<{
  variant?: CardVariant;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}>;

export default function Card({ children, variant = 'surface', accentColor, style }: Props) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  const accent = accentColor ?? (variant === 'council' ? council.violet : palette.neonMint);

  return (
    <View
      style={[
        styles.shell,
        variant === 'elevated' && elevation.raised,
        variant === 'surface' && elevation.rest,
        {
          backgroundColor: surface.groupedSurface,
          borderColor: surface.groupedBorder,
        },
        variant === 'council' && {
          backgroundColor: isDark ? 'rgba(91,33,182,0.12)' : '#f5f3ff',
          borderColor: `${council.violet}44`,
        },
        style,
      ]}>
      {accentColor || variant === 'council' ? (
        <View style={[styles.accent, { backgroundColor: accent }]} />
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    minWidth: 0,
    padding: 14,
  },
});
