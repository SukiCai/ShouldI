import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import PrimaryButton from '@/components/ui/PrimaryButton';
import { GlassCard, GradientHero, PillTag, SectionHeader } from '@/components/ui/Premium';
import Screen from '@/components/ui/Screen';
import { palette, spacing, typography } from '@/constants/theme';

import { useDecideWizard } from './context';

export default function DecideConfirmScreen() {
  const { draft, submitBriefing, busy, error } = useDecideWizard();

  return (
    <Screen padded>
      <ScrollView accessibilityRole="scrollbar">
        <GradientHero
          eyebrow="Final review"
          title="Review before generating"
          subtitle="Quick check before generation."
          right={<PillTag label="Step 3/3" tone="brand" />}
        />
        <SectionHeader title="Draft summary" />
        <GlassCard>
          <Section label="Arena" body={draft.category ?? 'Unset'} />
          <Section label="Decision" body={draft.title || 'Unset'} />
          <Section label="Constraints" body={draft.constraints || 'None noted'} />
          <Section label="Success signal" body={draft.successCriteria || 'Skipped'} />
        </GlassCard>

        {error ? (
          <GlassCard style={styles.error}>
            <Text style={[typography.compact, { color: '#a61b1b', fontWeight: '700' }]}>
              {error}
            </Text>
          </GlassCard>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton
            accessibilityHint="Starts ShouldI briefing"
            disabled={busy || !draft.category || !draft.title.trim()}
            onPress={() => {
              void submitBriefing();
            }}>
            <Text style={styles.button}>{busy ? 'Generating…' : 'Generate briefing'}</Text>
          </PrimaryButton>
          <PrimaryButton
            accessibilityLabel="Edit decision headline"
            variant="ghost"
            style={{ marginTop: spacing.sm }}
            onPress={() => router.back()}
          >
            <Text style={[typography.body, styles.ghost]}>Edit details</Text>
          </PrimaryButton>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[typography.caption, styles.labelCaps]}>{label}</Text>
      <Text style={[typography.body]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 16,
  },
  ghost: {
    color: palette.textOnCanvas,
    textAlign: 'center',
  },
  labelCaps: {
    color: palette.slate500,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  error: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#f2c3c3',
    backgroundColor: '#fff4f4',
    marginTop: spacing.md,
  },
});
