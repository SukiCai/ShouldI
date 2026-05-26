import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ExploreFeedResponse } from '@shouldi/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

import PrimaryButton from '@/components/ui/PrimaryButton';
import {
  reelDiscussStyles,
  ReelCardSurface,
  ReelCardActionBar,
  LiveVotesPill,
  InlineDistributionTrack,
} from '@/components/explore/ReelDiscussChrome';
import { palette, profileNeutralStroke, profileTypography, typography } from '@/constants/theme';

export type ExploreFeedCard = ExploreFeedResponse['cards'][number];

const STORAGE_REEL_SAVE_OVERRIDES = '@shouldi/v1/reel_save_overrides';
const STORAGE_REEL_FOLLOW_OVERRIDES = '@shouldi/v1/reel_follow_overrides';

/** User toggles — keys omitted when aligned with API default again. */
type IdBoolMap = Record<string, boolean>;

function effectiveBool(overrides: IdBoolMap, id: string, serverFallback: boolean): boolean {
  const o = overrides[id];
  return o !== undefined ? o : serverFallback;
}

function bumpOverride(
  setOverrides: React.Dispatch<React.SetStateAction<IdBoolMap>>,
  storageKey: string,
  id: string,
  serverFallback: boolean,
): void {
  setOverrides((prev) => {
    const current = prev[id] !== undefined ? prev[id]! : serverFallback;
    const next = !current;
    const n = { ...prev };
    if (next === serverFallback) delete n[id];
    else n[id] = next;
    void AsyncStorage.setItem(storageKey, JSON.stringify(n)).catch(() => undefined);
    return n;
  });
}



export function decisionFeedStatus(card: unknown): 'open' | 'resolved' {
  const value = (card as { status?: string })?.status;
  return value === 'resolved' ? 'resolved' : 'open';
}

const DEFAULT_SWIPE_CUES = [
  'Next card ↑',
  'Swipe up',
  'More above',
] as const;

export const PLOT_DECK_SWIPE_CUES = [
  'Next story ↑',
  'Swipe up',
  'Continue above',
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

/** Short rationale for why the assistant leans toward one option — read-only, no voting UI. */
function AiDecisionReasonCard({
  v,
}: {
  v: NonNullable<ExploreFeedCard['aiValidation']>;
}) {
  const detail = shorten(v.verdictBecause, 300);
  return (
    <View
      style={styles.aiReasonCard}
      accessibilityRole="text"
      accessibilityLabel={`Assistant lean: ${v.verdictLine}. ${detail}`}>
      <View style={styles.aiReasonEyebrowRow}>
        <View style={styles.aiReasonBadge}>
          <Text style={styles.aiReasonBadgeLabel}>AI</Text>
        </View>
        <Text style={styles.aiReasonEyebrow}>Why this lean</Text>
      </View>
      <Text style={styles.aiReasonLead}>{v.verdictLine}</Text>
      <Text style={[typography.compact, styles.aiReasonBody]}>{detail}</Text>
    </View>
  );
}

function totalVotesFromCard(card: ExploreFeedCard): number {
  return card.distribution.reduce((sum, d) => sum + d.votes, 0);
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
      <Animated.View style={{ opacity: arrowOpacity, transform: [{ translateY: arrowY }] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.swipeCueOrb}>
          <Ionicons name="chevron-up" size={21} color={profileTypography.subdued} />
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
}: PagedDecisionFeedProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [selectedByCard, setSelectedByCard] = React.useState<Record<string, string>>({});
  const [saveOverrides, setSaveOverrides] = React.useState<IdBoolMap>({});
  const [followOverrides, setFollowOverrides] = React.useState<IdBoolMap>({});
  const [feedViewportH, setFeedViewportH] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [rawS, rawF] = await Promise.all([
          AsyncStorage.getItem(STORAGE_REEL_SAVE_OVERRIDES),
          AsyncStorage.getItem(STORAGE_REEL_FOLLOW_OVERRIDES),
        ]);
        if (cancelled) return;
        if (rawS) {
          const parsed = JSON.parse(rawS) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const rec: IdBoolMap = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === 'boolean') rec[k] = v;
            }
            setSaveOverrides(rec);
          }
        }
        if (rawF) {
          const parsed = JSON.parse(rawF) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const rec: IdBoolMap = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === 'boolean') rec[k] = v;
            }
            setFollowOverrides(rec);
          }
        }
      } catch {
        /* ignore malformed storage */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSaveForCard = React.useCallback((card: ExploreFeedCard) => {
    bumpOverride(setSaveOverrides, STORAGE_REEL_SAVE_OVERRIDES, card.id, card.savedByMe ?? false);
  }, []);

  const toggleFollowForCard = React.useCallback((card: ExploreFeedCard) => {
    bumpOverride(setFollowOverrides, STORAGE_REEL_FOLLOW_OVERRIDES, card.id, card.followedByMe ?? false);
  }, []);

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
          const voteTotalAll = totalVotesFromCard(item);
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
                  <ReelCardSurface category={item.category} isOpen={isOpen}>
                    <ReelCardActionBar
                      category={item.category}
                      rewardPoints={item.rewardPoints}
                      saved={effectiveBool(saveOverrides, item.id, item.savedByMe ?? false)}
                      following={effectiveBool(followOverrides, item.id, item.followedByMe ?? false)}
                      onToggleSave={() => toggleSaveForCard(item)}
                      onToggleFollow={() => toggleFollowForCard(item)}
                    />
                    <View style={reelDiscussStyles.pollQuestionRow}>
                      <View style={reelDiscussStyles.pollQuestionTextCol}>
                        <Text
                          accessibilityRole="header"
                          style={[
                            isOpen ? typography.hero : typography.h2,
                            reelDiscussStyles.pollQuestion,
                            isOpen && reelDiscussStyles.pollQuestionOpen,
                            isOpen && reelDiscussStyles.pollHeroOpen,
                          ]}>
                          {item.question}
                        </Text>
                        <View style={reelDiscussStyles.pollQuestionUnderline} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                      </View>
                      <LiveVotesPill voteTotal={voteTotalAll} isLivePoll={isOpen} inline />
                    </View>
                    {isOpen && !hasPicked ? (
                      <Text style={styles.pickPrompt}>Pick an option.</Text>
                    ) : null}
                    {(() => {
                      const total = totalVotesFromCard(item);
                      const aiPickId = item.aiSuggestedOptionId;
                      return (
                        <>
                          <View style={reelDiscussStyles.optionWrap}>
                            {item.options.map((option) => {
                              const votes = item.distribution.find((d) => d.optionId === option.id)?.votes ?? 0;
                              const percentage = total > 0 ? Math.round((votes / total) * 100) : 0;
                              const selected = effectivePicked === option.id;
                              const aiLeanHere = !!(hasPicked && aiPickId && option.id === aiPickId);
                              const pollBar =
                                selected ? 'user' : aiLeanHere ? 'ai' : ('neutral' as const);
                              const pickedSurfaceStyle =
                                hasPicked && selected && aiLeanHere
                                  ? reelDiscussStyles.optionPillUserAndAiPick
                                  : hasPicked && selected && !aiLeanHere
                                    ? reelDiscussStyles.optionPillUserPick
                                    : hasPicked && !selected && aiLeanHere
                                      ? reelDiscussStyles.optionPillAiLeanOnly
                                      : undefined;
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
                                    if (Platform.OS !== 'web') {
                                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                                    }
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setSelectedByCard((prev) => ({
                                      ...prev,
                                      [item.id]: option.id,
                                    }));
                                  }}
                                  style={({ pressed }) => [
                                    reelDiscussStyles.optionPill,
                                    pickedSurfaceStyle,
                                    isResolved && reelDiscussStyles.optionPillDisabled,
                                    !isResolved && pressed && reelDiscussStyles.optionPillPressed,
                                  ]}>
                                  <View style={reelDiscussStyles.optionTopRow}>
                                    <Text style={[reelDiscussStyles.optionText, selected && reelDiscussStyles.optionTextActive]}>{option.label}</Text>
                                    <View style={reelDiscussStyles.optionMetaCluster}>
                                      {selected && hasPicked ? (
                                        <View style={reelDiscussStyles.userPickBadge}>
                                          <Text style={reelDiscussStyles.userPickBadgeText}>YOU</Text>
                                        </View>
                                      ) : null}
                                      {aiLeanHere ? (
                                        <View style={reelDiscussStyles.aiLeanBadge}>
                                          <Text style={reelDiscussStyles.aiLeanBadgeText}>AI</Text>
                                        </View>
                                      ) : null}
                                      {hasPicked ? (
                                        <Text style={[reelDiscussStyles.optionMeta, selected && reelDiscussStyles.optionMetaPicked]}>
                                          {percentage}%
                                          {selected ? (isResolved ? ' · Final' : ' · You') : ''}
                                        </Text>
                                      ) : selected ? (
                                        <Text style={reelDiscussStyles.optionMeta}>Selected</Text>
                                      ) : null}
                                    </View>
                                  </View>
                                  {hasPicked ? <InlineDistributionTrack percentage={percentage} emphasis={pollBar} /> : null}
                                </Pressable>
                              );
                            })}
                          </View>
                          {hasPicked && item.aiValidation ? <AiDecisionReasonCard v={item.aiValidation} /> : null}
                          {hasPicked ? (
                            <PrimaryButton
                              accessibilityLabel="Open discussion"
                              style={styles.discussButtonBelowChoices}
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
                              }>
                              <Text style={styles.buttonLabel}>Thread</Text>
                            </PrimaryButton>
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
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cardMotionOuter: {
    marginHorizontal: 12,
  },
  discussButtonBelowChoices: {
    marginTop: 6,
    marginBottom: 2,
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
    color: profileTypography.subdued,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 6,
    lineHeight: 18,
    letterSpacing: 0.08,
  },
  aiReasonCard: {
    marginHorizontal: 2,
    marginTop: 4,
    marginBottom: 2,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(253,253,253,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.08),
    borderLeftWidth: 4,
    borderLeftColor: palette.heroInk,
    gap: 9,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.045,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 1 },
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
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: palette.heroInk,
  },
  aiReasonBadgeLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.55,
    color: palette.sheet,
  },
  aiReasonEyebrow: {
    ...typography.caption,
    fontWeight: '600',
    color: profileTypography.subdued,
    letterSpacing: 0.12,
    flex: 1,
  },
  aiReasonLead: {
    ...typography.h2,
    color: profileTypography.ink,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 24,
    fontSize: 17,
  },
  aiReasonBody: {
    color: profileTypography.body,
    lineHeight: 21,
    fontWeight: '500',
  },
  outcomeMerged: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: profileNeutralStroke(0.06),
    gap: 8,
  },
  outcomeEyebrow: {
    color: profileTypography.subdued,
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 0.08,
    fontSize: 12,
    marginBottom: 2,
  },
  outcomeText: {
    color: profileTypography.body,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: 2,
  },
  lessonEyebrow: {
    marginTop: 8,
    marginBottom: 2,
    color: profileTypography.subdued,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'none',
    letterSpacing: 0.08,
  },
  lessonText: {
    color: profileTypography.emphasis,
    lineHeight: 22,
    fontWeight: '400',
  },
  scrollCue: {
    textAlign: 'center',
    color: profileTypography.subdued,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.08),
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

  buttonLabel: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 16,
  },
});
