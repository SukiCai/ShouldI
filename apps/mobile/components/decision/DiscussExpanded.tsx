import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import JumpUpSheet from '@/components/ui/JumpUpSheet';
import { useColorScheme } from '@/components/useColorScheme';
import { discussCardColors, discussCardStyles } from '@/components/decision/discussCardStyles';
import { pmfText, usePmfSurface } from '@/components/screen/pmfChrome';
import { updateWatching } from '@/lib/exploreUserActivity';
import { palette, profileNeutralStroke, radius, semantic, spacing, themeSurface, typography, type ThemeSurface } from '@/constants/theme';
import type { ExploreCard, TeamDiscussionPost } from '@shouldi/contracts';

const TEAM_STRIPES = ['#5a6b84', '#6f7f97', '#8b97ab', '#a2adbf'] as const;

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

function teamTagLabel(card: ExploreCard, optionId: string): string {
  const idx = optionIndex(card, optionId);
  return idx % 2 === 0 ? '红队' : '蓝队';
}

type DiscussExpandedProps = {
  card: ExploreCard;
  /** Pass-through from Explore reel selection (query param). */
  pickedOptionFromRoute?: string | null;
  /** Optional explicit selected option from host screen state. */
  pickedOptionOverride?: string | null;
  /** Optional vote distribution override keyed by option id. */
  distributionOverride?: Record<string, number>;
  /** Host-provided close handler (for in-place modal usage). */
  onRequestClose?: () => void;
  /** Host-provided vote selection callback. */
  onSelectOption?: (optionId: string) => void;
};

type CommentSortMode = 'liked' | 'latest';

export function DiscussExpanded({
  card,
  pickedOptionFromRoute,
  pickedOptionOverride,
  distributionOverride,
  onRequestClose,
  onSelectOption,
}: DiscussExpandedProps) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();
  const cardColors = discussCardColors(surface);
  const text = pmfText(surface);
  const styles = React.useMemo(() => discussExpandedStyles(surface), [surface]);
  const isOpen = card.status === 'open';
  const mergedDistribution = React.useMemo(
    () => card.options.map((option) => ({ optionId: option.id, votes: distributionOverride?.[option.id] ?? card.distribution.find((d) => d.optionId === option.id)?.votes ?? 0 })),
    [card, distributionOverride],
  );
  const voteTotal = mergedDistribution.reduce((sum, row) => sum + row.votes, 0);
  const effectivePick = (pickedOptionOverride?.trim() || pickedOptionFromRoute?.trim() || card.myVoteOptionId) ?? undefined;
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
  const [composerModalVisible, setComposerModalVisible] = React.useState(false);
  const [commentSortMode, setCommentSortMode] = React.useState<CommentSortMode>('liked');
  const [sortSheetVisible, setSortSheetVisible] = React.useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = React.useState(false);

  const allDiscussionRows = React.useMemo(() => {
    const seed = card.discussionPosts ?? [];
    return [...localReplies, ...localPosts, ...seed];
  }, [card.discussionPosts, localPosts, localReplies]);

  const topLevelDiscussion = React.useMemo(
    () => allDiscussionRows.filter((p) => !p.parentId),
    [allDiscussionRows],
  );

  const filteredTopLevel = React.useMemo(() => {
    const scoped = filterOptionId
      ? topLevelDiscussion.filter((p) => p.optionId === filterOptionId)
      : topLevelDiscussion;
    if (commentSortMode === 'latest') return scoped;
    return scoped
      .slice()
      .sort((a, b) => (b.upvoteCount ?? 0) - (a.upvoteCount ?? 0));
  }, [topLevelDiscussion, filterOptionId, commentSortMode]);

  const composerInputRef = React.useRef<TextInput>(null);
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
    setComposerModalVisible(false);
  }, [draft, effectivePick]);

  React.useEffect(() => {
    if (!composerModalVisible) return;
    const timer = setTimeout(() => composerInputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [composerModalVisible]);

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
      <View style={[styles.screenCard, { backgroundColor: surface.canvas }]}>
        <View style={styles.topBar}>
          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove saved' : 'Save this decision'}
              onPress={() =>
                setSaved((current) => {
                  const next = !current;
                  updateWatching(card, { saved: next, followed: following });
                  return next;
                })
              }
              style={({ pressed }) => [styles.topIconBtn, styles.topIconBtnSecondary, { borderColor: surface.groupedBorder }, pressed && styles.topIconBtnPressed]}>
              <Ionicons name={saved ? 'star' : 'star-outline'} size={18} color={saved ? semantic.actionPrimary : surface.textMuted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={following ? 'Stop following updates' : 'Follow updates'}
              onPress={() =>
                setFollowing((current) => {
                  const next = !current;
                  updateWatching(card, { saved, followed: next });
                  return next;
                })
              }
              style={({ pressed }) => [styles.topIconBtn, styles.topIconBtnSecondary, { borderColor: surface.groupedBorder }, pressed && styles.topIconBtnPressed]}>
              <Ionicons name={following ? 'notifications' : 'notifications-outline'} size={18} color={following ? semantic.actionPrimary : surface.textMuted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close detail"
              onPress={() => (onRequestClose ? onRequestClose() : router.back())}
              style={({ pressed }) => [styles.topIconBtn, styles.topCloseBtn, pressed && styles.topIconBtnPressed]}>
              <Ionicons name="close" size={18} color={surface.textPrimary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.questionBlock}>
          <Text style={[styles.questionEyebrow, { color: surface.textMuted }]}>Decision</Text>
          <Text style={[styles.questionHeadline, { color: surface.textPrimary }]}>{card.question}</Text>
        </View>

        <View style={styles.optionsWrap}>
          {card.options.map((option) => {
            const votes = mergedDistribution.find((d) => d.optionId === option.id)?.votes ?? 0;
            const percentage = voteTotal > 0 ? Math.round((votes / voteTotal) * 100) : 0;
            const selected = effectivePick === option.id;
            const aiLeanHere = !!(hasResults && card.aiSuggestedOptionId && option.id === card.aiSuggestedOptionId);
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`Vote for ${option.label}`}
                disabled={!onSelectOption || !isOpen}
                onPress={() => onSelectOption?.(option.id)}
                style={({ pressed }) => [
                  styles.optionRow,
                  { borderColor: surface.groupedBorder, backgroundColor: surface.groupedSurface },
                  selected && styles.optionRowSelected,
                  pressed && styles.optionVoteTapPressed,
                ]}>
                <View style={styles.optionRowTop}>
                  <Text style={[styles.optionRowLabel, { color: surface.textPrimary }]}>{option.label}</Text>
                  <Text style={[styles.optionRowPct, { color: surface.textMuted }]}>
                    {`${percentage}%${selected ? ' · you' : ''}${aiLeanHere ? ' · ai' : ''}`}
                  </Text>
                </View>
                <View style={[styles.optionTrack, { backgroundColor: surface.hairline }]}>
                  <View
                    style={[
                      styles.optionFill,
                      { width: `${Math.max(3, percentage)}%`, backgroundColor: selected ? semantic.actionPrimary : aiLeanHere ? semantic.actionAffirm : surface.textMuted },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.summarySection}>
          <View
            style={[
              styles.aiDecisionCard,
              { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder },
              !hasResults && styles.secondarySectionMuted,
            ]}>
            <View style={styles.aiDecisionHeaderRow}>
                <Text style={[styles.aiSectionLabel, { color: surface.textMuted }]}>AI recommendation</Text>
              {card.aiValidation?.confidenceScore != null ? (
                <View
                  style={[
                    styles.confidencePill,
                    {
                      borderColor:
                        card.aiValidation.confidenceScore >= 70
                          ? 'rgba(95,169,149,0.35)'
                          : card.aiValidation.confidenceScore >= 45
                            ? 'rgba(217,119,6,0.35)'
                            : 'rgba(220,38,38,0.30)',
                      backgroundColor:
                        card.aiValidation.confidenceScore >= 70
                          ? 'rgba(228,248,240,0.92)'
                          : card.aiValidation.confidenceScore >= 45
                            ? 'rgba(255,243,220,0.92)'
                            : 'rgba(255,235,235,0.92)',
                    },
                  ]}>
                  <View
                    style={[
                      styles.confidenceDot,
                      {
                        backgroundColor:
                          card.aiValidation.confidenceScore >= 70
                            ? '#5fa995'
                            : card.aiValidation.confidenceScore >= 45
                              ? '#d97706'
                              : '#dc2626',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.confidenceLabel,
                      {
                        color:
                          card.aiValidation.confidenceScore >= 70
                            ? '#5fa995'
                            : card.aiValidation.confidenceScore >= 45
                              ? '#d97706'
                              : '#dc2626',
                      },
                    ]}>
                    {card.aiValidation.confidenceScore}% confidence
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.aiDecisionHeadline, { color: surface.textPrimary }]}>{aiDecisionHeadline}</Text>

            {card.aiValidation?.keyContext && card.aiValidation.keyContext.length > 0 ? (
              <View style={styles.keyContextSection}>
                <Text style={[styles.keyContextEyebrow, { color: surface.textMuted }]}>Key context</Text>
                {card.aiValidation.keyContext.slice(0, hasResults ? 3 : 2).map((ctx, i) => (
                  <View key={i} style={[discussCardStyles.momentCard, { borderLeftWidth: 3, borderLeftColor: semantic.actionPrimary }]}>
                    <Text style={discussCardStyles.momentOrdinal}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={discussCardStyles.momentCardTitle} numberOfLines={2}>
                      {ctx}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={[styles.aiDecisionReason, { color: surface.textMuted }]} numberOfLines={hasResults ? 4 : 2}>
              {aiDecisionReason}
            </Text>
            {!hasResults ? (
              <Text style={[styles.secondaryHint, { color: surface.textMuted }]}>Cast your vote to unlock full AI reasoning and interaction.</Text>
            ) : null}

            <View style={styles.aiReactionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Agree with AI. ${agreeCount} agrees.`}
                accessibilityState={{ selected: aiReaction === 'agree' }}
                disabled={!hasResults}
                onPress={() => onPressAiReaction('agree')}
                style={({ pressed }) => [
                  styles.aiReactionPill,
                  aiReaction === 'agree' && styles.aiReactionPillAgreeOn,
                  pressed && styles.aiReactionPillPressed,
                  !hasResults && styles.disabledPill,
                ]}>
                <Ionicons
                  name={aiReaction === 'agree' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={16}
                  color={aiReaction === 'agree' ? palette.mint : surface.textMuted}
                />
                <Text style={[styles.aiReactionLabel, aiReaction === 'agree' && styles.aiReactionLabelOn]}>Agree · {agreeCount}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Disagree with AI. ${disagreeCount} disagrees.`}
                accessibilityState={{ selected: aiReaction === 'disagree' }}
                disabled={!hasResults}
                onPress={() => onPressAiReaction('disagree')}
                style={({ pressed }) => [
                  styles.aiReactionPill,
                  aiReaction === 'disagree' && styles.aiReactionPillDisagreeOn,
                  pressed && styles.aiReactionPillPressed,
                  !hasResults && styles.disabledPill,
                ]}>
                <Ionicons
                  name={aiReaction === 'disagree' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={16}
                  color={aiReaction === 'disagree' ? semantic.actionPrimary : surface.textMuted}
                />
                <Text style={[styles.aiReactionLabel, aiReaction === 'disagree' && styles.aiReactionLabelOn]}>Disagree · {disagreeCount}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.commentsDividerWrap, !hasResults && styles.secondarySectionMuted]}>
          <View style={styles.commentsMetaRow}>
            <Text style={styles.commentsDividerMeta}>
              {filteredTopLevel.length} {filteredTopLevel.length === 1 ? 'comment' : 'comments'}
            </Text>
            <View style={styles.commentControlRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Comment sorting options"
                onPress={() => setSortSheetVisible(true)}
                hitSlop={10}
                style={({ pressed }) => [styles.commentSortBtn, pressed && styles.commentSortBtnPressed]}>
                <Ionicons name="options-outline" size={15} color={surface.textMuted} />
                <Text style={styles.commentSortBtnText}>{commentSortMode === 'liked' ? 'Most liked' : 'Most latest'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Team filter options"
                onPress={() => setFilterSheetVisible(true)}
                hitSlop={10}
                style={({ pressed }) => [styles.commentSortBtn, pressed && styles.commentSortBtnPressed]}>
                <Ionicons name="filter-outline" size={15} color={surface.textMuted} />
                <Text style={styles.commentSortBtnText}>{filterOptionId ? teamTagLabel(card, filterOptionId) : 'All teams'}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={effectivePick ? 'Write a comment' : 'Vote first to unlock commenting'}
          accessibilityState={{ disabled: !effectivePick }}
          disabled={!effectivePick}
          onPress={() => setComposerModalVisible(true)}
          style={({ pressed }) => [
            styles.commentEntryBar,
            !effectivePick && styles.commentEntryBarDisabled,
            pressed && effectivePick && styles.commentEntryBarPressed,
          ]}>
          <View style={styles.commentEntryDot} />
          <Text style={[styles.commentEntryText, !effectivePick && styles.commentEntryTextDisabled]}>
            {effectivePick ? 'Drop a comment...' : 'Vote on this card to unlock commenting...'}
          </Text>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={surface.textMuted} />
        </Pressable>

        {!hasResults ? (
          <View style={styles.needVoteCallout}>
            <Text style={styles.needVoteTitle}>Vote to unlock posting</Text>
            <Text style={styles.needVoteBody}>You can browse existing threads now. Replying and publishing open after you choose a side.</Text>
          </View>
        ) : null}

        <View style={[styles.feedList, !hasResults && styles.secondarySectionMuted]}>
          {filteredTopLevel.map((p) => (
            <DiscussionPostCard
              key={p.id}
              post={p}
              depth={0}
              card={card}
              presentation="feed"
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

        {filteredTopLevel.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No responses in this slice yet</Text>
            <Text style={styles.emptySubtitle}>Broaden the filter or be the first to explain your choice.</Text>
          </View>
        ) : null}

      </View>

      <JumpUpSheet
        visible={composerModalVisible}
        onClose={() => setComposerModalVisible(false)}
        backgroundColor="rgba(253,251,247,0.98)"
        borderTopColor={profileNeutralStroke(0.12)}
        bottomInset={insets.bottom}
        maxHeight="58%"
        grabColor={profileNeutralStroke(0.22)}
        dismissAccessibilityLabel="Close comment composer">
        <View style={[styles.composerSheet, styles.composerSheetModal]}>
          <View style={styles.composerModalHeader}>
            <Text style={styles.composerEyebrow}>
              {effectivePick ? `Posting as · ${optionLabel(card, effectivePick)}` : 'Join this discussion'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close comment composer"
              hitSlop={10}
              onPress={() => setComposerModalVisible(false)}
              style={({ pressed }) => [styles.composerModalClose, pressed && styles.composerModalClosePressed]}>
              <Ionicons name="close" size={16} color={surface.textMuted} />
            </Pressable>
          </View>
          <TextInput
            ref={composerInputRef}
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
                ? 'Explain your stance with one concrete reason or example.'
                : 'Vote on this card to unlock posting…'
            }
            placeholderTextColor={surface.textMuted}
            value={draft}
            onChangeText={setDraft}
            maxLength={2000}
          />
          <Button
            accessibilityLabel="Publish discussion comment"
            style={styles.postBtn}
            disabled={!effectivePick || draft.trim().length < 4}
            onPress={submit}>
            <Text style={styles.postBtnLabel}>Share response</Text>
          </Button>
        </View>
      </JumpUpSheet>

      <JumpUpSheet
        visible={sortSheetVisible}
        onClose={() => setSortSheetVisible(false)}
        backgroundColor="rgba(253,251,247,0.98)"
        borderTopColor={profileNeutralStroke(0.12)}
        bottomInset={insets.bottom}
        maxHeight="32%"
        grabColor={profileNeutralStroke(0.22)}
        dismissAccessibilityLabel="Close comment sort options">
        <View style={styles.sortSheetBody}>
          <Text style={styles.sortSheetTitle}>Sort comments</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: commentSortMode === 'liked' }}
            style={({ pressed }) => [styles.sortSheetAction, pressed && styles.sortSheetActionPressed]}
            onPress={() => {
              setCommentSortMode('liked');
              setSortSheetVisible(false);
            }}>
            <Text style={styles.sortSheetActionText}>Most liked</Text>
            {commentSortMode === 'liked' ? <Ionicons name="checkmark" size={16} color={semantic.actionPrimary} /> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: commentSortMode === 'latest' }}
            style={({ pressed }) => [styles.sortSheetAction, pressed && styles.sortSheetActionPressed]}
            onPress={() => {
              setCommentSortMode('latest');
              setSortSheetVisible(false);
            }}>
            <Text style={styles.sortSheetActionText}>Most latest</Text>
            {commentSortMode === 'latest' ? <Ionicons name="checkmark" size={16} color={semantic.actionPrimary} /> : null}
          </Pressable>
        </View>
      </JumpUpSheet>

      <JumpUpSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        backgroundColor="rgba(253,251,247,0.98)"
        borderTopColor={profileNeutralStroke(0.12)}
        bottomInset={insets.bottom}
        maxHeight="38%"
        grabColor={profileNeutralStroke(0.22)}
        dismissAccessibilityLabel="Close team filter options">
        <View style={styles.sortSheetBody}>
          <Text style={styles.sortSheetTitle}>Filter by team</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filterOptionId === null }}
            style={({ pressed }) => [styles.sortSheetAction, pressed && styles.sortSheetActionPressed]}
            onPress={() => {
              setFilterOptionId(null);
              setFilterSheetVisible(false);
            }}>
            <Text style={styles.sortSheetActionText}>All teams</Text>
            {filterOptionId === null ? <Ionicons name="checkmark" size={16} color={semantic.actionPrimary} /> : null}
          </Pressable>
          {card.options.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: filterOptionId === option.id }}
              style={({ pressed }) => [styles.sortSheetAction, pressed && styles.sortSheetActionPressed]}
              onPress={() => {
                setFilterOptionId(option.id);
                setFilterSheetVisible(false);
              }}>
              <View style={styles.sortSheetTeamLabel}>
                <View style={[styles.filterTeamDot, { backgroundColor: teamStripeColor(card, option.id) }]} />
                <Text style={styles.sortSheetActionText}>{teamTagLabel(card, option.id)}</Text>
              </View>
              {filterOptionId === option.id ? <Ionicons name="checkmark" size={16} color={semantic.actionPrimary} /> : null}
            </Pressable>
          ))}
        </View>
      </JumpUpSheet>

      <JumpUpSheet
        visible={threadModalRoot != null}
        onClose={() => setThreadModalRoot(null)}
        backgroundColor="rgba(253,251,247,0.98)"
        borderTopColor={profileNeutralStroke(0.12)}
        bottomInset={insets.bottom}
        maxHeight="94%"
        grabColor={profileNeutralStroke(0.22)}
        dismissAccessibilityLabel="Close thread">
        {threadModalRoot ? (
          <>
            <View style={styles.threadModalHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close thread"
                hitSlop={12}
                onPress={() => setThreadModalRoot(null)}
                style={({ pressed }) => [styles.threadModalClose, pressed && styles.threadModalClosePressed]}>
                <Ionicons name="chevron-down" size={18} color={surface.textPrimary} />
              </Pressable>
              <Text style={styles.threadModalTitle} numberOfLines={2}>
                Thread
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
                presentation="fullscreen"
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
          </>
        ) : null}
      </JumpUpSheet>
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
  presentation?: DiscussionSurface;
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
  presentation = 'feed',
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
  const theme = usePmfSurface();
  const styles = React.useMemo(() => discussExpandedStyles(theme), [theme]);
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
          <View style={styles.threadAvatarShell}>
            <Text accessible={false} style={styles.threadAvatarEmoji}>
              {post.authorEmoji}
            </Text>
          </View>
          <Text style={[typography.compact, styles.threadAuthor]}>{post.authorName}</Text>
          {depth === 0 ? (
            <View style={[styles.teamInlineTag, { borderColor: `${stripe}44`, backgroundColor: `${stripe}14` }]}>
              <View style={[styles.teamInlineDot, { backgroundColor: stripe }]} />
              <Text style={styles.teamInlineText}>{teamTagLabel(card, post.optionId)}</Text>
            </View>
          ) : null}
          {post.timeLabel ? <Text style={styles.threadTime}>{post.timeLabel}</Text> : null}
          {isYou ? <Text style={styles.youInline}>You</Text> : null}
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
            <Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={17} color={liked ? semantic.actionPrimary : theme.textMuted} />
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
              <Ionicons name="return-down-forward-outline" size={16} color={composerOpen ? semantic.actionPrimary : theme.textMuted} />
              <Text style={[styles.replyPillText, composerOpen && styles.replyPillTextOn]}>{composerOpen ? 'Close' : 'Reply'}</Text>
            </Pressable>
          ) : null}
        </View>

        {presentation === 'feed' && depth === 0 && threadReplyTotal > 0 && onOpenFullThread ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View full thread, ${threadReplyTotal} replies`}
            onPress={() => onOpenFullThread(post)}
            style={({ pressed }) => [styles.viewThreadBar, pressed && styles.viewThreadBarPressed]}
            hitSlop={{ top: 4, bottom: 6 }}>
            <Ionicons name="chatbubbles-outline" size={17} color={semantic.actionPrimary} />
            <Text style={styles.viewThreadBarLabel}>
              Thread · {threadReplyTotal} {threadReplyTotal === 1 ? 'reply' : 'replies'}
            </Text>
            <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
          </Pressable>
        ) : null}

        {composerOpen ? (
          <View style={styles.inlineReplyComposer}>
            <TextInput
              accessibilityLabel={`Reply to ${post.authorName}`}
              placeholder={`Reply to ${post.authorName}…`}
              placeholderTextColor={theme.textMuted}
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

      {presentation === 'fullscreen' && depth < MAX_THREAD_DEPTH
        ? replies.map((child) => (
            <DiscussionPostCard
              key={child.id}
              post={child}
              depth={depth + 1}
              card={card}
              presentation={presentation}
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

function discussExpandedStyles(surface: ThemeSurface) {
  const text = pmfText(surface);
  return StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  screenCard: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.1),
    backgroundColor: surface.groupedSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnSecondary: {
    opacity: 0.72,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  topCloseBtn: {
    borderColor: profileNeutralStroke(0.14),
    backgroundColor: surface.groupedSurface,
    opacity: 1,
  },
  topIconBtnPressed: {
    opacity: 0.8,
  },
  voteMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.1),
    backgroundColor: 'rgba(255,255,255,0.74)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  voteMetaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  voteMetaText: {
    ...typography.caption,
    fontWeight: '700',
  },
  questionBlock: {
    gap: 4,
    marginBottom: 8,
  },
  questionEyebrow: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.22,
    textTransform: 'uppercase',
  },
  pointsInlineText: {
    ...typography.compact,
    fontWeight: '600',
    opacity: 0.82,
  },
  questionHeadline: {
    ...typography.h2,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 34,
    fontSize: 20,
  },
  optionsWrap: {
    gap: 8,
    marginBottom: 4,
  },
  optionRow: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.groupedBorder,
    backgroundColor: surface.groupedSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  optionRowSelected: {
    borderColor: 'rgba(79,118,194,0.52)',
    backgroundColor: surface.groupedSurface,
  },
  optionRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionRowLabel: {
    ...typography.compact,
    flex: 1,
    fontWeight: '700',
  },
  optionRowPct: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  optionTrack: {
    height: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  optionFill: {
    height: '100%',
    borderRadius: 999,
  },
  optionVoteTap: {
    borderRadius: radius.md,
  },
  optionVoteTapPressed: {
    opacity: 0.92,
  },
  secondarySectionMuted: {
    opacity: 0.58,
  },
  secondaryHint: {
    ...typography.caption,
    lineHeight: 18,
    fontWeight: '600',
  },
  disabledPill: {
    opacity: 0.6,
  },
  voteUnlockCard: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: 6,
  },
  voteUnlockTitle: {
    ...typography.compact,
    fontWeight: '800',
  },
  voteUnlockBody: {
    ...typography.caption,
    lineHeight: 18,
    fontWeight: '500',
  },
  summarySection: {
    marginTop: 14,
    gap: 10,
  },
  summaryEyebrow: {
    ...typography.caption,
    ...text.muted,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  summaryTitle: {
    ...typography.h2,
    ...text.display,
    fontWeight: '800',
    letterSpacing: -0.45,
    paddingHorizontal: 2,
  },
  summaryCard: {
    gap: 0,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.groupedBorder,
    backgroundColor: surface.groupedSurface,
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
    borderBottomColor: surface.hairline,
  },
  summaryRowLabel: {
    ...typography.caption,
    ...text.muted,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  summaryRowValue: {
    ...typography.compact,
    ...text.primary,
    lineHeight: 20,
    fontWeight: '500',
  },
  aiDecisionCard: {
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.groupedBorder,
    backgroundColor: surface.groupedSurface,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.015,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 0 },
      default: {},
    }),
  },
  aiDecisionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  aiSectionLabel: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  aiDecisionPick: {
    ...typography.caption,
    ...text.muted,
    fontWeight: '600',
    letterSpacing: 0.12,
    flex: 1,
  },
  aiDecisionHeadline: {
    ...typography.compact,
    ...text.display,
    fontWeight: '700',
    letterSpacing: -0.15,
    lineHeight: 22,
    fontSize: 16,
  },
  aiDecisionReason: {
    ...typography.caption,
    ...text.primary,
    lineHeight: 18,
    fontWeight: '500',
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  keyContextSection: {
    marginTop: 0,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: profileNeutralStroke(0.08),
    gap: 6,
  },
  keyContextEyebrow: {
    ...typography.micro,
    ...text.muted,
    fontWeight: '700',
    letterSpacing: 0.2,
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
    ...text.primary,
  },
  aiReactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  aiReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.groupedBorder,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  aiReactionPillAgreeOn: {
    borderColor: 'rgba(95,169,149,0.28)',
    backgroundColor: 'rgba(240,248,244,1)',
  },
  aiReactionPillDisagreeOn: {
    borderColor: 'rgba(125,138,160,0.28)',
    backgroundColor: 'rgba(246,247,249,1)',
  },
  aiReactionPillPressed: {
    opacity: 0.9,
  },
  aiReactionLabel: {
    ...typography.micro,
    ...text.primary,
    fontWeight: '700',
  },
  aiReactionLabelOn: {
    ...text.display,
  },
  workflowHeader: {
    gap: 6,
    paddingHorizontal: 2,
  },
  workflowEyebrow: {
    ...typography.caption,
    ...text.muted,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  workflowTitle: {
    ...typography.h2,
    ...text.display,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  workflowBody: {
    ...typography.compact,
    ...text.display,
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
    borderColor: surface.groupedBorder,
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
    ...text.primary,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  stageTitle: {
    ...typography.compact,
    ...text.display,
    fontWeight: '800',
    fontSize: 15,
  },
  stageBody: {
    ...typography.compact,
    ...text.primary,
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
    ...text.primary,
    fontWeight: '700',
  },
  stageMiniLabel: {
    ...typography.caption,
    ...text.muted,
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
    borderColor: surface.groupedBorder,
  },
  audienceChipText: {
    ...typography.caption,
    ...text.display,
    fontWeight: '700',
  },
  stageFootnote: {
    ...typography.caption,
    ...text.muted,
    lineHeight: 17,
    fontWeight: '600',
  },
  spotlightShell: {
    gap: 10,
  },
  spotlightEyebrow: {
    ...typography.caption,
    ...text.muted,
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
    borderColor: surface.groupedBorder,
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
    ...text.primary,
    fontWeight: '800',
    flex: 1,
  },
  spotlightBody: {
    ...typography.compact,
    ...text.primary,
    lineHeight: 19,
    fontWeight: '500',
  },
  spotlightLane: {
    ...typography.caption,
    color: semantic.actionPrimary,
    fontWeight: '700',
  },
  commentsDividerWrap: {
    marginTop: 8,
    marginBottom: 2,
  },
  commentsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  commentControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentsDividerMeta: {
    ...typography.micro,
    ...text.muted,
    fontWeight: '600',
  },
  commentSortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.1),
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  commentSortBtnPressed: {
    opacity: 0.78,
  },
  commentSortBtnText: {
    ...typography.micro,
    ...text.muted,
    fontWeight: '700',
  },
  commentEntryBar: {
    marginTop: 4,
    marginBottom: 2,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.09),
    backgroundColor: surface.groupedSurface,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentEntryBarDisabled: {
    opacity: 0.72,
  },
  commentEntryBarPressed: {
    opacity: 0.86,
  },
  commentEntryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: profileNeutralStroke(0.3),
    flexShrink: 0,
  },
  commentEntryText: {
    ...typography.compact,
    ...text.muted,
    fontWeight: '500',
    flex: 1,
  },
  commentEntryTextDisabled: {
    ...text.muted,
  },
  filterRail: {
    marginTop: 2,
    marginBottom: 2,
    flexGrow: 0,
  },
  filterRailContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: spacing.sm,
    gap: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.09),
    backgroundColor: surface.groupedSurface,
    maxWidth: 220,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.01,
        shadowRadius: 1,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 0 },
      default: {},
    }),
  },
  filterChipOn: {
    borderColor: 'rgba(96,110,130,0.28)',
    backgroundColor: 'rgba(246,247,249,1)',
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.04,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  filterChipText: {
    ...typography.micro,
    ...text.display,
    fontWeight: '600',
    flexShrink: 1,
  },
  filterChipTextOn: {
    ...text.primary,
  },
  filterTeamDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  feedList: {
    marginTop: 8,
    gap: 8,
  },
  teamBlock: {
    marginTop: 14,
    gap: 10,
  },
  teamBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: surface.groupedSurface,
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
    ...text.primary,
    flexShrink: 1,
  },
  teamBadgeMeta: {
    ...typography.caption,
    ...text.muted,
    fontWeight: '600',
    marginLeft: 4,
  },
  threadList: {
    gap: 12,
  },
  threadRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderRadius: radius.md,
    backgroundColor: surface.groupedSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.04),
    ...Platform.select({
      ios: {
        shadowColor: surface.textDisplay,
        shadowOpacity: 0.008,
        shadowRadius: 1,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 0 },
      default: {},
    }),
  },
  threadRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    marginBottom: 3,
  },
  threadAvatarShell: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.groupedSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.1),
    overflow: 'hidden',
  },
  threadAvatarEmoji: {
    fontSize: 14,
    lineHeight: 16,
  },
  threadAuthor: {
    ...typography.caption,
    fontWeight: '700',
    ...text.primary,
    flexShrink: 1,
  },
  teamInlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  teamInlineDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  teamInlineText: {
    fontSize: 10,
    lineHeight: 12,
    ...text.muted,
    fontWeight: '700',
  },
  youInline: {
    ...typography.micro,
    ...text.muted,
    fontWeight: '700',
  },
  threadTime: {
    ...typography.micro,
    ...text.muted,
    marginLeft: 2,
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
    ...typography.compact,
    ...text.primary,
    fontWeight: '400',
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  threadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  actionPillSelected: {
    borderColor: 'rgba(96,110,130,0.3)',
    backgroundColor: 'rgba(246,247,249,1)',
  },
  actionPillPressed: {
    opacity: 0.88,
  },
  actionPillLabel: {
    ...typography.micro,
    fontWeight: '600',
    ...text.muted,
    minWidth: 0,
  },
  actionPillLabelOn: {
    ...text.primary,
  },
  replyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  replyPillOn: {
    borderColor: 'rgba(96,110,130,0.3)',
    backgroundColor: 'rgba(246,247,249,1)',
  },
  replyPillPressed: {
    opacity: 0.9,
  },
  replyPillText: {
    ...typography.micro,
    fontWeight: '600',
    ...text.muted,
  },
  replyPillTextOn: {
    ...text.primary,
  },
  threadBranch: {
    marginTop: 2,
    marginLeft: 5,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: profileNeutralStroke(0.06),
  },
  threadRowNested: {
    backgroundColor: 'rgba(255,255,255,0.8)',
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
    borderColor: surface.hairline,
    backgroundColor: surface.groupedSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11,
    ...typography.compact,
    ...text.primary,
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
    ...text.muted,
  },
  inlineReplyPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: semantic.actionPrimary,
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
    gap: 6,
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.hairline,
  },
  viewThreadBarPressed: {
    opacity: 0.9,
    backgroundColor: 'rgba(246,247,249,1)',
  },
  viewThreadBarLabel: {
    flex: 1,
    ...typography.micro,
    fontWeight: '600',
    ...text.display,
    minWidth: 0,
  },
  threadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: surface.hairline,
  },
  threadModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.hairline,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  threadModalClosePressed: {
    opacity: 0.65,
  },
  threadModalTitle: {
    flex: 1,
    ...typography.compact,
    fontWeight: '700',
    ...text.primary,
    textAlign: 'center',
    minWidth: 0,
  },
  threadModalHeaderSpacer: {
    minWidth: 32,
  },
  threadModalScrollContent: {
    paddingHorizontal: spacing.sm,
    paddingTop: 14,
    paddingBottom: spacing.lg,
  },
  sortSheetBody: {
    paddingHorizontal: spacing.sm,
    paddingBottom: Math.max(spacing.md, 18),
    gap: 8,
  },
  sortSheetTitle: {
    ...typography.compact,
    ...text.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  sortSheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.groupedBorder,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  sortSheetActionPressed: {
    opacity: 0.8,
  },
  sortSheetActionText: {
    ...typography.compact,
    ...text.primary,
    fontWeight: '600',
  },
  sortSheetTeamLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyCard: {
    marginTop: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: 6,
    backgroundColor: surface.groupedSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.07),
  },
  emptyTitle: {
    ...typography.compact,
    fontWeight: '700',
    ...text.primary,
  },
  emptySubtitle: {
    ...typography.caption,
    ...text.muted,
    lineHeight: 17,
    fontWeight: '500',
  },
  composerSheet: {
    marginTop: 12,
    paddingTop: 10,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    marginHorizontal: 0,
    marginBottom: 4,
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.07),
    ...Platform.select({
      ios: {
        shadowColor: surface.textDisplay,
        shadowOpacity: 0.02,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 0 },
      default: {},
    }),
  },
  composerSheetModal: {
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 4,
  },
  composerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  composerModalClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.hairline,
    backgroundColor: surface.groupedSurface,
  },
  composerModalClosePressed: {
    opacity: 0.72,
  },
  composerEyebrow: {
    ...typography.micro,
    ...text.primary,
    fontWeight: '700',
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 84,
    maxHeight: 148,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.groupedBorder,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    ...typography.compact,
    ...text.primary,
    textAlignVertical: 'top',
  },
  postBtn: {
    alignSelf: 'stretch',
    marginBottom: 0,
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
    backgroundColor: surface.groupedSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.hairline,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.03,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  needVoteTitle: {
    ...typography.compact,
    fontWeight: '800',
    ...text.primary,
  },
  needVoteBody: {
    ...typography.caption,
    ...text.display,
    lineHeight: 18,
    fontWeight: '500',
  },
});
}
