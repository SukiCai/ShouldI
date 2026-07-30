import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, profileNeutralStroke, radius, themeSurface, typography } from '@/constants/theme';

type Props = PropsWithChildren<{
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}>;

export default function Chip({ children, selected, onPress, accessibilityLabel }: Props) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  const accent = isDark ? palette.neonSky : palette.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.shell,
        {
          backgroundColor: surface.groupedSurface,
          borderColor: isDark ? 'rgba(255,255,255,0.16)' : profileNeutralStroke(0.16),
        },
        selected ? { backgroundColor: `${accent}20`, borderColor: accent } : undefined,
      ]}>
      <Text
        style={[typography.compact, selected ? { color: accent, fontWeight: '700', textAlign: 'center' } : { color: surface.textPrimary, textAlign: 'center' }]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
