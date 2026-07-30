import * as React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscussDraftEditor } from '@/components/decide/DiscussDraftEditor';
import { decideSummaryStyles as styles } from '@/components/decide/decideSummaryStyles';
import { useColorScheme } from '@/components/useColorScheme';
import { palette, spacing, themeSurface } from '@/constants/theme';

import { useDecideWizard } from './context';

export default function DecideConfirmScreen() {
  const { draft, updateDraft, postCommunityValidationCard, busy, error } = useDecideWizard();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();

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
    !!draft.category &&
    !!pollQuestion &&
    !!draft.hook.trim() &&
    !!draft.tension.trim() &&
    !!draft.communityAiVerdictLine.trim() &&
    !!draft.communityAiBecause.trim() &&
    draft.pollOptions.every((option) => option.label.trim().length > 0);

  const card = {
    backgroundColor: surface.groupedSurface,
    borderColor: surface.groupedBorder,
  };

  return (
    <View style={{ flex: 1, backgroundColor: surface.canvas }}>
      <ScrollView
        accessibilityRole="scrollbar"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.confirmScroll,
          {
            paddingTop: spacing.md,
            paddingBottom: Math.max(spacing.xl, insets.bottom + 24),
          },
        ]}>
        <Text style={[styles.confirmLead, { color: surface.textMuted }]} numberOfLines={2}>
          This is what peers will see on Explore.
        </Text>

        <DiscussDraftEditor draft={draft} onChange={updateDraft} />

        {error ? (
          <View
            style={[
              styles.errorBanner,
              card,
              {
                borderColor: palette.danger,
                backgroundColor: scheme === 'dark' ? 'rgba(251,113,133,0.08)' : 'rgba(244,63,94,0.06)',
              },
            ]}>
            <Text style={[styles.errorText, { color: surface.textPrimary }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.confirmActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post to community"
            disabled={busy || !canPost}
            onPress={() => postCommunityValidationCard()}
            style={[styles.primaryBtn, (busy || !canPost) && { opacity: 0.45 }]}>
            <Text style={styles.primaryBtnText}>Post to community</Text>
          </Pressable>

          {!canPost ? (
            <Text style={[styles.helper, { color: surface.textMuted }]}>
              Finish the question, options, and ShouldI lean before posting.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
