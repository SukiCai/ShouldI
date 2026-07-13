import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { GlassCard, GradientHero, PillTag, SectionHeader } from '@/components/ui/Premium';
import Screen from '@/components/ui/Screen';
import { useColorScheme } from '@/components/useColorScheme';
import { useDecideWizard } from './context';
import { palette, spacing, themeSurface, typography } from '@/constants/theme';

const statusHeadline: Record<'stub' | 'embedded' | 'ready' | 'error', string> = {
  stub: 'Full recommendation isn’t available yet — you’re seeing a preview.',
  embedded: 'ShouldI is preparing your recommendation. This may take a moment.',
  ready: 'Your personalized recommendation is ready.',
  error: 'We couldn’t complete this recommendation. Please try again.',
};

export default function DecideResultScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const { draft, lastResponse, reset } = useDecideWizard();

  if (!lastResponse) {
    return (
      <Screen variant="plain" padded>
        <Text style={[typography.body, { color: surface.textPrimary }]}>No recommendation yet.</Text>
        <Button label="Start over" onPress={() => router.replace('/(tabs)/decide')} />
      </Screen>
    );
  }

  const { sections, disclaimer, hermesStatus, threadId } = lastResponse;

  return (
    <Screen variant="plain" padded>
      <GradientHero
        eyebrow="Published"
        title="Decision recommendation ready"
        subtitle="Clear recommendation first, with the context behind it."
        right={<PillTag label={`Thread ${threadId}`} tone="brand" />}
      />
      <GlassCard
        style={[
          styles.statusCard,
          {
            backgroundColor: surface.statTileBg,
            borderColor: surface.hairline,
          },
        ]}>
        <Text style={[typography.caption, styles.micro]} accessibilityRole="alert">
          {statusHeadline[hermesStatus]}
        </Text>
      </GlassCard>
      <SectionHeader title="Recommendation" right={`${sections.length} blocks`} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
        {draft.decisionLens ? (
          <GlassCard style={styles.section}>
            <Text style={[typography.compact, { ...styles.labelCaps, color: surface.textMuted }]}>Decision Lens</Text>
            <Text style={[typography.bodySm, { color: surface.textPrimary, fontWeight: '700' }]}>
              {draft.decisionLens.headline}
            </Text>
            <Text style={[typography.compact, { color: surface.textMuted }]}>
              Confidence score: {draft.decisionLens.confidenceScore}
            </Text>
            {draft.decisionLens.strengths.length > 0 ? (
              <Text style={[typography.compact, { color: surface.textMuted, lineHeight: 20 }]}>
                Strengths: {draft.decisionLens.strengths.join(' · ')}
              </Text>
            ) : null}
            {draft.decisionLens.blindSpots.length > 0 ? (
              <Text style={[typography.compact, { color: surface.textMuted, lineHeight: 20 }]}>
                Blind spots: {draft.decisionLens.blindSpots.join(' · ')}
              </Text>
            ) : null}
            {draft.decisionLens.calibrationFocus ? (
              <Text style={[typography.compact, { color: surface.textMuted, lineHeight: 20 }]}>
                Calibration focus: {draft.decisionLens.calibrationFocus}
              </Text>
            ) : null}
          </GlassCard>
        ) : null}
        {draft.reflection?.summary ? (
          <GlassCard style={styles.section}>
            <Text style={[typography.compact, { ...styles.labelCaps, color: surface.textMuted }]}>What we heard</Text>
            <Text style={[typography.body, { ...styles.body, color: surface.textPrimary }]} selectable>
              {draft.reflection.summary}
            </Text>
            {draft.reflection.concerns?.map((concern) => (
              <Text key={concern} style={[typography.compact, { color: surface.textMuted, lineHeight: 20 }]}>
                · {concern}
              </Text>
            ))}
          </GlassCard>
        ) : null}
        {draft.expertVerdicts.length > 0 ? (
          <GlassCard style={styles.section}>
            <Text style={[typography.compact, { ...styles.labelCaps, color: surface.textMuted }]}>Expert council</Text>
            {draft.expertVerdicts.map((verdict) => (
              <View key={verdict.expertId} style={styles.expertVerdict}>
                <Text style={[typography.compact, { color: surface.textPrimary, fontWeight: '800' }]}>
                  {verdict.expertTitle}
                </Text>
                <Text style={[typography.body, { color: surface.textPrimary, fontWeight: '800' }]}>
                  {verdict.verdictLine}
                </Text>
                <Text style={[typography.compact, { color: surface.textMuted, lineHeight: 20 }]}>
                  {verdict.reasoning}
                </Text>
                <Text style={[typography.caption, { color: surface.textMuted, marginTop: 4 }]}>
                  Confidence: {verdict.confidence}
                  {verdict.risks.length > 0 ? ` · ${verdict.risks.join(' · ')}` : ''}
                </Text>
              </View>
            ))}
          </GlassCard>
        ) : null}
        {sections.map((section) => (
          <GlassCard key={section.id} style={styles.section}>
            <Text style={[typography.compact, { ...styles.labelCaps, color: surface.textMuted }]}>{section.title}</Text>
            <Text style={[typography.body, { ...styles.body, color: surface.textPrimary }]} selectable>
              {section.body}
            </Text>
          </GlassCard>
        ))}
        <Text style={[typography.caption, styles.disclaimer, { color: surface.textMuted }]}>{disclaimer}</Text>
      </ScrollView>

      <Button
        label={draft.decisionRecordId ? 'Open Outcome Replay' : 'Continue to Explore'}
        accessibilityLabel={
          draft.decisionRecordId
            ? 'Open outcome replay for this decision'
            : 'Open community decision feed to keep momentum'
        }
        onPress={() => {
          if (draft.decisionRecordId) {
            router.push({
              pathname: '/outcome-replay/[id]',
              params: { id: draft.decisionRecordId },
            });
            return;
          }
          router.replace({
            pathname: '/(tabs)/explore',
          });
        }}
      />

      <Button
        label="New decision"
        variant="ghost"
        style={{ marginTop: spacing.sm }}
        onPress={() => {
          reset();
          router.replace('/(tabs)/decide');
        }}
        accessibilityLabel="Return to decision wizard home"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  micro: {
    color: palette.mint,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusCard: {
    marginTop: spacing.sm,
  },
  section: {
    marginTop: spacing.md,
    gap: 6,
  },
  expertVerdict: {
    gap: 4,
    paddingVertical: 8,
  },
  labelCaps: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: {
    lineHeight: 22,
  },
  disclaimer: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
