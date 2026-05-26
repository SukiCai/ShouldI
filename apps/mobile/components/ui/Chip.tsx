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
        selected ? styles.shellSelected : undefined,
      ]}>
      <Text
        style={[typography.compact, selected ? styles.labelSelected : { color: surface.textPrimary, textAlign: 'center' }]}>
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
  shellSelected: {
    backgroundColor: palette.accent + '26',
    borderColor: palette.accent,
  },
  labelSelected: {
    color: palette.accent,
    fontWeight: '700',
    textAlign: 'center',
  },
});
