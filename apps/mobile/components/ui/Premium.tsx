import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, radius, spacing, themeSurface, typography } from '@/constants/theme';
import { OledFluorSpeckles } from '@/components/ui/OledSignUpBackdrop';

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
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  return (
    <View style={[styles.hero, { backgroundColor: surface.canvas, borderColor: surface.heroBorder }]}>
      <View style={styles.heroSpeckles} pointerEvents="none">
        <OledFluorSpeckles />
      </View>
      <View style={{ flex: 1, zIndex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[typography.title, styles.heroHeadline, { color: surface.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.heroSub, { color: surface.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right ? (
        <View style={{ marginLeft: spacing.sm, zIndex: 1 }}>{right}</View>
      ) : null}
    </View>
  );
}

export function GlassCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  return (
    <View style={[styles.card, styles.cardShadow, { borderColor: surface.sheetBorder }, style]}>{children}</View>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: string }) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: surface.textPrimary }]}>{title}</Text>
      {right ? <Text style={[styles.sectionRight, { color: surface.textMuted }]}>{right}</Text> : null}
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
      <Text
        style={[
          styles.pillTextBase,
          tone === 'neutral' ? styles.pillTxtNeutral : tone === 'brand' ? styles.pillTxtBrand : styles.pillTxtGood,
        ]}>
        {label}
      </Text>
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
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.ghostBtn,
        {
          borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.12)',
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.04)',
        },
      ]}
      onPress={onPress}>
      <Text style={[styles.ghostBtnText, { color: surface.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.signUpMintHairline,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroSpeckles: {
    ...StyleSheet.absoluteFillObject,
  },
  eyebrow: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: palette.neonMint,
    fontWeight: '700',
    marginBottom: 2,
  },
  heroHeadline: {
    color: palette.textOnCanvas,
    letterSpacing: -0.6,
    fontWeight: '800',
    fontSize: 22,
    lineHeight: 28,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0,0,0,0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 10,
      },
      default: {},
    }),
  },
  heroSub: {
    ...typography.compact,
    marginTop: 4,
  },
  card: {
    backgroundColor: palette.sheet,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: palette.neonMint,
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
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
    color: palette.textOnCanvas,
    letterSpacing: -0.2,
  },
  sectionRight: {
    ...typography.caption,
    color: palette.textMutedOnCanvas,
  },
  pill: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pillNeutral: {
    backgroundColor: palette.field,
    borderColor: palette.slate200,
  },
  pillBrand: {
    backgroundColor: `${palette.neonSky}26`,
    borderColor: `${palette.neonSky}55`,
  },
  pillGood: {
    backgroundColor: `${palette.neonMint}24`,
    borderColor: `${palette.neonMint}4d`,
  },
  pillTextBase: {
    ...typography.caption,
    fontWeight: '600',
  },
  pillTxtNeutral: {
    color: palette.slate900,
  },
  pillTxtBrand: {
    color: '#06202c',
    fontWeight: '700',
  },
  pillTxtGood: {
    color: '#042f24',
    fontWeight: '700',
  },
  ghostBtn: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    ...typography.compact,
    color: palette.textOnCanvas,
    fontWeight: '700',
  },
});
