import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { discussCardStyles as styles } from '@/components/decision/discussCardStyles';
import {
  InlineDistributionTrack,
  PollQuestionAccentBar,
  RewardPointsGem,
  ReelCardActionBar,
  ReelCardSurface,
  reelDiscussStyles,
} from '@/components/explore/ReelDiscussChrome';
import { palette, profileTypography, typography } from '@/constants/theme';
import type { DiscussDraftPollOption } from '@/app/(tabs)/decide/context';
import type { DecisionCategory, DecideInterviewFinalDecision } from '@shouldi/contracts';

const TEAM_STRIPES = [palette.accent, palette.mint, palette.playful, palette.accentBloom] as const;

export type DiscussDraftFields = {
  category?: DecisionCategory;
  title: string;
  hook: string;
  tension: string;
  communityChallengeQuestion: string;
  communityAiVerdictLine: string;
  communityAiBecause: string;
  pollOptions: DiscussDraftPollOption[];
  aiSuggestedOptionId: string;
  aiConfidenceScore?: number;
  discussionPreview: string[];
  rewardPoints: number;
  expertVerdicts: DecideInterviewFinalDecision['expertVerdicts'];
  keyMoments?: DecideInterviewFinalDecision['keyMoments'];
};

type Props = {
  draft: DiscussDraftFields;
  onChange(patch: Partial<DiscussDraftFields>): void;
  onBack?(): void;
};

function confidenceColor(pct: number): string {
  if (pct >= 75) return '#10B981';
  if (pct >= 55) return '#3B82F6';
  return '#F59E0B';
}

function optionIndex(options: DiscussDraftPollOption[], optionId: string): number {
  const i = options.findIndex((o) => o.id === optionId);
  return i >= 0 ? i : 0;
}

function teamStripeColor(options: DiscussDraftPollOption[], optionId: string): string {
  return TEAM_STRIPES[optionIndex(options, optionId) % TEAM_STRIPES.length]!;
}

export function DiscussDraftEditor({ draft, onChange, onBack }: Props) {
  const category = draft.category ?? 'life';
  const pollQuestion = draft.communityChallengeQuestion.trim() || draft.title.trim();
  const aiLeanId = draft.aiSuggestedOptionId || draft.pollOptions[0]?.id || 'yes';
  const aiLeanLabel = draft.pollOptions.find((o) => o.id === aiLeanId)?.label ?? null;
  const confidenceScore = draft.aiConfidenceScore ?? null;
  const placeholder = profileTypography.subdued;
  const previewCount = draft.discussionPreview.filter((line) => line.trim().length > 0).length;

  const [saved, setSaved] = React.useState(false);
  const [following, setFollowing] = React.useState(false);

  const updatePollOption = (optionId: string, label: string) => {
    onChange({
      pollOptions: draft.pollOptions.map((option) => (option.id === optionId ? { ...option, label } : option)),
    });
  };

  const updateDiscussionPreviewLine = (index: number, value: string) => {
    const next = [...draft.discussionPreview];
    next[index] = value;
    onChange({ discussionPreview: next });
  };

  const updateExpertVerdict = (
    expertId: string,
    patch: Partial<DecideInterviewFinalDecision['expertVerdicts'][number]>,
  ) => {
    onChange({
      expertVerdicts: draft.expertVerdicts.map((verdict) =>
        verdict.expertId === expertId ? { ...verdict, ...patch } : verdict,
      ),
    });
  };

  const addDiscussionPreviewLine = () => {
    if (draft.discussionPreview.length >= 4) return;
    onChange({ discussionPreview: [...draft.discussionPreview, ''] });
  };

  return (
    <View style={styles.wrap} accessibilityLabel="Editable Explore discussion draft">
      <ReelCardSurface category={category} isOpen layout="fullscreen" suppressAtmosphere>
        <ReelCardActionBar
          variant="discuss-top"
          voteSummary={{ voteTotal: 0, isLivePoll: true }}
          saved={saved}
          following={following}
          onToggleSave={() => setSaved((s) => !s)}
          onToggleFollow={() => setFollowing((f) => !f)}
          onLeadingBackPress={onBack ?? (() => undefined)}
        />

        <View style={reelDiscussStyles.pollQuestionRow}>
          <View style={reelDiscussStyles.pollQuestionTextCol}>
            <View style={reelDiscussStyles.pollQuestionTitleRow}>
              <TextInput
                accessibilityLabel="Poll question headline"
                value={pollQuestion}
                onChangeText={(text) =>
                  onChange({
                    communityChallengeQuestion: text,
                    ...(draft.title.trim().length === 0 ? { title: text } : {}),
                  })
                }
                placeholder="The yes/no question strangers will vote on"
                placeholderTextColor={placeholder}
                multiline
                style={[
                  typography.hero,
                  reelDiscussStyles.pollQuestion,
                  reelDiscussStyles.pollQuestionHeadlineFlexible,
                  reelDiscussStyles.pollQuestionOpen,
                  reelDiscussStyles.pollHeroOpen,
                  styles.editableField,
                ]}
              />
              <RewardPointsGem rewardPoints={draft.rewardPoints} density="compact" />
            </View>
            <PollQuestionAccentBar />
          </View>
        </View>

        <View style={reelDiscussStyles.optionWrap}>
          {draft.pollOptions.map((option) => {
            const aiLeanHere = option.id === aiLeanId;
            const percentage = aiLeanHere ? 62 : 38;
            const pickedSurfaceStyle = aiLeanHere ? reelDiscussStyles.optionPillAiLeanOnly : undefined;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`Set AI lean to ${option.label || 'option'}`}
                accessibilityState={{ selected: aiLeanHere }}
                onPress={() => onChange({ aiSuggestedOptionId: option.id })}
                style={[reelDiscussStyles.optionPill, pickedSurfaceStyle]}>
                <View style={reelDiscussStyles.optionTopRow}>
                  <TextInput
                    value={option.label}
                    onChangeText={(text) => updatePollOption(option.id, text)}
                    placeholder="Option label"
                    placeholderTextColor={placeholder}
                    style={[reelDiscussStyles.optionText, styles.editableField, { flex: 1, minWidth: 0 }]}
                  />
                  <View style={reelDiscussStyles.optionMetaCluster}>
                    {aiLeanHere ? (
                      <View style={reelDiscussStyles.aiLeanBadge}>
                        <Text style={reelDiscussStyles.aiLeanBadgeText}>AI</Text>
                      </View>
                    ) : null}
                    <Text style={reelDiscussStyles.optionMeta}>{percentage}%</Text>
                  </View>
                </View>
                <InlineDistributionTrack percentage={percentage} emphasis={aiLeanHere ? 'ai' : 'neutral'} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.summarySection}>
          <View style={styles.aiDecisionCard}>
            <View style={styles.aiDecisionHeaderRow}>
              <View style={styles.aiDecisionBadge}>
                <Text style={styles.aiDecisionBadgeText}>AI DECISION</Text>
              </View>
              {confidenceScore != null ? (
                <View style={[styles.confidencePill, { backgroundColor: `${confidenceColor(confidenceScore)}18`, borderColor: `${confidenceColor(confidenceScore)}44` }]}>
                  <View style={[styles.confidenceDot, { backgroundColor: confidenceColor(confidenceScore) }]} />
                  <Text style={[styles.confidenceLabel, { color: confidenceColor(confidenceScore) }]}>
                    {confidenceScore}% confidence
                  </Text>
                </View>
              ) : null}
            </View>

            <TextInput
              accessibilityLabel="AI decision headline"
              value={draft.communityAiVerdictLine}
              onChangeText={(text) => onChange({ communityAiVerdictLine: text })}
              placeholder="Harmence leaning headline"
              placeholderTextColor={placeholder}
              multiline
              style={[styles.aiDecisionHeadline, styles.editableField, { minHeight: 28 }]}
            />

            <TextInput
              accessibilityLabel="AI decision reasoning"
              value={draft.communityAiBecause}
              onChangeText={(text) => onChange({ communityAiBecause: text })}
              placeholder="Tradeoffs, risks, and constraints peers will read."
              placeholderTextColor={placeholder}
              multiline
              textAlignVertical="top"
              style={[styles.aiDecisionReason, styles.editableField, { minHeight: 56, maxHeight: 120 }]}
            />

            {draft.keyMoments && draft.keyMoments.length > 0 ? (
              <View style={styles.keyContextSection}>
                <Text style={styles.keyContextEyebrow}>Key context</Text>
                {draft.keyMoments.map((moment, i) => {
                  const accent =
                    moment.type === 'expert_join' ? '#8b5cf6'
                    : moment.type === 'complexity' ? '#f59e0b'
                    : '#10b981';
                  return (
                    <View key={i} style={[styles.momentCard, { borderLeftWidth: 3, borderLeftColor: accent }]}>
                      <Text style={styles.momentOrdinal}>{String(i + 1).padStart(2, '0')}</Text>
                      <Text style={styles.momentCardTitle} numberOfLines={2}>
                        {moment.impact?.trim() || moment.answer}
                      </Text>
                      {moment.impact?.trim() ? (
                        <Text style={styles.momentCardSub} numberOfLines={1}>"{moment.answer}"</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.aiReactionRow}>
              <View style={styles.aiReactionPill} accessibilityRole="text">
                <Ionicons name="thumbs-up-outline" size={16} color={profileTypography.subdued} />
                <Text style={styles.aiReactionLabel}>Agree · 0</Text>
              </View>
              <View style={styles.aiReactionPill} accessibilityRole="text">
                <Ionicons name="thumbs-down-outline" size={16} color={profileTypography.subdued} />
                <Text style={styles.aiReactionLabel}>Disagree · 0</Text>
              </View>
            </View>
          </View>
        </View>

        {draft.expertVerdicts.length > 0 ? (
          <View style={styles.threadList}>
            {draft.expertVerdicts.map((verdict) => (
              <View
                key={verdict.expertId}
                style={[styles.threadRow, { borderLeftColor: palette.mint }]}>
                <View style={styles.threadRowTop}>
                  <Text accessible={false} style={styles.threadEmoji}>
                    🎯
                  </Text>
                  <Text style={[typography.compact, styles.threadAuthor]}>{verdict.expertTitle}</Text>
                  <View style={styles.draftPill}>
                    <Text style={styles.draftPillText}>Expert</Text>
                  </View>
                </View>
                <TextInput
                  value={verdict.verdictLine}
                  onChangeText={(text) => updateExpertVerdict(verdict.expertId, { verdictLine: text })}
                  placeholder="Expert verdict line"
                  placeholderTextColor={placeholder}
                  multiline
                  style={[styles.threadBody, styles.editableField, { fontWeight: '700' }]}
                />
                <TextInput
                  value={verdict.reasoning}
                  onChangeText={(text) => updateExpertVerdict(verdict.expertId, { reasoning: text })}
                  placeholder="Expert reasoning"
                  placeholderTextColor={placeholder}
                  multiline
                  textAlignVertical="top"
                  style={[styles.threadBody, styles.editableField, { marginTop: 8, minHeight: 48 }]}
                />
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.communitySectionHeader}>
          <Text style={styles.communitySectionEyebrow}>Discussion</Text>
          <Text style={styles.communitySectionTitle}>Community responses</Text>
          <Text style={styles.communitySectionBody}>
            Read reactions to the AI decision, then add your own take beneath the side you support.
          </Text>
          <Text style={styles.communitySectionMeta}>
            {previewCount} {previewCount === 1 ? 'top-level note' : 'top-level notes'} · draft preview
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRail}
          contentContainerStyle={styles.filterRailContent}>
          <View style={[styles.filterChip, styles.filterChipOn]}>
            <Text style={[styles.filterChipText, styles.filterChipTextOn]}>All perspectives</Text>
          </View>
          {draft.pollOptions.map((option, idx) => (
            <View key={option.id} style={styles.filterChip}>
              <View style={[styles.filterStripe, { backgroundColor: TEAM_STRIPES[idx % TEAM_STRIPES.length] }]} />
              <Text style={styles.filterChipText} numberOfLines={1}>
                {option.label || 'Option'}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.threadList}>
          {draft.discussionPreview.map((line, index) => (
            <View
              key={`preview-${index}`}
              style={[styles.threadRow, { borderLeftColor: teamStripeColor(draft.pollOptions, draft.pollOptions[index % draft.pollOptions.length]?.id ?? aiLeanId) }]}>
              <View style={styles.threadRowTop}>
                <Text accessible={false} style={styles.threadEmoji}>
                  ✨
                </Text>
                <Text style={[typography.compact, styles.threadAuthor]}>Preview voice {index + 1}</Text>
                <Text style={styles.threadTime}>Draft</Text>
                <View style={styles.draftPill}>
                  <Text style={styles.draftPillText}>Edit</Text>
                </View>
              </View>
              <TextInput
                accessibilityLabel={`Discussion preview line ${index + 1}`}
                value={line}
                onChangeText={(text) => updateDiscussionPreviewLine(index, text)}
                placeholder="Teaser response peers might see on Explore"
                placeholderTextColor={placeholder}
                multiline
                textAlignVertical="top"
                style={[styles.threadBody, styles.editableField, { minHeight: 56 }]}
              />
            </View>
          ))}
        </View>

        {draft.discussionPreview.length < 4 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add discussion preview line"
            onPress={addDiscussionPreviewLine}
            style={({ pressed }) => [styles.addPreviewBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="add-circle-outline" size={18} color={palette.accent} />
            <Text style={styles.addPreviewText}>Add preview response</Text>
          </Pressable>
        ) : null}

        <View style={styles.composerSheet}>
          <Text style={styles.composerEyebrow}>Posting as · {aiLeanLabel ?? 'your side'}</Text>
          <TextInput
            accessibilityLabel="Sample first response preview"
            editable={false}
            multiline
            placeholder="After you post, peers will explain why they agree or disagree with the AI here."
            placeholderTextColor={placeholder}
            style={[styles.composerInput, { opacity: 0.72 }]}
          />
        </View>
      </ReelCardSurface>
    </View>
  );
}
