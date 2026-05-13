import { router } from 'expo-router';
import type { ExploreFeedResponse } from '@shouldi/contracts';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
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

import PrimaryButton from '@/components/ui/PrimaryButton';
import { palette, typography } from '@/constants/theme';
import { REEL_SURFACE_GRADIENTS, REEL_SURFACE_LOCATIONS } from '@/constants/reelSurfaceGradients';

export type ExploreFeedCard = ExploreFeedResponse['cards'][number];

export function decisionFeedStatus(card: unknown): 'open' | 'resolved' {
  const value = (card as { status?: string })?.status;
  return value === 'resolved' ? 'resolved' : 'open';
}

function ColorfulReelCard({ category, children }: { category: keyof typeof REEL_SURFACE_GRADIENTS; children: React.ReactNode }) {
  const gradient = REEL_SURFACE_GRADIENTS[category];
  return (
    <LinearGradient
      colors={[...gradient]}
      locations={[...REEL_SURFACE_LOCATIONS]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardColorSurface}>
      {children}
    </LinearGradient>
  );
}

const DEFAULT_SWIPE_CUES = [
  'Flick up — next dilemma locked in 🔒',
  'One more swipe, fresh takes incoming ✨',
  'Keep cruising — surprises live above ↑',
  'Plot twist boarding on the next card 🎬',
  'Scroll up for your next dopamine vote 📈',
] as const;

export const PLOT_DECK_SWIPE_CUES = [
  'Swipe — see how another arc landed 🎯',
  'The herd already spoke · next reel ↑',
  'Closure in motion — flip to the next beat ✨',
  'Real outcomes · same reel energy 📼',
  'One more swipe for how it broke 🎬',
] as const;

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
};

function shorten(text: string, max = 150): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function totalVotesFromCard(card: ExploreFeedCard): number {
  return card.distribution.reduce((sum, d) => sum + d.votes, 0);
}

function safeRewardPoints(card: unknown): number {
  const raw = (card as { rewardPoints?: number })?.rewardPoints;
  return Number.isFinite(raw) && (raw ?? 0) > 0 ? (raw as number) : 10;
}

function InlineDistributionTrack({ percentage }: { percentage: number }) {
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [progress, percentage]);

  const animatedWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.max(percentage, 0)}%`],
  });

  return (
    <View style={styles.inlineTrack}>
      <Animated.View style={[styles.inlineFill, { width: animatedWidth }]} />
    </View>
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
        damping: 17,
        stiffness: 164,
        mass: 0.78,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 15,
        stiffness: 178,
        mass: 0.72,
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
              friction: 7,
              tension: 220,
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
              friction: 8,
              tension: 200,
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
      <Animated.Text style={[styles.swipeArrow, { opacity: arrowOpacity, transform: [{ translateY: arrowY }] }]} accessibilityLabel="">
        ↑
      </Animated.Text>
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
}: PagedDecisionFeedProps) {
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
          const status = decisionFeedStatus(item);
          const isOpen = status === 'open';
          const isResolved = status === 'resolved';
          const effectivePicked = selectedByCard[item.id] ?? item.myVoteOptionId;
          const hasPicked = isResolved || !!effectivePicked;

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
                  <ColorfulReelCard category={item.category}>
                    {!isOpen ? (
                      <>
                        <Text accessibilityRole="header" style={[typography.hero, styles.storyHeadline]} numberOfLines={4}>
                          {item.hook}
                        </Text>
                        <Text style={[typography.body, styles.storyBody]} numberOfLines={5}>
                          {shorten(item.tension, 140)}
                        </Text>
                      </>
                    ) : null}
                    <View style={[styles.pollShell, isOpen && styles.pollShellOpen]}>
                    {isOpen ? null : <Text style={[typography.caption, styles.pollEyebrow]}>Community poll</Text>}
                    <Text
                      accessibilityRole="header"
                      style={[
                        isOpen ? typography.title : typography.h2,
                        styles.pollQuestion,
                        isOpen && styles.pollQuestionOpen,
                      ]}>
                      {item.question}
                    </Text>
                    {(() => {
                      const total = totalVotesFromCard(item);
                      const aiPickId = item.aiSuggestedOptionId;
                      const aiPickLabel =
                        aiPickId && item.options.some((o) => o.id === aiPickId)
                          ? item.options.find((o) => o.id === aiPickId)?.label ?? null
                          : null;
                      const userVoteId =
                        typeof effectivePicked === 'string' ? effectivePicked : undefined;
                      const userVoteLabel =
                        userVoteId && item.options.some((o) => o.id === userVoteId)
                          ? item.options.find((o) => o.id === userVoteId)?.label ?? null
                          : null;
                      return (
                        <>
                          {!hasPicked && !isResolved ? (
                            <Text style={[typography.caption, styles.pollHint]}>
                              {status === 'open' ? (
                                <>
                                  Choose one to see how the community splits —{' '}
                                  <Text style={styles.pollHintStrong}>{safeRewardPoints(item)} pts</Text> up for grabs when
                                  this closes.
                                </>
                              ) : (
                                <>
                                  Tap an option to unlock bars —{' '}
                                  <Text style={styles.pollHintStrong}>{safeRewardPoints(item)} pts</Text> reward pool.
                                </>
                              )}
                            </Text>
                          ) : isResolved ? (
                            <Text style={[typography.caption, styles.pollHintMuted]}>Final vote snapshot · voting closed</Text>
                          ) : (
                            <Text style={[typography.caption, styles.pollHintMuted]}>Live snapshot · your vote updates below</Text>
                          )}
                          <View style={styles.optionWrap}>
                            {item.options.map((option) => {
                              const votes = item.distribution.find((d) => d.optionId === option.id)?.votes ?? 0;
                              const percentage = total > 0 ? Math.round((votes / total) * 100) : 0;
                              const selected = effectivePicked === option.id;
                              const aiLeanHere = !!(hasPicked && aiPickId && option.id === aiPickId);
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
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setSelectedByCard((prev) => ({
                                      ...prev,
                                      [item.id]: option.id,
                                    }));
                                  }}
                                  style={({ pressed }) => [
                                    styles.optionPill,
                                    selected && styles.optionPillActive,
                                    aiLeanHere && styles.optionPillAiLean,
                                    isResolved && styles.optionPillDisabled,
                                    !isResolved && pressed && styles.optionPillPressed,
                                  ]}>
                                  <View style={styles.optionTopRow}>
                                    <Text style={[styles.optionText, selected && styles.optionTextActive]}>{option.label}</Text>
                                    <View style={styles.optionMetaCluster}>
                                      {aiLeanHere ? (
                                        <View style={styles.aiLeanBadge}>
                                          <Text style={styles.aiLeanBadgeText}>AI</Text>
                                        </View>
                                      ) : null}
                                      {hasPicked ? (
                                        <Text style={[styles.optionMeta, selected && styles.optionMetaPicked]}>
                                          {percentage}%
                                          {selected ? (isResolved ? ' · Final' : ' · You') : ''}
                                        </Text>
                                      ) : selected ? (
                                        <Text style={styles.optionMeta}>Selected</Text>
                                      ) : null}
                                    </View>
                                  </View>
                                  {hasPicked ? <InlineDistributionTrack percentage={percentage} /> : null}
                                </Pressable>
                              );
                            })}
                          </View>
                          {hasPicked && aiPickLabel ? (
                            <View style={styles.aiSuggestionCallout} accessibilityRole="text">
                              <Text style={styles.aiSuggestionEyebrow}>ShouldI AI</Text>
                              {userVoteLabel ? (
                                userVoteLabel === aiPickLabel ? (
                                  <Text style={styles.aiSuggestionBody}>
                                    Same leaning as you — we’d shortlist{' '}
                                    <Text style={styles.aiSuggestionEmphasis}>{aiPickLabel}</Text>.
                                  </Text>
                                ) : (
                                  <Text style={styles.aiSuggestionBody}>
                                    You picked <Text style={styles.aiSuggestionEmphasis}>{userVoteLabel}</Text>
                                    {' · '}we’d lean <Text style={styles.aiSuggestionEmphasis}>{aiPickLabel}</Text>.
                                  </Text>
                                )
                              ) : (
                                <Text style={styles.aiSuggestionBody}>
                                  We’d lean toward <Text style={styles.aiSuggestionEmphasis}>{aiPickLabel}</Text>.
                                </Text>
                              )}
                              {item.aiSuggestionNote ? (
                                <Text style={styles.aiSuggestionNote}>{item.aiSuggestionNote}</Text>
                              ) : null}
                            </View>
                          ) : null}
                          <View style={styles.pollFooter}>
                            <Text style={[typography.caption, styles.votesMetaStrong]}>{total.toLocaleString()} votes</Text>
                            {!hasPicked && !isResolved ? (
                              <Text style={[typography.caption, styles.votesMeta]}>Your vote unlocks the bars</Text>
                            ) : !isResolved ? (
                              <Text style={[typography.caption, styles.votesMeta]}>Here’s how everyone leaned</Text>
                            ) : (
                              <Text style={[typography.caption, styles.votesMeta]}>Final community split</Text>
                            )}
                          </View>
                        </>
                      );
                    })()}
                  </View>
                  {status === 'resolved' ? (
                    <View style={styles.outcomeShell}>
                      <Text style={[typography.caption, styles.outcomeEyebrow]}>How it turned out</Text>
                      <Text style={[typography.body, styles.outcomeText]}>{shorten(item.outcome ?? '', 160)}</Text>
                      <Text style={[typography.caption, styles.lessonEyebrow]}>Takeaway</Text>
                      <Text style={[typography.compact, styles.lessonText]}>{shorten(item.takeaway ?? '', 130)}</Text>
                    </View>
                  ) : (
                    <Text style={[typography.caption, styles.pendingInline]}>Outcome still open — follow the thread for updates.</Text>
                  )}
                  <View style={styles.cardActions}>
                    {hasPicked ? (
                      <PrimaryButton
                        accessibilityLabel="Open discussion and full thread"
                        onPress={() =>
                          router.push({
                            pathname: '/decision/[id]',
                            params: { id: item.id, fromReel: '1', reelCategory: item.category },
                          })
                        }>
                        <Text style={styles.buttonLabel}>Open full thread</Text>
                      </PrimaryButton>
                    ) : null}
                    <BouncySwipeCue index={index} cues={swipeCues} />
                  </View>
                  </ColorfulReelCard>
                </ReelCardMotionWrap>
              </ScrollView>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 10,
  },
  cardMotionOuter: {
    marginHorizontal: 12,
  },
  cardColorSurface: {
    flexDirection: 'column',
    borderRadius: 26,
    padding: 22,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: palette.accent,
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
    overflow: 'hidden',
  },
  storyHeadline: {
    color: palette.slate950,
    marginTop: 2,
  },
  storyBody: {
    color: palette.slate800,
    marginTop: 4,
  },
  pollShell: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dfe8fb',
    gap: 10,
  },
  pollShellOpen: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  pollEyebrow: {
    color: palette.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pollQuestion: {
    color: palette.slate950,
    marginTop: -4,
  },
  pollQuestionOpen: {
    marginTop: 0,
    marginBottom: 2,
  },
  pollHint: {
    color: palette.slate500,
    lineHeight: 18,
  },
  pollHintStrong: {
    color: palette.slate900,
    fontWeight: '700',
  },
  pollHintMuted: {
    color: palette.slate500,
  },
  aiSuggestionCallout: {
    marginTop: 2,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124,106,239,0.22)',
    gap: 6,
  },
  aiSuggestionEyebrow: {
    ...typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#5236a8',
  },
  aiSuggestionBody: {
    ...typography.compact,
    color: palette.slate900,
  },
  aiSuggestionEmphasis: {
    fontWeight: '800',
    color: '#482d9f',
  },
  aiSuggestionNote: {
    ...typography.caption,
    color: palette.slate500,
    lineHeight: 18,
    marginTop: 2,
  },
  pollFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dfe8fb',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  votesMetaStrong: {
    color: palette.slate900,
    fontWeight: '700',
  },
  outcomeShell: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e8edf6',
    gap: 8,
  },
  outcomeEyebrow: {
    color: palette.slate500,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  outcomeText: {
    color: palette.slate900,
  },
  lessonEyebrow: {
    marginTop: 6,
    color: palette.mint,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  lessonText: {
    color: palette.slate800,
    lineHeight: 21,
  },
  cardActions: {
    gap: 10,
    marginTop: 2,
  },
  scrollCue: {
    textAlign: 'center',
    color: palette.slate500,
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  swipeCueCluster: {
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingVertical: 4,
  },
  swipeArrow: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.accent,
    marginBottom: -2,
  },
  optionWrap: {
    gap: 10,
  },
  optionPill: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6e0f7',
    backgroundColor: '#f8faff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  optionPillActive: {
    borderColor: '#aac3ff',
    backgroundColor: '#eaf1ff',
  },
  optionPillAiLean: {
    borderColor: 'rgba(139,92,246,0.42)',
    backgroundColor: 'rgba(246,243,255,0.75)',
    borderWidth: 2,
  },
  optionPillDisabled: {
    opacity: 0.92,
  },
  optionPillPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.992 }],
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionMetaCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  aiLeanBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  aiLeanBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#6239b6',
  },
  optionText: {
    ...typography.compact,
    color: palette.slate900,
    flex: 1,
    marginRight: 10,
  },
  optionTextActive: {
    color: palette.accent,
    fontWeight: '700',
  },
  optionMeta: {
    ...typography.caption,
    color: palette.slate500,
    fontWeight: '700',
  },
  optionMetaPicked: {
    color: palette.accent,
  },
  inlineTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#e8edf8',
    overflow: 'hidden',
    width: '100%',
  },
  inlineFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  votesMeta: {
    color: palette.slate500,
    flexShrink: 1,
    textAlign: 'right',
  },
  pendingInline: {
    color: palette.slate500,
    marginTop: 2,
    lineHeight: 18,
    paddingHorizontal: 2,
  },
  buttonLabel: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 16,
  },
});
