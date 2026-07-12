import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { resolveAppChromatics } from '@/constants/appChromatics';
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
  const chrom = resolveAppChromatics(isDark, surface);
  const accent = chrom.mint;

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
          borderColor: isDark ? palette.chromeHairline : profileNeutralStroke(0.18),
        },
        selected ? { backgroundColor: `${accent}26`, borderColor: accent } : undefined,
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
