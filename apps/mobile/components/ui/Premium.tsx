import type { PropsWithChildren, ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, radius, spacing, typography } from '@/constants/theme';

export function GradientHero({
  title,
  subtitle,
  eyebrow,
  right,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
}) {
  return (
    <LinearGradient colors={['#e8efff', '#f4f7ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={typography.title}>{title}</Text>
        {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={{ marginLeft: spacing.sm }}>{right}</View> : null}
    </LinearGradient>
  );
}

export function GlassCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
    </View>
  );
}

export function PillTag({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: 'neutral' | 'brand' | 'good';
  style?: StyleProp<ViewStyle>;
}) {
  const toneStyle =
    tone === 'brand' ? styles.pillBrand : tone === 'good' ? styles.pillGood : styles.pillNeutral;
  return (
    <View style={[styles.pill, toneStyle, style]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export function GhostAction({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={styles.ghostBtn} onPress={onPress}>
      <Text style={styles.ghostBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d9e3fb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrow: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: palette.accent,
    fontWeight: '700',
    marginBottom: 2,
  },
  heroSub: {
    ...typography.compact,
    color: palette.slate500,
    marginTop: 4,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3eafa',
    padding: spacing.md,
    shadowColor: '#0b1324',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  sectionHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.h2,
    color: palette.slate950,
  },
  sectionRight: {
    ...typography.caption,
    color: palette.slate500,
  },
  pill: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pillNeutral: {
    backgroundColor: '#f6f8ff',
    borderColor: '#d8e1f7',
  },
  pillBrand: {
    backgroundColor: '#eaf0ff',
    borderColor: '#cdd9ff',
  },
  pillGood: {
    backgroundColor: '#e9f8f2',
    borderColor: '#c5eadc',
  },
  pillText: {
    ...typography.caption,
    color: palette.slate900,
    fontWeight: '600',
  },
  ghostBtn: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccd8f7',
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    ...typography.compact,
    color: palette.slate900,
    fontWeight: '700',
  },
});
