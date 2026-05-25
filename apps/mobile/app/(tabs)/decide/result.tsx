import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import PrimaryButton from '@/components/ui/PrimaryButton';
import { GlassCard, GradientHero, PillTag, SectionHeader } from '@/components/ui/Premium';
import Screen from '@/components/ui/Screen';
import { palette, spacing, typography } from '@/constants/theme';

import { useDecideWizard } from './context';

const continuitySuggestions = ['See similar outcomes', 'Sharper follow-up', 'Compare A vs B'];

const statusHeadline: Record<'stub' | 'embedded' | 'ready' | 'error', string> = {
  stub:
    'Hermes is not on disk yet—run submodule init so hermes-agent-private/ sits at this repo root.',
  embedded:
    'Full Hermes repo is embedded in this monorepo; the gateway streams a guarded preview until inference runs.',
  ready: 'Hermes inference is connected through the gateway.',
  error: 'We could not complete this briefing request.',
};

export default function DecideResultScreen() {
  const { lastResponse, reset } = useDecideWizard();

  if (!lastResponse) {
    return (
      <Screen padded>
        <Text style={[typography.body, { color: palette.textOnCanvas }]}>No briefing yet.</Text>
        <PrimaryButton onPress={() => router.replace('/(tabs)/decide')}>
          <Text style={{ color: palette.white }}>Start over</Text>
        </PrimaryButton>
      </Screen>
    );
  }

  const { sections, disclaimer, hermesStatus, threadId } = lastResponse;

  return (
    <Screen padded>
      <GradientHero
        eyebrow="Published"
        title="Decision briefing ready"
        subtitle="Final output from your intake flow."
        right={<PillTag label={`Thread ${threadId}`} tone="brand" />}
      />
      <GlassCard style={styles.statusCard}>
        <Text style={[typography.caption, styles.micro]} accessibilityRole="alert">
          {statusHeadline[hermesStatus]}
        </Text>
      </GlassCard>
      <SectionHeader title="Recommendation" right={`${sections.length} blocks`} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
        {sections.map((section) => (
          <GlassCard key={section.id} style={styles.section}>
            <Text style={[typography.compact, styles.labelCaps]}>{section.title}</Text>
            <Text style={[typography.body, styles.body]} selectable>
              {section.body}
            </Text>
          </GlassCard>
        ))}
        <Text style={[typography.caption, styles.disclaimer]}>{disclaimer}</Text>
      </ScrollView>

      <View style={{ marginVertical: spacing.md }}>
        <Text style={[typography.compact, styles.labelCaps]}>Keep momentum</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {continuitySuggestions.map((label) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={label}
              key={label}
              activeOpacity={0.84}
              onPress={() =>
                router.replace({
                  pathname: '/(tabs)/explore',
                })
              }
              style={styles.pillSecondary}>
              <Text style={[typography.compact]} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <PrimaryButton
        accessibilityLabel="Open vertically paged community outcomes feed"
        onPress={() =>
          router.replace({
            pathname: '/(tabs)/explore',
          })
        }>
        <Text style={{ color: palette.white, fontWeight: '600', fontSize: 16 }}>
          Continue to Explore
        </Text>
      </PrimaryButton>

      <PrimaryButton
        variant="ghost"
        style={{ marginTop: spacing.sm }}
        onPress={() => {
          reset();
          router.replace('/(tabs)/decide');
        }}
        accessibilityLabel="Return to decision wizard home">
        <Text style={{ color: palette.accent, fontWeight: '700' }}>New decision briefing</Text>
      </PrimaryButton>
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
    backgroundColor: '#f3fcf8',
    borderColor: '#d5efdf',
  },
  section: {
    marginTop: spacing.md,
    gap: 6,
  },
  labelCaps: {
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.textMutedOnCanvas,
  },
  body: {
    color: palette.slate900,
    lineHeight: 22,
  },
  disclaimer: {
    marginTop: spacing.sm,
    color: palette.textMutedOnCanvas,
    lineHeight: 18,
  },
  pillSecondary: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cdd8f9',
    backgroundColor: '#f9fbff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
});
