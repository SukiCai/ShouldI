import { router } from 'expo-router';
import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscussDraftEditor } from '@/components/decide/DiscussDraftEditor';
import { DiscussScreenBackdrop } from '@/components/decision/DiscussScreenBackdrop';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { GhostAction } from '@/components/ui/Premium';
import { useColorScheme } from '@/components/useColorScheme';
import { reelSurfaceGradientCoarse } from '@/constants/reelSurfaceGradients';
import { palette, spacing, themeSurface, typography } from '@/constants/theme';

import { useDecideWizard } from './context';

export default function DecideConfirmScreen() {
  const { draft, updateDraft, submitBriefing, postCommunityValidationCard, busy, error, lastResponse } =
    useDecideWizard();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  const category = draft.category ?? 'life';
  const gradient = reelSurfaceGradientCoarse(category);
  const screenTint = gradient[0]!;

  React.useEffect(() => {
    if (!draft.title.trim()) return;
    if (draft.communityChallengeQuestion.trim().length > 0) return;
    updateDraft({
      communityChallengeQuestion: draft.title.trim(),
    });
  }, [draft.title, draft.communityChallengeQuestion, updateDraft]);

  React.useEffect(() => {
    if (draft.hook.trim().length > 0) return;
    const seed = draft.constraints.trim() || draft.title.trim();
    if (!seed) return;
    updateDraft({ hook: seed.slice(0, 220) });
  }, [draft.constraints, draft.hook, draft.title, updateDraft]);

  React.useEffect(() => {
    if (draft.tension.trim().length > 0) return;
    if (!draft.communityAiBecause.trim()) return;
    updateDraft({ tension: draft.communityAiBecause.trim().slice(0, 220) });
  }, [draft.communityAiBecause, draft.tension, updateDraft]);

  const pollQuestion = draft.communityChallengeQuestion.trim() || draft.title.trim();
  const canPost =
    !!lastResponse &&
    !!draft.category &&
    !!pollQuestion &&
    !!draft.hook.trim() &&
    !!draft.tension.trim() &&
    !!draft.communityAiVerdictLine.trim() &&
    !!draft.communityAiBecause.trim() &&
    draft.pollOptions.every((option) => option.label.trim().length > 0);

  return (
    <View style={[styles.root, { backgroundColor: screenTint }]}>
      <DiscussScreenBackdrop category={category} coarseGradient={gradient}>
        <ScrollView
          accessibilityRole="scrollbar"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + 8,
              paddingLeft: Math.max(insets.left, 0),
              paddingRight: Math.max(insets.right, 0),
              paddingBottom: Math.max(spacing.xl, insets.bottom + 24),
            },
          ]}>
          <DiscussDraftEditor draft={draft} onChange={updateDraft} onBack={() => router.back()} />

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
              disabled={busy || !canPost}
              onPress={() => postCommunityValidationCard()}>
              <Text style={styles.onPrimary}>Post to Explore · peer validation</Text>
            </PrimaryButton>

            {!lastResponse ? (
              <Text style={[styles.helper, { color: surface.textMuted }]}>
                Tap any text on the card above to edit — it matches what peers will see in Discuss.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </DiscussScreenBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
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
    paddingHorizontal: 4,
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
