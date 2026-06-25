import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/ui/PrimaryButton';
import {
  InlineDistributionTrack,
  PollQuestionAccentBar,
  ReelCardActionBar,
  ReelCardSurface,
  RewardPointsGem,
  reelDiscussStyles,
  totalVotesFromDistribution,
} from '@/components/explore/ReelDiscussChrome';
import { discussCardStyles } from '@/components/decision/discussCardStyles';
import { palette, profileNeutralStroke, profileTypography, radius, spacing, typography } from '@/constants/theme';
import type { ExploreCard, TeamDiscussionPost } from '@shouldi/contracts';

const TEAM_STRIPES = [palette.accent, palette.mint, palette.playful, palette.accentBloom] as const;

function optionIndex(card: ExploreCard, optionId: string): number {
  const i = card.options.findIndex((o) => o.id === optionId);
  return i >= 0 ? i : 0;
}

function teamStripeColor(card: ExploreCard, optionId: string): string {
  return TEAM_STRIPES[optionIndex(card, optionId) % TEAM_STRIPES.length]!;
}

function optionLabel(card: ExploreCard, optionId: string): string {
  return card.options.find((o) => o.id === optionId)?.label ?? 'Team';
}

type DiscussExpandedProps = {
  card: ExploreCard;
  /** Pass-through from Explore reel selection (query param). */
  pickedOptionFromRoute?: string | null;
};

export function DiscussExpanded({ card, pickedOptionFromRoute }: DiscussExpandedProps) {
  const insets = useSafeAreaInsets();
  const isOpen = card.status === 'open';
  const voteTotal = totalVotesFromDistribution(card.distribution);
  const effectivePick = (pickedOptionFromRoute?.trim() || card.myVoteOptionId) ?? undefined;
  const hasResults = isOpen ? !!effectivePick : true;

  const [saved, setSaved] = React.useState(card.savedByMe ?? false);
  const [following, setFollowing] = React.useState(card.followedByMe ?? false);
  const [filterOptionId, setFilterOptionId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [localPosts, setLocalPosts] = React.useState<TeamDiscussionPost[]>([]);
  const [localReplies, setLocalReplies] = React.useState<TeamDiscussionPost[]>([]);
  const [userThumbUp, setUserThumbUp] = React.useState<Record<string, boolean>>({});
  const [aiReaction, setAiReaction] = React.useState<'agree' | 'disagree' | null>(null);
  const [replyingToId, setReplyingToId] = React.useState<string | null>(null);
  const [replyDraft, setReplyDraft] = React.useState('');
  const [threadModalRoot, setThreadModalRoot] = React.useState<TeamDiscussionPost | null>(null);

  const allDiscussionRows = React.useMemo(() => {
    const seed = card.discussionPosts ?? [];
    return [...localReplies, ...localPosts, ...seed];
  }, [card.discussionPosts, localPosts, localReplies]);

  const topLevelDiscussion = React.useMemo(
    () => allDiscussionRows.filter((p) => !p.parentId),
    [allDiscussionRows],
  );

  const filteredTopLevel = React.useMemo(() => {
    if (!filterOptionId) return topLevelDiscussion;
    return topLevelDiscussion.filter((p) => p.optionId === filterOptionId);
  }, [topLevelDiscussion, filterOptionId]);

  const grouped = React.useMemo(() => {
    const m = new Map<string, TeamDiscussionPost[]>();
    for (const o of card.options) m.set(o.id, []);
    for (const p of filteredTopLevel) {
      const arr = m.get(p.optionId);
      if (arr) arr.push(p);
      else m.set(p.optionId, [p]);
    }
    return card.options.map((o) => ({ option: o, posts: m.get(o.id) ?? [] }));
  }, [card.options, filteredTopLevel]);
  const aiSuggestedLabel = React.useMemo(
    () => (card.aiSuggestedOptionId ? optionLabel(card, card.aiSuggestedOptionId) : null),
    [card],
  );
  const aiSignalRows = React.useMemo(() => {
    const rows = [
      { label: 'Decision', value: card.question },
      { label: 'Current context', value: card.hook },
      { label: 'Core tradeoff', value: card.tension },
    ];
    if (effectivePick) rows.push({ label: 'Your choice', value: optionLabel(card, effectivePick) });
    if (card.matchHint) rows.push({ label: 'Pattern match', value: card.matchHint });
    return rows;
  }, [card.hook, card.matchHint, card.question, card.tension, effectivePick, card]);
  const aiDecisionHeadline =
    card.aiValidation?.verdictLine ?? (aiSuggestedLabel ? `Lean ${aiSuggestedLabel}` : 'AI decision summary');
  const aiDecisionReason =
    card.aiValidation?.verdictBecause ??
    card.aiSuggestionNote ??
    'The AI leaned on the situation, tradeoffs, and pattern match shown above.';
  const agreeCount = (card.aiValidation?.agreeWithAiVotes ?? 0) + (aiReaction === 'agree' ? 1 : 0);
  const disagreeCount = (card.aiValidation?.disagreeWithAiVotes ?? 0) + (aiReaction === 'disagree' ? 1 : 0);

  const getReplies = React.useCallback(
    (parentId: string) =>
      allDiscussionRows
        .filter((row) => row.parentId === parentId)
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id)),
    [allDiscussionRows],
  );

  const thumbCount = React.useCallback(
    (p: TeamDiscussionPost) => (p.upvoteCount ?? 0) + (userThumbUp[p.id] ? 1 : 0),
    [userThumbUp],
  );

  const toggleThumb = React.useCallback((postId: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    setUserThumbUp((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }, []);

  const submit = React.useCallback(() => {
    const body = draft.trim();
    if (!body || !effectivePick) return;
    const next: TeamDiscussionPost = {
      id: `you-${Date.now()}`,
      authorName: 'You',
      authorEmoji: '✨',
      optionId: effectivePick,
      body,
      timeLabel: 'Just now',
      upvoteCount: 0,
    };
    setLocalPosts((prev) => [next, ...prev]);
    setDraft('');
  }, [draft, effectivePick]);

  const submitReply = React.useCallback(
    (parent: TeamDiscussionPost) => {
      const body = replyDraft.trim();
      if (!body || body.length < 2 || !effectivePick) return;
      const reply: TeamDiscussionPost = {
        id: `you-re-${Date.now()}`,
        authorName: 'You',
        authorEmoji: '✨',
        optionId: parent.optionId,
        body,
        parentId: parent.id,
        timeLabel: 'Just now',
        upvoteCount: 0,
      };
      setLocalReplies((prev) => [reply, ...prev]);
      setReplyDraft('');
      setReplyingToId(null);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    },
    [replyDraft, effectivePick],
  );

  const cancelReply = React.useCallback(() => {
    setReplyingToId(null);
    setReplyDraft('');
  }, []);

  const onPressReplyTo = React.useCallback(
    (postId: string) => {
      if (replyingToId === postId) {
        cancelReply();
        return;
      }
      setReplyingToId(postId);
      setReplyDraft('');
      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync().catch(() => undefined);
      }
    },
    [replyingToId, cancelReply],
  );
  const onPressAiReaction = React.useCallback((next: 'agree' | 'disagree') => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    setAiReaction((curr) => (curr === next ? null : next));
  }, []);

  return (
    <View style={styles.wrap}>
      <ReelCardSurface category={card.category} isOpen={isOpen} layout="fullscreen" suppressAtmosphere>
        <ReelCardActionBar
          variant="discuss-top"
          voteSummary={{ voteTotal, isLivePoll: isOpen }}
          saved={saved}
          following={following}
          onToggleSave={() => setSaved((s) => !s)}
          onToggleFollow={() => setFollowing((f) => !f)}
          onLeadingBackPress={() => router.back()}
        />

        <View style={reelDiscussStyles.pollQuestionRow}>
          <View style={reelDiscussStyles.pollQuestionTextCol}>
            <View style={reelDiscussStyles.pollQuestionTitleRow}>
              <Text
                accessibilityRole="header"
                style={[
                  isOpen ? typography.hero : typography.h2,
                  reelDiscussStyles.pollQuestion,
                  reelDiscussStyles.pollQuestionHeadlineFlexible,
                  isOpen && reelDiscussStyles.pollQuestionOpen,
                  isOpen && reelDiscussStyles.pollHeroOpen,
                ]}>
                {card.question}
              </Text>
              <RewardPointsGem rewardPoints={card.rewardPoints} density="compact" />
            </View>
            <PollQuestionAccentBar />
          </View>
        </View>

        <View style={reelDiscussStyles.optionWrap}>
          {card.options.map((option) => {
            const votes = card.distribution.find((d) => d.optionId === option.id)?.votes ?? 0;
            const percentage = voteTotal > 0 ? Math.round((votes / voteTotal) * 100) : 0;
            const selected = effectivePick === option.id;
            const aiLeanHere = !!(hasResults && card.aiSuggestedOptionId && option.id === card.aiSuggestedOptionId);
            const pollBar = selected ? 'user' : aiLeanHere ? 'ai' : ('neutral' as const);
            const pickedSurfaceStyle =
              hasResults && selected && aiLeanHere
                ? reelDiscussStyles.optionPillUserAndAiPick
                : hasResults && selected && !aiLeanHere
                  ? reelDiscussStyles.optionPillUserPick
                  : hasResults && !selected && aiLeanHere
                    ? reelDiscussStyles.optionPillAiLeanOnly
                    : undefined;
            return (
              <View
                key={option.id}
                style={[reelDiscussStyles.optionPill, pickedSurfaceStyle]}>
                <View style={reelDiscussStyles.optionTopRow}>
                  <Text style={[reelDiscussStyles.optionText, selected && reelDiscussStyles.optionTextActive]}>
                    {option.label}
                  </Text>
                  <View style={reelDiscussStyles.optionMetaCluster}>
                    {selected && hasResults ? (
                      <View style={reelDiscussStyles.userPickBadge}>
                        <Text style={reelDiscussStyles.userPickBadgeText}>YOU</Text>
                      </View>
                    ) : null}
                    {aiLeanHere ? (
                      <View style={reelDiscussStyles.aiLeanBadge}>
                        <Text style={reelDiscussStyles.aiLeanBadgeText}>AI</Text>
                      </View>
                    ) : null}
                    {hasResults ? (
                      <Text style={[reelDiscussStyles.optionMeta, selected && reelDiscussStyles.optionMetaPicked]}>
                        {percentage}%
                        {selected ? (isOpen ? ' · You' : ' · Your side') : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {hasResults ? <InlineDistributionTrack percentage={percentage} emphasis={pollBar} /> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.summarySection}>
          <View style={styles.aiDecisionCard}>
            <View style={styles.aiDecisionHeaderRow}>
              <View style={styles.aiDecisionBadge}>
                <Text style={styles.aiDecisionBadgeText}>AI DECISION</Text>
              </View>
              {card.aiValidation?.confidenceScore != null ? (
                <View style={[
                  styles.confidencePill,
                  {
                    borderColor: card.aiValidation.confidenceScore >= 70
                      ? 'rgba(95,169,149,0.35)'
                      : card.aiValidation.confidenceScore >= 45
                        ? 'rgba(217,119,6,0.35)'
                        : 'rgba(220,38,38,0.30)',
                    backgroundColor: card.aiValidation.confidenceScore >= 70
                      ? 'rgba(228,248,240,0.92)'
                      : card.aiValidation.confidenceScore >= 45
                        ? 'rgba(255,243,220,0.92)'
                        : 'rgba(255,235,235,0.92)',
                  }
                ]}>
                  <View style={[
                    styles.confidenceDot,
                    {
                      backgroundColor: card.aiValidation.confidenceScore >= 70
                        ? '#5fa995'
                        : card.aiValidation.confidenceScore >= 45
                          ? '#d97706'
                          : '#dc2626',
                    }
                  ]} />
                  <Text style={[
                    styles.confidenceLabel,
                    {
                      color: card.aiValidation.confidenceScore >= 70
                        ? '#5fa995'
                        : card.aiValidation.confidenceScore >= 45
                          ? '#d97706'
                          : '#dc2626',
                    }
                  ]}>
                    {card.aiValidation.confidenceScore}% confidence
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.aiDecisionHeadline}>{aiDecisionHeadline}</Text>
            <Text style={styles.aiDecisionReason} numberOfLines={3}>{aiDecisionReason}</Text>

            {card.aiValidation?.keyContext && card.aiValidation.keyContext.length > 0 ? (
              <View style={styles.keyContextSection}>
                <Text style={styles.keyContextEyebrow}>Key context</Text>
                {card.aiValidation.keyContext.map((ctx, i) => (
                  <View key={i} style={[discussCardStyles.momentCard, { borderLeftWidth: 3, borderLeftColor: palette.accent }]}>
                    <Text style={discussCardStyles.momentOrdinal}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={discussCardStyles.momentCardTitle} numberOfLines={2}>{ctx}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.aiReactionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Agree with AI. ${agreeCount} agrees.`}
                accessibilityState={{ selected: aiReaction === 'agree' }}
                onPress={() => onPressAiReaction('agree')}
                style={({ pressed }) => [
                  styles.aiReactionPill,
                  aiReaction === 'agree' && styles.aiReactionPillAgreeOn,
                  pressed && styles.aiReactionPillPressed,
                ]}>
                <Ionicons
                  name={aiReaction === 'agree' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={16}
                  color={aiReaction === 'agree' ? palette.mint : profileTypography.subdued}
                />
                <Text style={[styles.aiReactionLabel, aiReaction === 'agree' && styles.aiReactionLabelOn]}>
                  Agree · {agreeCount}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Disagree with AI. ${disagreeCount} disagrees.`}
                accessibilityState={{ selected: aiReaction === 'disagree' }}
                onPress={() => onPressAiReaction('disagree')}
                style={({ pressed }) => [
                  styles.aiReactionPill,
                  aiReaction === 'disagree' && styles.aiReactionPillDisagreeOn,
                  pressed && styles.aiReactionPillPressed,
                ]}>
                <Ionicons
                  name={aiReaction === 'disagree' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={16}
                  color={aiReaction === 'disagree' ? palette.accent : profileTypography.subdued}
                />
                <Text style={[styles.aiReactionLabel, aiReaction === 'disagree' && styles.aiReactionLabelOn]}>
                  Disagree · {disagreeCount}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.communitySectionHeader}>
          <Text style={styles.communitySectionEyebrow}>Discussion</Text>
          <Text style={styles.communitySectionTitle}>Community responses</Text>
          <Text style={styles.communitySectionBody}>
            Read reactions to the AI decision, then add your own take beneath the side you support.
          </Text>
          <Text style={styles.communitySectionMeta}>
            {filteredTopLevel.length} {filteredTopLevel.length === 1 ? 'top-level note' : 'top-level notes'}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRail} contentContainerStyle={styles.filterRailContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filterOptionId === null }}
            onPress={() => setFilterOptionId(null)}
            style={[styles.filterChip, filterOptionId === null && styles.filterChipOn]}>
            <Text style={[styles.filterChipText, filterOptionId === null && styles.filterChipTextOn]}>All perspectives</Text>
          </Pressable>
          {card.options.map((o, idx) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityState={{ selected: filterOptionId === o.id }}
              onPress={() => setFilterOptionId(filterOptionId === o.id ? null : o.id)}
              style={[styles.filterChip, filterOptionId === o.id && styles.filterChipOn]}>
              <View style={[styles.filterStripe, { backgroundColor: TEAM_STRIPES[idx % TEAM_STRIPES.length] }]} />
              <Text
                style={[styles.filterChipText, filterOptionId === o.id && styles.filterChipTextOn]}
                numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {!effectivePick ? (
          <View style={styles.needVoteCallout}>
            <Text style={styles.needVoteTitle}>
              {isOpen ? 'Choose a side before you post' : 'Join the discussion with a stance'}
            </Text>
            <Text style={styles.needVoteBody}>
              {isOpen
                ? 'Your vote decides which side your response appears under. Head back to Explore, tap an option, then reopen Discuss.'
                : 'Every note here is tagged by the side it supports. To add your response under the right team, return to the reel, tap the stance you identify with, then open Discuss again.'}
            </Text>
          </View>
        ) : (
          <>
            {grouped.map(({ option, posts }) => {
              if (posts.length === 0) return null;
              const stripe = teamStripeColor(card, option.id);
              const voiceCount = allDiscussionRows.filter((p) => p.optionId === option.id).length;
              return (
                <View key={option.id} style={styles.teamBlock}>
                  <View style={styles.teamBlockHeader}>
                    <View style={[styles.teamBadge, { borderColor: stripe }]}>
                      <View style={[styles.teamBadgeDot, { backgroundColor: stripe }]} />
                      <Text style={styles.teamBadgeText}>{option.label}</Text>
                      <Text style={styles.teamBadgeMeta}>
                        {voiceCount} {voiceCount === 1 ? 'response' : 'responses'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.threadList}>
                    {posts.map((p) => (
                      <DiscussionPostCard
                        key={p.id}
                        post={p}
                        depth={0}
                        card={card}
                        surface="feed"
                        getReplies={getReplies}
                        thumbCount={thumbCount}
                        toggleThumb={toggleThumb}
                        isThumbSelected={(id) => !!userThumbUp[id]}
                        replyingToId={replyingToId}
                        onToggleReplyComposer={onPressReplyTo}
                        onOpenFullThread={setThreadModalRoot}
                        replyDraft={replyDraft}
                        setReplyDraft={setReplyDraft}
                        submitReply={submitReply}
                        cancelReply={cancelReply}
                        replyEnabled={!!effectivePick}
                      />
                    ))}
                  </View>
                </View>
              );
            })}

            {filteredTopLevel.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No responses in this slice yet</Text>
                <Text style={styles.emptySubtitle}>Broaden the filter or be the first to explain why you agree or disagree.</Text>
              </View>
            ) : null}

            <View style={styles.composerSheet}>
              <Text style={styles.composerEyebrow}>
                {effectivePick
                  ? `Posting as · ${optionLabel(card, effectivePick)}`
                  : 'Join this discussion'}
              </Text>
              <TextInput
                accessibilityLabel={
                  effectivePick
                    ? `Write a response for ${optionLabel(card, effectivePick)}`
                    : 'Discussion composer disabled until you vote'
                }
                style={styles.input}
                multiline
                editable={!!effectivePick}
                placeholder={
                  effectivePick
                    ? 'Explain why you agree or disagree with the AI, and share what happened in your own experience.'
                    : 'Vote on Explore to unlock posting…'
                }
                placeholderTextColor={profileTypography.subdued}
                value={draft}
                onChangeText={setDraft}
                maxLength={2000}
              />
              <PrimaryButton
                accessibilityLabel="Publish discussion comment"
                style={styles.postBtn}
                disabled={!effectivePick || draft.trim().length < 4}
                onPress={submit}>
                <Text style={styles.postBtnLabel}>Share response</Text>
              </PrimaryButton>
            </View>
          </>
        )}
      </ReelCardSurface>

      <Modal
        visible={threadModalRoot != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setThreadModalRoot(null)}>
        {threadModalRoot ? (
          <View style={[styles.threadModalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.threadModalHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close thread"
                hitSlop={12}
                onPress={() => setThreadModalRoot(null)}
                style={({ pressed }) => [styles.threadModalClose, pressed && styles.threadModalClosePressed]}>
                <Text style={styles.threadModalCloseText}>Close</Text>
              </Pressable>
              <Text style={styles.threadModalTitle} numberOfLines={2}>
                {threadModalRoot.body.split('\n')[0]?.trim().slice(0, 120) || 'Thread'}
              </Text>
              <View style={styles.threadModalHeaderSpacer} />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.threadModalScrollContent}
              showsVerticalScrollIndicator={false}>
              <DiscussionPostCard
                post={threadModalRoot}
                depth={0}
                card={card}
                surface="fullscreen"
                getReplies={getReplies}
                thumbCount={thumbCount}
                toggleThumb={toggleThumb}
                isThumbSelected={(id) => !!userThumbUp[id]}
                replyingToId={replyingToId}
                onToggleReplyComposer={onPressReplyTo}
                replyDraft={replyDraft}
                setReplyDraft={setReplyDraft}
                submitReply={submitReply}
                cancelReply={cancelReply}
                replyEnabled={!!effectivePick}
              />
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const MAX_THREAD_DEPTH = 32;

function countThreadReplies(postId: string, getReplies: (parentId: string) => TeamDiscussionPost[]): number {
  const direct = getReplies(postId);
  return direct.reduce((sum, child) => sum + 1 + countThreadReplies(child.id, getReplies), 0);
}

function formatThumbDisplay(n: number): string {
  const v = Math.max(0, n);
  if (v < 1000) return String(v);
  const k = v / 1000;
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}

type DiscussionSurface = 'feed' | 'fullscreen';

type DiscussionPostCardProps = Readonly<{
  post: TeamDiscussionPost;
  depth: number;
  card: ExploreCard;
  surface?: DiscussionSurface;
  getReplies: (parentId: string) => TeamDiscussionPost[];
  thumbCount: (p: TeamDiscussionPost) => number;
  toggleThumb: (postId: string) => void;
  isThumbSelected: (postId: string) => boolean;
  replyingToId: string | null;
  onToggleReplyComposer: (postId: string) => void;
  /** Opens fullscreen thread for this root post (feed only). */
  onOpenFullThread?: (post: TeamDiscussionPost) => void;
  replyDraft: string;
  setReplyDraft: (text: string) => void;
  submitReply: (parent: TeamDiscussionPost) => void;
  cancelReply: () => void;
  replyEnabled: boolean;
}>;

function DiscussionPostCard({
  post,
  depth,
  card,
  surface = 'feed',
  getReplies,
  thumbCount,
  toggleThumb,
  isThumbSelected,
  replyingToId,
  onToggleReplyComposer,
  onOpenFullThread,
  replyDraft,
  setReplyDraft,
  submitReply,
  cancelReply,
  replyEnabled,
}: DiscussionPostCardProps) {
  const stripe = teamStripeColor(card, post.optionId);
  const isYou = post.authorName === 'You';
  const replies = getReplies(post.id);
  const threadReplyTotal = React.useMemo(
    () => (depth === 0 ? countThreadReplies(post.id, getReplies) : 0),
    [depth, post.id, getReplies],
  );
  const n = thumbCount(post);
  const liked = isThumbSelected(post.id);
  const composerOpen = replyingToId === post.id && replyEnabled;
  const canSendReply = replyDraft.trim().length >= 2;

  return (
    <View style={depth > 0 ? styles.threadBranch : undefined}>
      <View style={[styles.threadRow, depth > 0 && styles.threadRowNested, { borderLeftColor: stripe }]}>
        <View style={styles.threadRowTop}>
          <Text accessible={false} style={styles.threadEmoji}>
            {post.authorEmoji}
          </Text>
          <Text style={[typography.compact, styles.threadAuthor]}>{post.authorName}</Text>
          {depth > 0 ? (
            <View style={styles.depthReplyBadge}>
              <Text style={styles.depthReplyBadgeText}>Reply</Text>
            </View>
          ) : null}
          {post.timeLabel ? <Text style={styles.threadTime}>{post.timeLabel}</Text> : null}
          {isYou ? (
            <View style={styles.youPill}>
              <Text style={styles.youPillText}>Your post</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.threadBody}>{post.body}</Text>

        <View style={styles.threadActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={liked ? `Remove helpful. ${formatThumbDisplay(n)} helpful votes.` : `Mark helpful. ${formatThumbDisplay(n)} helpful votes.`}
            accessibilityState={{ selected: liked }}
            onPress={() => toggleThumb(post.id)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={({ pressed }) => [
              styles.actionPill,
              liked && styles.actionPillSelected,
              pressed && styles.actionPillPressed,
            ]}>
            <Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={17} color={liked ? palette.accent : profileTypography.subdued} />
            <Text style={[styles.actionPillLabel, liked && styles.actionPillLabelOn]}>{formatThumbDisplay(n)}</Text>
          </Pressable>

          {replyEnabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={composerOpen ? 'Close reply composer' : `Reply to ${post.authorName}`}
              accessibilityState={{ selected: composerOpen }}
              onPress={() => onToggleReplyComposer(post.id)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={({ pressed }) => [
                styles.replyPill,
                composerOpen && styles.replyPillOn,
                pressed && styles.replyPillPressed,
              ]}>
              <Ionicons name="return-down-forward-outline" size={16} color={composerOpen ? palette.accent : profileTypography.subdued} />
              <Text style={[styles.replyPillText, composerOpen && styles.replyPillTextOn]}>{composerOpen ? 'Close' : 'Reply'}</Text>
            </Pressable>
          ) : null}
        </View>

        {surface === 'feed' && depth === 0 && threadReplyTotal > 0 && onOpenFullThread ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View full thread, ${threadReplyTotal} replies`}
            onPress={() => onOpenFullThread(post)}
            style={({ pressed }) => [styles.viewThreadBar, pressed && styles.viewThreadBarPressed]}
            hitSlop={{ top: 4, bottom: 6 }}>
            <Ionicons name="chatbubbles-outline" size={17} color={palette.accent} />
            <Text style={styles.viewThreadBarLabel}>
              View full thread · {threadReplyTotal} {threadReplyTotal === 1 ? 'reply' : 'replies'}
            </Text>
            <Ionicons name="chevron-forward" size={17} color={profileTypography.subdued} />
          </Pressable>
        ) : null}

        {composerOpen ? (
          <View style={styles.inlineReplyComposer}>
            <TextInput
              accessibilityLabel={`Reply to ${post.authorName}`}
              placeholder={`Reply to ${post.authorName}…`}
              placeholderTextColor={profileTypography.subdued}
              style={styles.inlineReplyInput}
              multiline
              value={replyDraft}
              onChangeText={setReplyDraft}
              maxLength={1500}
              textAlignVertical="top"
            />
            <View style={styles.inlineReplyActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={cancelReply} style={styles.inlineReplyGhostHit}>
                <Text style={styles.inlineReplyGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send reply"
                disabled={!canSendReply}
                onPress={() => submitReply(post)}
                style={({ pressed }) => [
                  styles.inlineReplyPrimary,
                  !canSendReply && styles.inlineReplyPrimaryDisabled,
                  canSendReply && pressed && styles.inlineReplyPrimaryPressed,
                ]}>
                <Text style={styles.inlineReplyPrimaryText}>Send</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {depth < MAX_THREAD_DEPTH
          ? replies.map((child) => (
            <DiscussionPostCard
              key={child.id}
              post={child}
              depth={depth + 1}
              card={card}
              surface={surface}
              getReplies={getReplies}
              thumbCount={thumbCount}
              toggleThumb={toggleThumb}
              isThumbSelected={isThumbSelected}
              replyingToId={replyingToId}
              onToggleReplyComposer={onToggleReplyComposer}
              onOpenFullThread={undefined}
              replyDraft={replyDraft}
              setReplyDraft={setReplyDraft}
              submitReply={submitReply}
              cancelReply={cancelReply}
              replyEnabled={replyEnabled}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  summarySection: {
    marginTop: 18,
    gap: 14,
  },
  summaryEyebrow: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  summaryTitle: {
    ...typography.h2,
    color: profileTypography.ink,
    fontWeight: '800',
    letterSpacing: -0.45,
    paddingHorizontal: 2,
  },
  summaryCard: {
    gap: 0,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.08),
    backgroundColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  summaryRow: {
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  summaryRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: profileNeutralStroke(0.08),
  },
  summaryRowLabel: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  summaryRowValue: {
    ...typography.compact,
    color: profileTypography.body,
    lineHeight: 20,
    fontWeight: '500',
  },
  aiDecisionCard: {
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.neonPink}28`,
    borderLeftWidth: 4,
    borderLeftColor: '#0f172a',
    backgroundColor: 'rgba(255,253,255,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: palette.heroInk,
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  aiDecisionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  aiDecisionBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#0f172a',
  },
  aiDecisionBadgeText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: palette.white,
  },
  aiDecisionPick: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '600',
    letterSpacing: 0.12,
    flex: 1,
  },
  aiDecisionHeadline: {
    ...typography.h2,
    color: profileTypography.ink,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 24,
    fontSize: 17,
  },
  aiDecisionReason: {
    ...typography.compact,
    color: profileTypography.body,
    lineHeight: 21,
    fontWeight: '500',
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  keyContextSection: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: profileNeutralStroke(0.08),
    gap: 8,
  },
  keyContextEyebrow: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  keyContextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  keyContextDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  keyContextText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: profileTypography.body,
  },
  aiReactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  aiReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.1),
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  aiReactionPillAgreeOn: {
    borderColor: 'rgba(95,169,149,0.35)',
    backgroundColor: 'rgba(228,248,240,0.92)',
  },
  aiReactionPillDisagreeOn: {
    borderColor: 'rgba(79,118,194,0.35)',
    backgroundColor: 'rgba(230,238,255,0.92)',
  },
  aiReactionPillPressed: {
    opacity: 0.9,
  },
  aiReactionLabel: {
    ...typography.caption,
    color: profileTypography.body,
    fontWeight: '800',
  },
  aiReactionLabelOn: {
    color: profileTypography.ink,
  },
  workflowHeader: {
    gap: 6,
    paddingHorizontal: 2,
  },
  workflowEyebrow: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  workflowTitle: {
    ...typography.h2,
    color: profileTypography.ink,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  workflowBody: {
    ...typography.compact,
    color: profileTypography.emphasis,
    lineHeight: 20,
    fontWeight: '500',
  },
  stageStack: {
    gap: 12,
  },
  stageCard: {
    gap: 10,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.08),
    backgroundColor: 'rgba(255,255,255,0.86)',
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  stageBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(79,118,194,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,118,194,0.26)',
  },
  stageBadgeMint: {
    backgroundColor: 'rgba(95,169,149,0.14)',
    borderColor: 'rgba(95,169,149,0.28)',
  },
  stageBadgeText: {
    ...typography.caption,
    color: profileTypography.body,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  stageTitle: {
    ...typography.compact,
    color: profileTypography.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  stageBody: {
    ...typography.compact,
    color: profileTypography.body,
    lineHeight: 20,
    fontWeight: '500',
  },
  signalChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  signalChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(227,236,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,118,194,0.16)',
  },
  signalChipSoft: {
    backgroundColor: 'rgba(241,246,255,0.92)',
  },
  signalChipText: {
    ...typography.caption,
    color: profileTypography.body,
    fontWeight: '700',
  },
  stageMiniLabel: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  audienceChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  audienceChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.08),
  },
  audienceChipText: {
    ...typography.caption,
    color: profileTypography.emphasis,
    fontWeight: '700',
  },
  stageFootnote: {
    ...typography.caption,
    color: profileTypography.subdued,
    lineHeight: 17,
    fontWeight: '600',
  },
  spotlightShell: {
    gap: 10,
  },
  spotlightEyebrow: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  spotlightRailContent: {
    paddingRight: spacing.sm,
    gap: 10,
  },
  spotlightCard: {
    width: 204,
    minHeight: 124,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.08),
    gap: 8,
  },
  spotlightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spotlightEmoji: {
    fontSize: 16,
  },
  spotlightAuthor: {
    ...typography.compact,
    color: profileTypography.body,
    fontWeight: '800',
    flex: 1,
  },
  spotlightBody: {
    ...typography.compact,
    color: profileTypography.body,
    lineHeight: 19,
    fontWeight: '500',
  },
  spotlightLane: {
    ...typography.caption,
    color: palette.accent,
    fontWeight: '700',
  },
  communitySectionHeader: {
    marginTop: 18,
    gap: 5,
    paddingHorizontal: 2,
  },
  communitySectionEyebrow: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  communitySectionTitle: {
    ...typography.h2,
    color: profileTypography.ink,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  communitySectionBody: {
    ...typography.compact,
    color: profileTypography.emphasis,
    lineHeight: 20,
    fontWeight: '500',
  },
  communitySectionMeta: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '700',
  },
  filterRail: {
    marginTop: 14,
    marginBottom: 2,
    flexGrow: 0,
  },
  filterRailContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: spacing.sm,
    gap: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.09),
    backgroundColor: 'rgba(255,255,255,0.82)',
    maxWidth: 220,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.035,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  filterChipOn: {
    borderColor: 'rgba(79,118,194,0.5)',
    backgroundColor: 'rgba(227,236,255,0.95)',
    ...Platform.select({
      ios: {
        shadowColor: palette.accent,
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  filterChipText: {
    ...typography.compact,
    color: profileTypography.emphasis,
    fontWeight: '600',
    flexShrink: 1,
  },
  filterChipTextOn: {
    color: palette.accent,
  },
  filterStripe: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 2,
    flexShrink: 0,
  },
  teamBlock: {
    marginTop: 16,
    gap: 8,
  },
  teamBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.84)',
    maxWidth: '100%',
    flexShrink: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.03,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  teamBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  teamBadgeText: {
    ...typography.compact,
    fontWeight: '700',
    color: profileTypography.body,
    flexShrink: 1,
  },
  teamBadgeMeta: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '600',
    marginLeft: 4,
  },
  threadList: {
    gap: 10,
  },
  threadRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 15,
    borderLeftWidth: 4,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.06),
    ...Platform.select({
      ios: {
        shadowColor: profileTypography.ink,
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  threadRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  threadEmoji: {
    fontSize: 16,
  },
  threadAuthor: {
    fontWeight: '700',
    color: profileTypography.body,
    flexShrink: 1,
  },
  threadTime: {
    ...typography.caption,
    color: profileTypography.subdued,
    marginLeft: 4,
    fontWeight: '600',
  },
  youPill: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(95,169,149,0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(95,169,149,0.35)',
  },
  youPillText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    color: palette.mint,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  threadBody: {
    ...typography.body,
    color: profileTypography.body,
    fontWeight: '400',
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  threadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.08),
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  actionPillSelected: {
    borderColor: 'rgba(79,118,194,0.45)',
    backgroundColor: 'rgba(230,238,255,0.85)',
  },
  actionPillPressed: {
    opacity: 0.88,
  },
  actionPillLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: profileTypography.subdued,
    minWidth: 16,
  },
  actionPillLabelOn: {
    color: palette.accent,
  },
  replyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.08),
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  replyPillOn: {
    borderColor: 'rgba(79,118,194,0.35)',
    backgroundColor: 'rgba(233,239,255,0.75)',
  },
  replyPillPressed: {
    opacity: 0.9,
  },
  replyPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: profileTypography.subdued,
  },
  replyPillTextOn: {
    color: palette.accent,
  },
  threadBranch: {
    marginTop: 6,
    marginLeft: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: profileNeutralStroke(0.06),
  },
  threadRowNested: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  depthReplyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: profileNeutralStroke(0.05),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.06),
  },
  depthReplyBadgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    color: profileTypography.subdued,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  inlineReplyComposer: {
    marginTop: 12,
    gap: 10,
  },
  inlineReplyInput: {
    minHeight: 72,
    maxHeight: 140,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,118,194,0.22)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 11,
    ...typography.compact,
    color: profileTypography.body,
  },
  inlineReplyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  inlineReplyGhostHit: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  inlineReplyGhostText: {
    ...typography.compact,
    fontWeight: '700',
    color: profileTypography.subdued,
  },
  inlineReplyPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.heroInk,
  },
  inlineReplyPrimaryDisabled: {
    opacity: 0.38,
  },
  inlineReplyPrimaryPressed: {
    opacity: 0.9,
  },
  inlineReplyPrimaryText: {
    ...typography.compact,
    fontWeight: '800',
    color: palette.white,
  },
  viewThreadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 11,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: radius.md,
    backgroundColor: 'rgba(227,236,255,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,118,194,0.18)',
  },
  viewThreadBarPressed: {
    opacity: 0.9,
    backgroundColor: 'rgba(210,226,255,0.75)',
  },
  viewThreadBarLabel: {
    flex: 1,
    ...typography.compact,
    fontWeight: '700',
    color: profileTypography.emphasis,
    minWidth: 0,
  },
  threadModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(253,251,247,0.98)',
  },
  threadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: profileNeutralStroke(0.08),
  },
  threadModalClose: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 64,
  },
  threadModalClosePressed: {
    opacity: 0.65,
  },
  threadModalCloseText: {
    ...typography.compact,
    fontWeight: '800',
    color: palette.accent,
  },
  threadModalTitle: {
    flex: 1,
    ...typography.caption,
    fontWeight: '700',
    color: profileTypography.body,
    textAlign: 'center',
    minWidth: 0,
  },
  threadModalHeaderSpacer: {
    minWidth: 64,
  },
  threadModalScrollContent: {
    paddingHorizontal: spacing.sm,
    paddingTop: 14,
    paddingBottom: spacing.lg,
  },
  emptyCard: {
    marginTop: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.07),
  },
  emptyTitle: {
    ...typography.compact,
    fontWeight: '700',
    color: profileTypography.body,
  },
  emptySubtitle: {
    ...typography.caption,
    color: profileTypography.subdued,
    lineHeight: 17,
    fontWeight: '500',
  },
  composerSheet: {
    marginTop: 22,
    paddingTop: 18,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    marginHorizontal: -spacing.sm,
    marginBottom: 4,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: profileNeutralStroke(0.07),
    borderRadius: radius.lg,
    backgroundColor: 'rgba(253,251,247,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
    ...Platform.select({
      ios: {
        shadowColor: profileTypography.ink,
        shadowOpacity: 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  composerEyebrow: {
    ...typography.caption,
    color: profileTypography.body,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 96,
    maxHeight: 168,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.09),
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 13,
    ...typography.body,
    color: profileTypography.body,
    textAlignVertical: 'top',
  },
  postBtn: {
    alignSelf: 'stretch',
    marginBottom: spacing.xs,
  },
  postBtnLabel: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  needVoteCallout: {
    marginTop: 18,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,118,194,0.18)',
    ...Platform.select({
      ios: {
        shadowColor: palette.accent,
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  needVoteTitle: {
    ...typography.compact,
    fontWeight: '800',
    color: profileTypography.body,
  },
  needVoteBody: {
    ...typography.caption,
    color: profileTypography.emphasis,
    lineHeight: 18,
    fontWeight: '500',
  },
});
