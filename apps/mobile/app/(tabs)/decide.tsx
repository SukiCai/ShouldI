import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import PrimaryButton from '@/components/ui/PrimaryButton';
import { GlassCard, GradientHero, SectionHeader } from '@/components/ui/Premium';
import Screen from '@/components/ui/Screen';
import { palette, spacing, typography } from '@/constants/theme';

export default function DecideLandingScreen() {
  return (
    <Screen padded scroll>
      <GradientHero
        eyebrow="AI decision workspace"
        title="Create a decision"
        subtitle="AI intake → review → final briefing."
        right={
          <View style={styles.metric}>
            <Text style={styles.metricValue}>~2 min</Text>
            <Text style={styles.metricMeta}>first draft</Text>
          </View>
        }
      />
      <SectionHeader title="How it works" />
      <GlassCard style={styles.steps}>
        <Step bullet="1" text="AI intake chat captures your decision context." />
        <Step bullet="2" text="Review and adjust your generated draft." />
        <Step bullet="3" text="Publish the final briefing result." />
      </GlassCard>
      <PrimaryButton accessibilityLabel="Start guided decision briefing" onPress={() => router.push('/decide')}>
        <Text style={styles.button}>Start AI intake</Text>
      </PrimaryButton>
      <Text style={[typography.caption, styles.footerNote]}>You can edit and re-run anytime.</Text>
    </Screen>
  );
}

function Step({ bullet, text }: { bullet: string; text: string }) {
  return (
    <View style={styles.row}>
      <Text style={[typography.compact, styles.bullet]}>{bullet}</Text>
      <Text style={[typography.body, styles.flex]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    alignItems: 'flex-end',
  },
  metricValue: {
    color: palette.accent,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  metricMeta: {
    ...typography.caption,
    color: palette.slate500,
  },
  steps: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  bullet: {
    color: palette.accent,
    fontWeight: '700',
    width: 22,
  },
  button: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  footerNote: {
    marginTop: spacing.sm,
    color: palette.slate500,
    textAlign: 'center',
    marginBottom: 70,
  },
});
