import { router } from 'expo-router';
import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommunityValidationCardEditor } from '@/components/decide/CommunityValidationCardEditor';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { GhostAction } from '@/components/ui/Premium';
import Screen from '@/components/ui/Screen';
import { useColorScheme } from '@/components/useColorScheme';
import {
  palette,
  profileLight,
  screenContentGutter,
  spacing,
  themeSurface,
  typography,
} from '@/constants/theme';

import { useDecideWizard } from './context';

export default function DecideConfirmScreen() {
  const { draft, updateDraft, submitBriefing, postCommunityValidationCard, busy, error, lastResponse } =
    useDecideWizard();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  const panelBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.92)';
  const panelBorder = surface.hairline;

  const statusReadyBg = lastResponse ? (isDark ? 'rgba(61,255,184,0.12)' : `${profileLight.sky}18`) : isDark ? 'rgba(255,255,255,0.06)' : profileLight.tabTrack;
  const statusReadyBorder = lastResponse ? (isDark ? 'rgba(61,255,184,0.35)' : `${profileLight.sky}45`) : surface.hairline;
  const statusDotColor = lastResponse ? (isDark ? palette.neonMint : profileLight.sky) : surface.textMuted;
  const statusTextColor = lastResponse ? (isDark ? palette.neonMint : profileLight.mint) : surface.textMuted;

  React.useEffect(() => {
    if (!draft.title.trim()) return;
    if (draft.communityChallengeQuestion.trim().length > 0) return;
    updateDraft({
      communityChallengeQuestion: `Given everything I shared about "${draft.title.trim()}", would you side with Harmence's leaning below?`,
    });
  }, [draft.title, draft.communityChallengeQuestion, updateDraft]);

  return (
    <Screen padded={false}>
      <ScrollView
        accessibilityRole="scrollbar"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(10, insets.top + 4),
            paddingHorizontal: screenContentGutter,
            paddingBottom: Math.max(spacing.xl, insets.bottom + 24),
          },
        ]}>
        <View style={styles.hero}>
          <Text style={[styles.title, { color: surface.textPrimary }]}>Review draft</Text>
          <Text style={[styles.subtitle, { color: surface.textMuted }]}>
            Shape the Explore thread: how Harmence leans, why, and the yes/no you want strangers to fight over.
          </Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: statusReadyBg,
                borderColor: statusReadyBorder,
              },
            ]}>
            <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
            <Text style={[styles.statusText, { color: statusTextColor }]}>
              {lastResponse ? 'Briefing ready — card fields filled' : 'Generate a briefing to populate AI copy'}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionEyebrow, { color: surface.textMuted }]}>Intake snapshot</Text>
        <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
          <ContextRow label="Arena" value={draft.category ?? 'Unset'} surface={surface} isLast={false} />
          <ContextRow label="Decision" value={draft.title || 'Unset'} surface={surface} isLast={false} />
          <ContextRow label="Constraints" value={draft.constraints || 'None noted'} surface={surface} isLast={false} />
          <ContextRow label="Success signal" value={draft.successCriteria || 'Skipped'} surface={surface} isLast />
        </View>

        <View style={styles.blockSpacer} />

        <Text style={[styles.sectionEyebrow, { color: surface.textMuted }]}>Explore post</Text>
        <CommunityValidationCardEditor
          labels={{
            aiVerdictLine: draft.communityAiVerdictLine,
            aiBecause: draft.communityAiBecause,
            challengeQuestion: draft.communityChallengeQuestion,
          }}
          onChange={(p) =>
            updateDraft({
              ...(p.aiVerdictLine !== undefined ? { communityAiVerdictLine: p.aiVerdictLine } : {}),
              ...(p.aiBecause !== undefined ? { communityAiBecause: p.aiBecause } : {}),
              ...(p.challengeQuestion !== undefined ? { communityChallengeQuestion: p.challengeQuestion } : {}),
            })
          }
        />

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                borderColor: isDark ? 'rgba(255,120,120,0.45)' : 'rgba(180,40,40,0.35)',
                backgroundColor: isDark ? 'rgba(255,80,80,0.1)' : 'rgba(255,235,235,0.95)',
              },
            ]}>
            <Text style={[styles.errorText, { color: isDark ? '#ffb8b8' : '#7f1d1d' }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            accessibilityHint="Calls ShouldI briefing API and hydrates Explore fields"
            disabled={busy || !draft.category || !draft.title.trim()}
            onPress={() => {
              void submitBriefing();
            }}>
            <Text style={styles.onPrimary}>{busy ? 'Synthesizing…' : 'Synthesize briefing into card'}</Text>
          </PrimaryButton>

          <View style={styles.secondaryRow}>
            <View style={[styles.flexBtn, !lastResponse && styles.disabledWrap]} pointerEvents={lastResponse ? 'auto' : 'none'}>
              <GhostAction
                label="Open full briefing"
                accessibilityLabel="Open full briefing transcript"
                onPress={() => {
                  if (lastResponse) router.push('/(tabs)/decide/result');
                }}
              />
            </View>
            <View style={styles.flexBtn}>
              <GhostAction label="Back to chat" accessibilityLabel="Back to Harmence" onPress={() => router.back()} />
            </View>
          </View>

          <PrimaryButton
            accessibilityLabel="Publish validation card to Explore"
            disabled={
              busy ||
              !lastResponse ||
              !draft.category ||
              !draft.communityAiVerdictLine.trim() ||
              !draft.communityAiBecause.trim() ||
              !draft.communityChallengeQuestion.trim()
            }
            onPress={() => postCommunityValidationCard()}>
            <Text style={styles.onPrimary}>Post to Explore · peer validation</Text>
          </PrimaryButton>

          {!lastResponse ? (
            <Text style={[styles.helper, { color: surface.textMuted }]}>
              Synthesize Harmence&apos;s briefing first — we&apos;ll drop the copy into the card above for a final edit.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function ContextRow({
  label,
  value,
  surface,
  isLast,
}: {
  label: string;
  value: string;
  surface: ReturnType<typeof themeSurface>;
  isLast: boolean;
}) {
  return (
    <View style={[styles.ctxRow, !isLast && { borderBottomColor: surface.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.ctxLabel, { color: surface.textMuted }]}>{label}</Text>
      <Text style={[styles.ctxValue, { color: surface.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  hero: {
    marginBottom: spacing.md,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  subtitle: {
    ...typography.compact,
    lineHeight: 21,
    maxWidth: 520,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionEyebrow: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  panel: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  ctxRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: 4,
  },
  ctxLabel: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ctxValue: {
    ...typography.body,
    lineHeight: 23,
    fontWeight: '500',
  },
  blockSpacer: {
    height: spacing.lg,
  },
  errorBanner: {
    marginTop: spacing.md,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    ...typography.compact,
    fontWeight: '600',
    lineHeight: 20,
  },
  actions: {
    marginTop: spacing.lg,
    gap: 12,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexBtn: {
    flex: 1,
  },
  disabledWrap: {
    opacity: 0.45,
  },
  onPrimary: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  helper: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 18,
  },
});
