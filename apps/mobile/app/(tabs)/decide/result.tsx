import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import PrimaryButton from '@/components/ui/PrimaryButton';
import { GlassCard, GradientHero, PillTag, SectionHeader } from '@/components/ui/Premium';
import Screen from '@/components/ui/Screen';
import { useColorScheme } from '@/components/useColorScheme';
import {
  palette,
  profileLight,
  profileNeutralStroke,
  spacing,
  themeSurface,
  typography,
} from '@/constants/theme';

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
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  const { lastResponse, reset } = useDecideWizard();

  if (!lastResponse) {
    return (
      <Screen padded>
        <Text style={[typography.body, { color: surface.textPrimary }]}>No briefing yet.</Text>
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
      <GlassCard
        style={[
          styles.statusCard,
          {
            backgroundColor: isDark ? `${palette.neonMint}14` : `${profileLight.mint}12`,
            borderColor: isDark ? `${palette.neonMint}40` : `${profileLight.mint}45`,
          },
        ]}>
        <Text style={[typography.caption, styles.micro]} accessibilityRole="alert">
          {statusHeadline[hermesStatus]}
        </Text>
      </GlassCard>
      <SectionHeader title="Recommendation" right={`${sections.length} blocks`} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
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

      <View style={{ marginVertical: spacing.md }}>
        <Text style={[typography.compact, { ...styles.labelCaps, color: surface.textMuted }]}>Keep momentum</Text>
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
              style={[
                styles.pillSecondary,
                {
                  borderColor: isDark ? palette.chromeHairline : profileNeutralStroke(0.1),
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : surface.statTileBg,
                },
              ]}>
              <Text style={[typography.compact, { color: surface.textPrimary }]} numberOfLines={1}>
                {label}
              </Text>
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
        onPress={() => router.push('/(tabs)/decide/confirm')}
        accessibilityLabel="Fine tune Explore validation card">
        <Text style={{ color: profileLight.sky, fontWeight: '700' }}>Adjust Explore validation card</Text>
      </PrimaryButton>

      <PrimaryButton
        variant="ghost"
        style={{ marginTop: spacing.sm }}
        onPress={() => {
          reset();
          router.replace('/(tabs)/decide');
        }}
        accessibilityLabel="Return to decision wizard home">
        <Text style={{ color: profileLight.pink, fontWeight: '700' }}>New decision briefing</Text>
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
  },
  section: {
    marginTop: spacing.md,
    gap: 6,
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
  pillSecondary: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
});
