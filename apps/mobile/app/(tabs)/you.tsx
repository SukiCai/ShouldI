import React from 'react';
import { Link } from 'expo-router';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import PrimaryButton from '@/components/ui/PrimaryButton';
import { GlassCard, GradientHero, PillTag, SectionHeader } from '@/components/ui/Premium';
import Screen from '@/components/ui/Screen';
import { palette, spacing, typography } from '@/constants/theme';

export default function YouScreen() {
  const [muted, setMuted] = React.useState(false);

  return (
    <Screen padded scroll>
      <GradientHero
        eyebrow="Personal workspace"
        title="Account & preferences"
        subtitle="Manage defaults in one place."
        right={<PillTag label="Secure" tone="good" />}
      />

      <SectionHeader title="Preferences" />
      <GlassCard style={styles.card}>
        <Text style={[typography.caption, styles.sectionTitle]}>Notifications</Text>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={typography.compact}>Muted notifications</Text>
            <Text style={[typography.caption, styles.muted]}>Only high-signal nudges.</Text>
          </View>
          <Switch
            accessibilityLabel="Muted notifications toggle"
            value={muted}
            onValueChange={setMuted}
            thumbColor={muted ? palette.neonPink : palette.sheet}
          />
        </View>
      </GlassCard>

      <Text style={[typography.compact, styles.sectionLabel]}>Saved</Text>
      <GlassCard style={[styles.card, styles.placeholderBox]}>
        <Text style={typography.body}>History and saved briefings appear after auth ships.</Text>
      </GlassCard>

      <PrimaryButton
        accessibilityLabel="Read transparency and disclaimers (coming soon)"
        variant="ghost"
        style={{ marginTop: spacing.sm }}
        onPress={() => Alert.alert('Coming soon', 'Disclaimers and transparency center will publish here early on.')}
      >
        <Text style={[typography.compact, styles.ghostText]}>Transparency</Text>
      </PrimaryButton>

      <Link href="/sign-up">
        <Text style={[styles.linkMuted, typography.compact]} accessibilityRole="button">
          Sign-up screen (preview layout)
        </Text>
      </Link>
      <Link href="/modal">
        <Text style={[styles.link, typography.body]} accessibilityRole="button">
          Diagnostics
        </Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: palette.slate500,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  muted: {
    color: palette.slate500,
    marginTop: 4,
  },
  sectionLabel: {
    marginTop: spacing.lg,
    fontWeight: '700',
    color: palette.slate950,
  },
  placeholderBox: {
    borderStyle: 'dashed',
  },
  ghostText: {
    color: palette.heroInk,
    fontWeight: '700',
    textAlign: 'center',
  },
  link: {
    marginTop: spacing.sm,
    color: palette.neonSky,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginBottom: 70,
  },
  linkMuted: {
    marginTop: spacing.sm,
    color: palette.neonMint,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginBottom: 4,
  },
});
