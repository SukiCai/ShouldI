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
  LiveVotesPill,
  ReelCardActionBar,
  ReelCardSurface,
  reelDiscussStyles,
  totalVotesFromDistribution,
} from '@/components/explore/ReelDiscussChrome';
import { palette, radius, spacing, typography } from '@/constants/theme';
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

  return (
    <View style={styles.wrap}>
      <ReelCardSurface category={card.category} isOpen={isOpen} layout="fullscreen" suppressAtmosphere>
        <ReelCardActionBar
          category={card.category}
          rewardPoints={card.rewardPoints}
          saved={saved}
          following={following}
          onToggleSave={() => setSaved((s) => !s)}
          onToggleFollow={() => setFollowing((f) => !f)}
          onLeadingBackPress={() => router.back()}
        />

        <View style={reelDiscussStyles.pollQuestionRow}>
          <Text
            accessibilityRole="header"
            style={[
              isOpen ? typography.hero : typography.h2,
              reelDiscussStyles.pollQuestion,
              reelDiscussStyles.pollQuestionFlexible,
              isOpen && reelDiscussStyles.pollQuestionOpen,
              isOpen && reelDiscussStyles.pollHeroOpen,
            ]}>
            {card.question}
          </Text>
          <LiveVotesPill voteTotal={voteTotal} isLivePoll={isOpen} inline />
        </View>

        <View style={reelDiscussStyles.optionWrap}>
          {card.options.map((option) => {
            const votes = card.distribution.find((d) => d.optionId === option.id)?.votes ?? 0;
            const percentage = voteTotal > 0 ? Math.round((votes / voteTotal) * 100) : 0;
            const selected = effectivePick === option.id;
            const aiLeanHere = !!(hasResults && card.aiSuggestedOptionId && option.id === card.aiSuggestedOptionId);
            return (
              <View
                key={option.id}
                style={[
                  reelDiscussStyles.optionPill,
                  selected && reelDiscussStyles.optionPillActive,
                  aiLeanHere && reelDiscussStyles.optionPillAiLean,
                ]}>
                <View style={reelDiscussStyles.optionTopRow}>
                  <Text style={[reelDiscussStyles.optionText, selected && reelDiscussStyles.optionTextActive]}>
                    {option.label}
                  </Text>
                  <View style={reelDiscussStyles.optionMetaCluster}>
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
                {hasResults ? <InlineDistributionTrack percentage={percentage} /> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.discussionHeader}>
          <View style={styles.discussionTitleRow}>
            <View style={styles.discussionAccentStrip} accessibilityElementsHidden />
            <View style={styles.discussionTitleStack}>
              <Text style={styles.discussionEyebrow}>Community thread</Text>
              <Text style={styles.discussionTitle}>Team perspectives</Text>
            </View>
          </View>
          <Text style={styles.discussionSub}>
            Replies carry the stance they support — disagree with ideas, not people.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRail} contentContainerStyle={styles.filterRailContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filterOptionId === null }}
            onPress={() => setFilterOptionId(null)}
            style={[styles.filterChip, filterOptionId === null && styles.filterChipOn]}>
            <Text style={[styles.filterChipText, filterOptionId === null && styles.filterChipTextOn]}>All teams</Text>
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
              {isOpen ? 'Choose a side on the reel first' : 'Join the thread with a stance'}
            </Text>
            <Text style={styles.needVoteBody}>
              {isOpen
                ? "Your vote anchors which team badge you'll wear in this thread. Head back to Explore, tap an option, then reopen Discuss."
                : 'Posts are labeled by the option they support. To add your voice under a team banner, return to the reel, tap the stance you identify with, then open Discuss again.'}
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
                        {voiceCount} {voiceCount === 1 ? 'voice' : 'voices'}
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
                <Text style={styles.emptyTitle}>No notes in this slice</Text>
                <Text style={styles.emptySubtitle}>Broaden filters or draft the first takeaway for your team.</Text>
              </View>
            ) : null}

            <View style={styles.composerSheet}>
              <Text style={styles.composerEyebrow}>
                {effectivePick
                  ? `Posting as · ${optionLabel(card, effectivePick)}`
                  : 'Join this decision'}
              </Text>
              <TextInput
                accessibilityLabel={
                  effectivePick
                    ? `Write a perspective for ${optionLabel(card, effectivePick)}`
                    : 'Discussion composer disabled until you vote'
                }
                style={styles.input}
                multiline
                editable={!!effectivePick}
                placeholder={
                  effectivePick
                    ? 'Share evidence, timelines, or what would flip your stance—stay respectful.'
                    : 'Vote on Explore to unlock posting…'
                }
                placeholderTextColor={palette.slate500}
                value={draft}
                onChangeText={setDraft}
                maxLength={2000}
              />
              <PrimaryButton
                accessibilityLabel="Publish discussion comment"
                style={styles.postBtn}
                disabled={!effectivePick || draft.trim().length < 4}
                onPress={submit}>
                <Text style={styles.postBtnLabel}>Post</Text>
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
            <Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={17} color={liked ? palette.accent : palette.slate500} />
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
              <Ionicons name="return-down-forward-outline" size={16} color={composerOpen ? palette.accent : palette.slate500} />
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
            <Ionicons name="chevron-forward" size={17} color={palette.slate500} />
          </Pressable>
        ) : null}

        {composerOpen ? (
          <View style={styles.inlineReplyComposer}>
            <TextInput
              accessibilityLabel={`Reply to ${post.authorName}`}
              placeholder={`Reply to ${post.authorName}…`}
              placeholderTextColor={palette.slate500}
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
  discussionHeader: {
    marginTop: 6,
    gap: 10,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.06)',
  },
  discussionTitleRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  discussionAccentStrip: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 36,
    borderRadius: 2,
    backgroundColor: 'rgba(79,118,194,0.42)',
    marginTop: 2,
  },
  discussionTitleStack: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  discussionEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.slate500,
  },
  discussionTitle: {
    color: palette.slate950,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  discussionSub: {
    ...typography.body,
    color: palette.slate800,
    lineHeight: 22,
    fontWeight: '500',
    opacity: 0.92,
  },
  filterRail: {
    marginTop: 10,
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
    borderColor: 'rgba(15,23,42,0.09)',
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
    color: palette.slate800,
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
    color: palette.slate900,
    flexShrink: 1,
  },
  teamBadgeMeta: {
    ...typography.caption,
    color: palette.slate500,
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
    borderColor: 'rgba(15,23,42,0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
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
    color: palette.slate900,
    flexShrink: 1,
  },
  threadTime: {
    ...typography.caption,
    color: palette.slate500,
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
    color: palette.slate900,
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
    borderColor: 'rgba(15,23,42,0.08)',
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
    color: palette.slate500,
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
    borderColor: 'rgba(15,23,42,0.08)',
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
    color: palette.slate500,
  },
  replyPillTextOn: {
    color: palette.accent,
  },
  threadBranch: {
    marginTop: 6,
    marginLeft: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(15,23,42,0.06)',
  },
  threadRowNested: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  depthReplyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(15,23,42,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  depthReplyBadgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    color: palette.slate500,
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
    color: palette.slate900,
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
    color: palette.slate500,
  },
  inlineReplyPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
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
    color: palette.slate800,
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
    borderBottomColor: 'rgba(15,23,42,0.08)',
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
    color: palette.slate900,
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
    borderColor: 'rgba(15,23,42,0.07)',
  },
  emptyTitle: {
    ...typography.compact,
    fontWeight: '700',
    color: palette.slate900,
  },
  emptySubtitle: {
    ...typography.caption,
    color: palette.slate500,
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
    borderTopColor: 'rgba(15,23,42,0.07)',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(253,251,247,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
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
    color: palette.slate900,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 96,
    maxHeight: 168,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.09)',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 13,
    ...typography.body,
    color: palette.slate900,
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
    color: palette.slate900,
  },
  needVoteBody: {
    ...typography.caption,
    color: palette.slate800,
    lineHeight: 18,
    fontWeight: '500',
  },
});
