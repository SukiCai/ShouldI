import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, themeSurface, typography } from '@/constants/theme';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
};

export default function ListRow({
  icon,
  title,
  subtitle,
  children,
  onPress,
  showChevron,
  isLast,
}: Props) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: surface.hairline },
        onPress && pressed && { backgroundColor: surface.pressedOverlay },
      ]}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={palette.neonMint} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[typography.compact, { color: surface.textPrimary, fontWeight: '600' }]}>{title}</Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: surface.textMuted, marginTop: 3 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
      {showChevron ? <Ionicons name="chevron-forward" size={16} color={surface.textMuted} style={styles.chevron} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconWrap: {
    width: 28,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  chevron: {
    marginLeft: 4,
  },
});
