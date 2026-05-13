import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { palette, radius, typography } from '@/constants/theme';

type Props = PropsWithChildren<{
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}>;

export default function Chip({ children, selected, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.shell, selected ? styles.shellSelected : undefined]}>
      <Text style={[typography.compact, selected ? styles.labelSelected : styles.label]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.slate500,
    backgroundColor: palette.white,
  },
  shellSelected: {
    backgroundColor: palette.accent + '26',
    borderColor: palette.accent,
  },
  label: {
    color: palette.slate950,
    textAlign: 'center',
  },
  labelSelected: {
    color: palette.accent,
    fontWeight: '700',
    textAlign: 'center',
  },
});
