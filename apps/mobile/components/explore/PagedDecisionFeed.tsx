import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ExploreFeedResponse } from '@shouldi/contracts';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import {
  Animated,
  Easing,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePmfChrome } from '@/components/screen/PmfChromeContext';
import { ctaStyles } from '@/components/screen/ctaStyles';
import { pmfText, reelVoteBadgeChrome, usePmfSurface } from '@/components/screen/pmfChrome';
import { optionTeamColor, optionTeamPillChrome } from '@/lib/optionTeamChrome';
import { useColorScheme } from '@/components/useColorScheme';
import {
  reelDiscussStyles,
  ReelCardSurface,
  ReelCardActionBar,
  RewardPointsGem,
  InlineDistributionTrack,
  PollQuestionAccentBar,
} from '@/components/explore/ReelDiscussChrome';
import { MOTION } from '@/constants/motion';
import { palette, profileNeutralStroke, radius, semantic, themeSurface, typography, type ThemeSurface } from '@/constants/theme';

export type ExploreFeedCard = ExploreFeedResponse['cards'][number];



export function decisionFeedStatus(card: unknown): 'open' | 'resolved' {
  const value = (card as { status?: string })?.status;
  return value === 'resolved' ? 'resolved' : 'open';
}

const DEFAULT_SWIPE_CUES = ['More vibes ↑', 'Swipe for next', 'Keep scrolling ↑'] as const;

export const OUTCOME_REPLAY_SWIPE_CUES = ['Next dilemma ↑', 'Swipe for more', 'One more ↑'] as const;
/** @deprecated Use OUTCOME_REPLAY_SWIPE_CUES. */
export const PLOT_DECK_SWIPE_CUES = OUTCOME_REPLAY_SWIPE_CUES;

export const EXPLORE_FIRST_VOTE_REWARD_POINTS = 2;

export type PagedDecisionFeedProps = {
  cards: ExploreFeedCard[];
  /** Fallback before first layout: approx. height of chrome above `feedFrame` (headers, not tab bar). */
  headerChromeEstimate: number;
  /** Extra subtracted during fallback height (Explore tab bar). Use ~88 with floating tab UI. */
  bottomOverlayExtra: number;
  swipeCues?: readonly string[];
  isFetching: boolean;
  onRefresh: () => void;
  /** Landing emphasis on reel #1 (Explore only — subtle extra spring). */
  celebrateLandingHero?: boolean;
  /** First vote on an open reel — surfaced in Explore header balance (demo-local persist). */
  onEarnExploreVotePoints?: (delta: number) => void;
  /** Replay tab — quiet grouped cards without category atmosphere wash. */
  quietPresentation?: boolean;
};

export type ExploreCardDetailPanelProps = {
  item: ExploreFeedCard;
  effectivePicked?: string | null;
  onPickedChange: (optionId: string) => void;
  onEarnExploreVotePoints?: (delta: number) => void;
  quietPresentation?: boolean;
};

function shorten(text: string, max = 150): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/** Short rationale for why the assistant leans toward one option — read-only, no voting UI. */
function AiDecisionReasonCard({
  v,
  suggestedOptionLabel,
}: {
  v: NonNullable<ExploreFeedCard['aiValidation']>;
  suggestedOptionLabel?: string | null;
}) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const styles = React.useMemo(() => pagedFeedStyles(surface), [surface]);
  const detail = shorten(v.verdictBecause, 300);
  return (
    <View
      style={[
        styles.aiReasonCard,
        {
          backgroundColor: surface.groupedSurface,
          borderColor: surface.groupedBorder,
          borderLeftColor: surface.textDisplay,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`AI decision. ${suggestedOptionLabel ? `Suggested option ${suggestedOptionLabel}. ` : ''}${v.verdictLine}. ${detail}`}>
      <View style={styles.aiReasonEyebrowRow}>
        <View style={[styles.aiReasonBadge, { backgroundColor: surface.textDisplay }]}>
          <Text style={styles.aiReasonBadgeLabel}>AI DECISION</Text>
        </View>
        {suggestedOptionLabel ? (
          <Text style={[styles.aiReasonEyebrow, { color: surface.textMuted }]}>Lean: {suggestedOptionLabel}</Text>
        ) : (
          <Text style={[styles.aiReasonEyebrow, { color: surface.textMuted }]}>Reason summary</Text>
        )}
      </View>
      <Text style={[styles.aiReasonLead, { color: surface.textDisplay }]}>{v.verdictLine}</Text>
      <Text style={[styles.aiReasonBody, { color: surface.textPrimary }]}>{detail}</Text>
      {v.expertVerdicts.length > 0 ? (
        <View style={styles.aiReasonExpertBlock}>
          <Text style={[styles.aiReasonExpertEyebrow, { color: surface.textMuted }]}>
            {v.expertVerdicts.length} experts weighed in
          </Text>
          {v.expertVerdicts.map((expert, index) => (
            <Text key={index} style={[styles.aiReasonExpertLine, { color: surface.textMuted }]}>
              · {expert.expertTitle}: {expert.verdictLine}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function totalVotesFromCard(card: ExploreFeedCard): number {
  return card.distribution.reduce((sum, d) => sum + d.votes, 0);
}

export function ExploreCardDetailPanel({
  item,
  effectivePicked,
  onPickedChange,
  onEarnExploreVotePoints,
  quietPresentation = false,
}: ExploreCardDetailPanelProps) {
  const surface = usePmfChrome();
  const text = pmfText(surface);
  const styles = React.useMemo(() => pagedFeedStyles(surface), [surface]);
  const status = decisionFeedStatus(item);
  const isOpen = status === 'open';
  const isResolved = status === 'resolved';
  const voteTotalAll = totalVotesFromCard(item);
  const hasPicked = isResolved || !!effectivePicked;

  return (
    <ReelCardSurface category={item.category} isOpen={isOpen} suppressAtmosphere={quietPresentation}>
      <ReelCardActionBar
        variant="reel-feed-top"
        voteSummary={{ voteTotal: voteTotalAll, isLivePoll: isOpen }}
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
                text.display,
              ]}>
              {item.question}
            </Text>
            <RewardPointsGem rewardPoints={item.rewardPoints} density="compact" />
          </View>
          <PollQuestionAccentBar />
        </View>
      </View>
      {isOpen && !hasPicked ? (
        <Text style={[styles.pickPrompt, text.primary]}>Tap whatever feels closest — zero pressure.</Text>
      ) : null}
      {(() => {
        const total = totalVotesFromCard(item);
        const aiPickId = item.aiSuggestedOptionId;
        const aiSuggestedLabel =
          aiPickId != null ? item.options.find((option) => option.id === aiPickId)?.label ?? null : null;
        return (
          <>
            <View style={reelDiscussStyles.optionWrap}>
              {item.options.map((option, optionIdx) => {
                const votes = item.distribution.find((d) => d.optionId === option.id)?.votes ?? 0;
                const percentage = total > 0 ? Math.round((votes / total) * 100) : 0;
                const selected = effectivePicked === option.id;
                const aiLeanHere = !!(hasPicked && aiPickId && option.id === aiPickId);
                const teamColor = optionTeamColor(item.options, option.id);
                const pollBar =
                  selected ? 'user' : aiLeanHere ? 'ai' : ('neutral' as const);
                const pillEmphasis: 'default' | 'user' | 'ai' | 'userAndAi' =
                  hasPicked && selected && aiLeanHere
                    ? 'userAndAi'
                    : hasPicked && selected
                      ? 'user'
                      : hasPicked && aiLeanHere
                        ? 'ai'
                        : 'default';
                const userBadge = reelVoteBadgeChrome('user', surface);
                const aiBadge = reelVoteBadgeChrome('ai', surface);
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityLabel={
                      aiLeanHere
                        ? `${isResolved ? `${option.label}, voting closed` : `Pick ${option.label}`}; ShouldI AI leaned here`
                        : isResolved
                          ? `${option.label}, voting closed`
                          : `Pick ${option.label}`
                    }
                    disabled={isResolved}
                    onPress={() => {
                      if (isResolved) return;
                      const hadPickAlready = !!effectivePicked;
                      if (Platform.OS !== 'web' && hadPickAlready) {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                      }
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      onPickedChange(option.id);
                      if (isOpen && !hadPickAlready) {
                        onEarnExploreVotePoints?.(EXPLORE_FIRST_VOTE_REWARD_POINTS);
                      }
                    }}
                    style={({ pressed }) => [
                      reelDiscussStyles.optionPill,
                      optionTeamPillChrome(optionIdx, surface, pillEmphasis),
                      isResolved && reelDiscussStyles.optionPillDisabled,
                      !isResolved && pressed && reelDiscussStyles.optionPillPressed,
                    ]}>
                    <View style={reelDiscussStyles.optionTopRow}>
                      <Text
                        style={[
                          reelDiscussStyles.optionText,
                          text.primary,
                          selected && reelDiscussStyles.optionTextActive,
                          selected && { color: teamColor },
                        ]}
                        numberOfLines={2}
                        ellipsizeMode="tail">
                        {option.label}
                      </Text>
                      <View style={reelDiscussStyles.optionMetaCluster}>
                        {selected && hasPicked ? (
                          <View style={[reelDiscussStyles.userPickBadge, userBadge.shell]}>
                            <Text style={[reelDiscussStyles.userPickBadgeText, userBadge.text]}>YOU</Text>
                          </View>
                        ) : null}
                        {aiLeanHere ? (
                          <View style={[reelDiscussStyles.aiLeanBadge, aiBadge.shell]}>
                            <Text style={[reelDiscussStyles.aiLeanBadgeText, aiBadge.text]}>AI</Text>
                          </View>
                        ) : null}
                        {hasPicked ? (
                          <Text style={[reelDiscussStyles.optionMeta, text.muted, selected && reelDiscussStyles.optionMetaPicked, selected && { color: teamColor }]}>
                            {percentage}%
                            {selected ? (isResolved ? ' · Final' : ' · You') : ''}
                          </Text>
                        ) : selected ? (
                          <Text style={[reelDiscussStyles.optionMeta, text.muted]}>Selected</Text>
                        ) : null}
                      </View>
                    </View>
                    {hasPicked ? (
                      <View>
                        <InlineDistributionTrack percentage={percentage} emphasis={pollBar} teamColor={teamColor} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {hasPicked && item.aiValidation ? (
              <AiDecisionReasonCard
                v={item.aiValidation}
                suggestedOptionLabel={aiSuggestedLabel}
              />
            ) : null}
            {hasPicked ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Join discussion"
                onPress={() =>
                  router.push({
                    pathname: '/decision/[id]',
                    params: {
                      id: item.id,
                      fromReel: '1',
                      reelCategory: item.category,
                      pickedOption:
                        typeof effectivePicked === 'string' ? effectivePicked : '',
                    },
                  })
                }
                style={({ pressed }) => [
                  ctaStyles.primary,
                  styles.discussButtonBelowChoices,
                  pressed && { opacity: 0.92 },
                ]}>
                <Text style={ctaStyles.primaryLabel}>Join Discussion</Text>
              </Pressable>
            ) : null}
          </>
        );
      })()}
      {status === 'resolved' ? (
        <View style={styles.outcomeMerged}>
          <Text style={[typography.caption, styles.outcomeEyebrow]}>What happened</Text>
          <Text style={[typography.body, styles.outcomeText]}>{shorten(item.outcome ?? '', 160)}</Text>
          <Text style={[typography.caption, styles.lessonEyebrow]}>Takeaway</Text>
          <Text style={[typography.compact, styles.lessonText]}>{shorten(item.takeaway ?? '', 130)}</Text>
        </View>
      ) : null}
    </ReelCardSurface>
  );
}



function ReelCardMotionWrap({
  animationToken,
  isLandingHero,
  children,
}: {
  animationToken: string;
  isLandingHero: boolean;
  children: React.ReactNode;
}) {
  const surface = usePmfSurface();
  const styles = React.useMemo(() => pagedFeedStyles(surface), [surface]);
  const opacity = React.useRef(new Animated.Value(1)).current;
  const translateY = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    opacity.setValue(0);
    translateY.setValue(30);
    scale.setValue(0.91);

    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: MOTION.card.friction,
        tension: MOTION.card.tension,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: MOTION.card.friction,
        tension: MOTION.card.tension,
        useNativeDriver: true,
      }),
    ]);

    entrance.start(({ finished }: { finished: boolean }) => {
      if (cancelled || !finished || !isLandingHero) return;
      timeouts.push(
        setTimeout(() => {
          if (cancelled) return;
          Animated.sequence([
            Animated.spring(scale, {
              toValue: 1.032,
              speed: 20,
              bounciness: 9,
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              friction: MOTION.card.friction,
              tension: MOTION.card.tension,
              useNativeDriver: true,
            }),
          ]).start();
        }, 100),
      );
      timeouts.push(
        setTimeout(() => {
          if (cancelled) return;
          Animated.sequence([
            Animated.spring(scale, {
              toValue: 1.018,
              speed: 16,
              bounciness: 6,
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              friction: MOTION.card.friction,
              tension: MOTION.card.tension,
              useNativeDriver: true,
            }),
          ]).start();
        }, 520),
      );
    });

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
      entrance.stop();
      opacity.stopAnimation();
      translateY.stopAnimation();
      scale.stopAnimation();
    };
  }, [animationToken, isLandingHero, opacity, translateY, scale]);

  return (
    <Animated.View pointerEvents="box-none" style={[styles.cardMotionOuter, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

function BouncySwipeCue({
  index,
  cues,
}: {
  index: number;
  cues: readonly string[];
}) {
  const surface = usePmfSurface();
  const styles = React.useMemo(() => pagedFeedStyles(surface), [surface]);
  const bounce = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 550,
          easing: Easing.bezier(0.45, 0, 0.55, 1),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 550,
          easing: Easing.bezier(0.45, 0, 0.55, 1),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  const arrowY = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: [4, -8],
  });
  const arrowOpacity = bounce.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.65, 1, 0.65],
  });

  const line = cues[index % cues.length] ?? '';

  return (
    <View style={styles.swipeCueCluster} accessibilityRole="text">
      <Animated.View style={{ opacity: arrowOpacity, transform: [{ translateY: arrowY }] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.swipeCueOrb}>
          <Ionicons name="chevron-up" size={21} color={surface.textMuted} />
        </View>
      </Animated.View>
      <Text style={[typography.compact, styles.scrollCue]}>{line}</Text>
    </View>
  );
}

export function PagedDecisionFeed({
  cards,
  headerChromeEstimate,
  bottomOverlayExtra,
  swipeCues = DEFAULT_SWIPE_CUES,
  isFetching,
  onRefresh,
  celebrateLandingHero = false,
  onEarnExploreVotePoints,
  quietPresentation = false,
}: PagedDecisionFeedProps) {
  const surface = usePmfSurface();
  const styles = React.useMemo(() => pagedFeedStyles(surface), [surface]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [selectedByCard, setSelectedByCard] = React.useState<Record<string, string>>({});
  const [feedViewportH, setFeedViewportH] = React.useState(0);
  const pageHeight = React.useMemo(() => {
    const fallback = Math.max(
      360,
      windowHeight -
        Math.max(insets.top, 12) -
        headerChromeEstimate -
        Math.max(insets.bottom, 8) -
        bottomOverlayExtra,
    );
    const raw = feedViewportH > 0 ? feedViewportH : fallback;
    return Math.max(320, Math.round(raw));
  }, [bottomOverlayExtra, feedViewportH, headerChromeEstimate, insets.bottom, insets.top, windowHeight]);

  React.useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const viewabilityConfig = React.useMemo(
    () => ({ itemVisiblePercentThreshold: 45, minimumViewTime: 110 }),
    [],
  );
  const hapticPrimedRef = React.useRef(false);
  const lastFocusedIndexRef = React.useRef(-1);

  const stableOnViewableItemsChangedRef = React.useRef(
    ({
      viewableItems,
    }: {
      viewableItems: ReadonlyArray<{ index: number | null; isViewable?: boolean | null }>;
    }) => {
      const indexes = viewableItems
        .filter((v) => v?.isViewable && v.index != null)
        .map((v) => v.index as number);
      if (indexes.length === 0) return;

      const focused = Math.min(...indexes);

      if (!hapticPrimedRef.current) {
        hapticPrimedRef.current = true;
        lastFocusedIndexRef.current = focused;
        return;
      }
      if (focused === lastFocusedIndexRef.current) return;
      lastFocusedIndexRef.current = focused;

      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }
    },
  );

  return (
    <View
      style={styles.feedFrame}
      onLayout={(e) => setFeedViewportH(e.nativeEvent.layout.height)}>
      <FlatList
        style={styles.pagedList}
        data={cards}
        accessibilityRole="list"
        keyExtractor={(item) => item.id}
        contentContainerStyle={cards.length === 0 ? styles.pagedListContentEmpty : styles.pagedListContent}
        ListEmptyComponent={null}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        pagingEnabled
        snapToAlignment="start"
        snapToInterval={Platform.OS === 'android' ? pageHeight : undefined}
        decelerationRate="fast"
        nestedScrollEnabled
        removeClippedSubviews={false}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={stableOnViewableItemsChangedRef.current}
        getItemLayout={(_, index) => ({
          length: pageHeight,
          offset: pageHeight * index,
          index,
        })}
        renderItem={({ item, index }) => {
          const effectivePicked = selectedByCard[item.id] ?? item.myVoteOptionId;

          return (
            <View style={[styles.pageSheet, { height: pageHeight }]}>
              <ScrollView
                style={styles.pageScroll}
                contentContainerStyle={[
                  styles.pageScrollContent,
                  { paddingBottom: Math.max(insets.bottom, 12) + bottomOverlayExtra },
                ]}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces
                {...(Platform.OS === 'ios' ? { directionalLockEnabled: true } : {})}>
                <ReelCardMotionWrap animationToken={item.id} isLandingHero={celebrateLandingHero && index === 0}>
                  <ExploreCardDetailPanel
                    item={item}
                    effectivePicked={effectivePicked}
                    onPickedChange={(optionId) =>
                      setSelectedByCard((prev) => ({
                        ...prev,
                        [item.id]: optionId,
                      }))
                    }
                    onEarnExploreVotePoints={onEarnExploreVotePoints}
                    quietPresentation={quietPresentation}
                  />
                </ReelCardMotionWrap>
                {index === 0 ? (
                  <View style={styles.swipeCueOutsideCard}>
                    <BouncySwipeCue index={0} cues={swipeCues} />
                  </View>
                ) : null}
              </ScrollView>
            </View>
          );
        }}
      />
    </View>
  );
}

function pagedFeedStyles(surface: ThemeSurface) {
  const text = pmfText(surface);
  return StyleSheet.create({
  feedFrame: {
    flex: 1,
    minHeight: 0,
  },
  pagedList: {
    flex: 1,
  },
  pagedListContent: {
    flexGrow: 1,
  },
  pagedListContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  pageSheet: {
    width: '100%',
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cardMotionOuter: {
    marginHorizontal: 17,
  },
  discussButtonBelowChoices: {
    marginTop: 14,
    marginBottom: 6,
    alignSelf: 'stretch',
  },
  swipeCueOutsideCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },

  pickPrompt: {
    ...typography.caption,
    ...text.primary,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 20,
    letterSpacing: 0.04,
    fontSize: 14,
  },
  aiReasonCard: {
    marginHorizontal: 0,
    marginTop: 12,
    marginBottom: 6,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  aiReasonEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 1,
  },
  aiReasonBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiReasonBadgeLabel: {
    ...typography.label,
    letterSpacing: 0.6,
    color: palette.sheet,
  },
  aiReasonEyebrow: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.12,
    flex: 1,
  },
  aiReasonLead: {
    ...typography.titleSm,
    letterSpacing: -0.35,
  },
  aiReasonBody: {
    ...typography.body,
    fontWeight: '500',
  },
  aiReasonExpertBlock: {
    marginTop: 2,
    gap: 3,
  },
  aiReasonExpertEyebrow: {
    ...typography.caption,
    fontWeight: '600',
  },
  aiReasonExpertLine: {
    ...typography.caption,
    lineHeight: 17,
    fontWeight: '500',
  },
  outcomeMerged: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: surface.hairline,
    gap: 8,
  },
  outcomeEyebrow: {
    ...text.muted,
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 0.08,
    fontSize: 12,
    marginBottom: 2,
  },
  outcomeText: {
    ...text.primary,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: 2,
  },
  lessonEyebrow: {
    marginTop: 8,
    marginBottom: 2,
    ...text.muted,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'none',
    letterSpacing: 0.08,
  },
  lessonText: {
    ...text.display,
    lineHeight: 22,
    fontWeight: '400',
  },
  scrollCue: {
    textAlign: 'center',
    ...text.muted,
    paddingHorizontal: 12,
    lineHeight: 21,
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: 0.1,
    marginTop: 4,
  },
  swipeCueCluster: {
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingVertical: 6,
  },
  swipeCueOrb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.groupedSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.hairline,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.055,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },

});
}

