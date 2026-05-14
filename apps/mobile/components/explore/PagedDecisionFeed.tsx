import { router } from 'expo-router';
import type { ExploreFeedResponse } from '@shouldi/contracts';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { REEL_SURFACE_FLARE, REEL_SURFACE_GRADIENTS, REEL_SURFACE_MAIN_LOCATIONS } from '@/constants/reelSurfaceGradients';

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

function formatCategoryLabel(category: ExploreFeedCard['category']): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

const REEL_STAR_GRADIENT = ['#fff6e8', '#ffe1b8', '#fecf7a'] as const;
const REEL_BELL_GRADIENT = ['#7aa2ff', '#4d74f7', '#2d53e6'] as const;

function ReelCardActionBar({
  category,
  saved,
  following,
  onToggleSave,
  onToggleFollow,
}: {
  category: ExploreFeedCard['category'];
  saved: boolean;
  following: boolean;
  onToggleSave: () => void;
  onToggleFollow: () => void;
}) {
  const saveLabel = saved ? 'Saved — tap to remove from saved' : 'Save this dilemma';
  const followLabel = following ? 'Following — tap to stop update alerts' : 'Follow for updates';

  return (
    <View style={styles.cardTopRow}>
      <View style={styles.categoryChip}>
        <Text style={styles.categoryChipText}>{formatCategoryLabel(category)}</Text>
      </View>
      <View style={styles.cardIconGroup}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saveLabel}
          hitSlop={8}
          onPress={() => {
            if (Platform.OS !== 'web') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            }
            onToggleSave();
          }}
          style={({ pressed }) => [
            styles.toolbarIconHit,
            saved && styles.toolbarIconHitActiveGlowSave,
            pressed && styles.toolbarIconHitPressed,
          ]}>
          {saved ? (
            <LinearGradient
              colors={[...REEL_STAR_GRADIENT]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.95, y: 1 }}
              style={[styles.toolbarIconGem, Platform.OS === 'android' ? styles.toolbarIconGemRaisedAndroid : null]}>
              <Ionicons name="star" size={19} color="#734210" />
            </LinearGradient>
          ) : (
            <View style={[styles.toolbarIconGem, styles.toolbarIconFrost]}>
              <Ionicons name="star-outline" size={20} color={palette.slate500} />
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={followLabel}
          hitSlop={8}
          onPress={() => {
            if (Platform.OS !== 'web') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            }
            onToggleFollow();
          }}
          style={({ pressed }) => [
            styles.toolbarIconHit,
            following && styles.toolbarIconHitActiveGlowBell,
            pressed && styles.toolbarIconHitPressed,
          ]}>
          {following ? (
            <LinearGradient
              colors={[...REEL_BELL_GRADIENT]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={[styles.toolbarIconGem, Platform.OS === 'android' ? styles.toolbarIconGemRaisedAndroid : null]}>
              <Ionicons name="notifications" size={18} color={palette.white} />
            </LinearGradient>
          ) : (
            <View style={[styles.toolbarIconGem, styles.toolbarIconFrost]}>
              <Ionicons name="notifications-outline" size={19} color={palette.slate500} />
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ReelCardSurface({
  category,
  isOpen,
  children,
}: {
  category: ExploreFeedCard['category'];
  isOpen: boolean;
  children: React.ReactNode;
}) {
  const tint = REEL_SURFACE_GRADIENTS[category];
  const flare = REEL_SURFACE_FLARE[category];
  return (
    <View style={styles.reelCardOuter}>
      <LinearGradient
        pointerEvents="none"
        colors={[...tint]}
        locations={[...REEL_SURFACE_MAIN_LOCATIONS]}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 1, y: 0.98 }}
        style={styles.reelCardAmbient}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[...flare]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.92, y: 0.88 }}
        style={styles.reelCardAmbient}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', '#ffffff']}
        locations={[0.42, 0.72, 1]}
        start={{ x: 0.5, y: 0.08 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.reelCardAmbient}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(248,250,252,0)', 'rgba(15,23,42,0.04)']}
        locations={[0.55, 1]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.reelCardAmbient}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.42, y: 0 }}
        end={{ x: 0.58, y: 0.42 }}
        style={styles.reelCardRim}
      />
      <View style={[styles.reelCardInner, isOpen && styles.reelCardInnerOpen]}>{children}</View>
    </View>
  );
}

export function decisionFeedStatus(card: unknown): 'open' | 'resolved' {
  const value = (card as { status?: string })?.status;
  return value === 'resolved' ? 'resolved' : 'open';
}

const DEFAULT_SWIPE_CUES = [
  'Swipe up for the next question',
  'More perspectives on the next card ↑',
  'Keep scrolling for another vote',
  'Next dilemma above',
  'Pull up when you’re ready for more',
] as const;

export const PLOT_DECK_SWIPE_CUES = [
  'Swipe up — see another outcome',
  'Next reel above',
  'More settled threads when you swipe ↑',
  'Continue for the next story',
  'Swipe when you’d like another result',
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

function compactVoteCount(n: number): string {
  try {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return n.toLocaleString();
  }
}

function LiveVotesPill({
  voteTotal,
  isLivePoll,
  inline,
}: {
  voteTotal: number;
  isLivePoll: boolean;
  inline?: boolean;
}) {
  return (
    <View
      style={[styles.headerVotePill, inline && styles.headerVotePillInline]}
      accessibilityRole="text"
      accessibilityLabel={`${voteTotal.toLocaleString()} ${isLivePoll ? 'live votes' : 'total votes'}`}>
      {isLivePoll ? <LivePulseDot /> : null}
      <View style={[styles.headerVoteTextStack, inline && styles.headerVoteTextStackInline]}>
        <Text style={[styles.headerVoteStrong, inline && styles.headerVoteStrongInline]}>
          {compactVoteCount(voteTotal)}
        </Text>
        <Text style={[styles.headerVoteMicro, inline && styles.headerVoteMicroInline]}>
          {isLivePoll ? 'Live · voted' : 'Total votes'}
        </Text>
      </View>
    </View>
  );
}

function LivePulseDot() {
  const pulse = React.useRef(new Animated.Value(0.35)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 820,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 820,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.livePulseDot,
        {
          opacity: pulse,
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0.35, 1],
                outputRange: [0.94, 1.12],
              }),
            },
          ],
        },
      ]}
    />
  );
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
      <Animated.View style={{ opacity: arrowOpacity, transform: [{ translateY: arrowY }] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.swipeCueOrb}>
          <Ionicons name="chevron-up" size={21} color={palette.slate500} />
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
                      saved={effectiveBool(saveOverrides, item.id, item.savedByMe ?? false)}
                      following={effectiveBool(followOverrides, item.id, item.followedByMe ?? false)}
                      onToggleSave={() => toggleSaveForCard(item)}
                      onToggleFollow={() => toggleFollowForCard(item)}
                    />
                    <View style={styles.pollQuestionRow}>
                      <Text
                        accessibilityRole="header"
                        style={[
                          isOpen ? typography.hero : typography.h2,
                          styles.pollQuestion,
                          styles.pollQuestionFlexible,
                          isOpen && styles.pollQuestionOpen,
                          isOpen && styles.pollHeroOpen,
                        ]}>
                        {item.question}
                      </Text>
                      <LiveVotesPill voteTotal={voteTotalAll} isLivePoll={isOpen} inline />
                    </View>
                    {isOpen && !hasPicked ? (
                      <Text style={styles.pickPrompt}>Tap an option to vote.</Text>
                    ) : null}
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
                          {hasPicked ? (
                            <PrimaryButton
                              accessibilityLabel="Open discussion thread"
                              style={styles.discussButtonBelowChoices}
                              onPress={() =>
                                router.push({
                                  pathname: '/decision/[id]',
                                  params: { id: item.id, fromReel: '1', reelCategory: item.category },
                                })
                              }>
                              <Text style={styles.buttonLabel}>Discuss</Text>
                            </PrimaryButton>
                          ) : null}
                          {hasPicked || isResolved ? (
                            <Text style={[typography.caption, styles.pollPhaseCaption]}>
                              {isResolved ? 'Community result · voting closed.' : 'Totals update automatically as votes come in.'}
                            </Text>
                          ) : null}
                          {hasPicked && aiPickLabel ? (
                            <View style={styles.aiSuggestionCallout} accessibilityRole="text">
                              <Text style={styles.aiSuggestionEyebrow}>ShouldI assistant</Text>
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
  reelCardOuter: {
    flexDirection: 'column',
    borderRadius: 28,
    borderWidth: Platform.OS === 'ios' ? 1 : StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(248,250,252,0.94)',
    overflow: 'hidden',
    shadowColor: '#1e293b',
    shadowOpacity: Platform.OS === 'ios' ? 0.16 : 0.2,
    shadowRadius: Platform.OS === 'ios' ? 34 : 24,
    shadowOffset: { width: 0, height: Platform.OS === 'ios' ? 16 : 10 },
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  reelCardAmbient: {
    ...StyleSheet.absoluteFillObject,
  },
  reelCardRim: {
    ...StyleSheet.absoluteFillObject,
    opacity: Platform.OS === 'android' ? 0.92 : 1,
  },
  reelCardInner: {
    flexDirection: 'column',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 15,
    gap: 14,
    position: 'relative',
    zIndex: 1,
  },
  reelCardInnerOpen: {
    gap: 11,
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
    minHeight: 40,
    paddingHorizontal: 0,
  },
  categoryChip: {
    alignSelf: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
    maxWidth: '58%',
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
      default: {},
    }),
  },
  categoryChipText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0.25,
    color: palette.slate800,
    textTransform: 'capitalize',
  },
  cardIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  toolbarIconHit: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarIconHitPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.95 }],
  },
  toolbarIconHitActiveGlowSave: Platform.select({
    ios: {
      shadowColor: '#d9a046',
      shadowOpacity: 0.35,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
    },
    default: {},
  }),
  toolbarIconHitActiveGlowBell: Platform.select({
    ios: {
      shadowColor: palette.accent,
      shadowOpacity: 0.4,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    default: {},
  }),
  toolbarIconGem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toolbarIconGemRaisedAndroid: {
    elevation: 3,
  },
  toolbarIconFrost: {
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.07)',
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.035,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  headerVotePill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.07)',
    shadowColor: '#0b1224',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerVotePillInline: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 84,
    maxWidth: 124,
    gap: 5,
    marginTop: Platform.OS === 'ios' ? 8 : 6,
  },
  headerVoteTextStack: {
    alignItems: 'center',
  },
  headerVoteTextStackInline: {
    alignItems: 'center',
    minWidth: 0,
  },
  headerVoteStrong: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    color: palette.slate950,
    letterSpacing: -0.35,
  },
  headerVoteMicro: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: palette.slate500,
    letterSpacing: 0.15,
  },
  headerVoteStrongInline: {
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: -0.35,
  },
  headerVoteMicroInline: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.08,
    textAlign: 'center',
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: palette.mint,
  },
  pollQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 2,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15,23,42,0.06)',
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  pollQuestionFlexible: {
    flex: 1,
    minWidth: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  pollQuestion: {
    color: palette.slate950,
    marginTop: 0,
  },
  pollQuestionOpen: {
    marginTop: 0,
    marginBottom: 0,
  },
  pollHeroOpen: {
    fontWeight: '600',
    letterSpacing: -0.52,
    lineHeight: 33,
  },
  pickPrompt: {
    ...typography.caption,
    color: palette.slate500,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 6,
    lineHeight: 18,
    letterSpacing: 0.08,
  },
  pollPhaseCaption: {
    color: palette.slate500,
    lineHeight: 18,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 12,
    fontWeight: '500',
    fontSize: 12,
    letterSpacing: 0.15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.055)',
  },
  aiSuggestionCallout: {
    marginTop: 6,
    padding: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#64748b',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  aiSuggestionEyebrow: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.55,
    color: palette.slate500,
    textTransform: 'none',
  },
  aiSuggestionBody: {
    ...typography.compact,
    color: palette.slate800,
    fontWeight: '500',
    lineHeight: 21,
  },
  aiSuggestionEmphasis: {
    fontWeight: '700',
    color: palette.slate900,
  },
  aiSuggestionNote: {
    ...typography.caption,
    color: palette.slate500,
    lineHeight: 17,
    marginTop: 2,
    fontWeight: '500',
  },
  outcomeMerged: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.06)',
    gap: 8,
  },
  outcomeEyebrow: {
    color: palette.slate500,
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 0.08,
    fontSize: 12,
    marginBottom: 2,
  },
  outcomeText: {
    color: palette.slate900,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: 2,
  },
  lessonEyebrow: {
    marginTop: 8,
    marginBottom: 2,
    color: palette.slate500,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'none',
    letterSpacing: 0.08,
  },
  lessonText: {
    color: palette.slate800,
    lineHeight: 22,
    fontWeight: '400',
  },
  scrollCue: {
    textAlign: 'center',
    color: palette.slate500,
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
    borderColor: 'rgba(15,23,42,0.08)',
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
  optionWrap: {
    gap: 10,
  },
  optionPill: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 15,
    paddingVertical: 14,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    shadowColor: '#334e73',
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: Platform.OS === 'android' ? 1 : 0,
  },
  optionPillActive: {
    borderColor: 'rgba(45,107,255,0.42)',
    backgroundColor: 'rgba(255,255,255,0.93)',
  },
  optionPillAiLean: {
    borderColor: 'rgba(69,134,255,0.5)',
    backgroundColor: 'rgba(233,239,255,0.92)',
    borderWidth: 1,
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
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(45,107,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(45,107,255,0.18)',
  },
  aiLeanBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.45,
    color: palette.accent,
  },
  optionText: {
    ...typography.compact,
    color: palette.slate900,
    flex: 1,
    marginRight: 10,
  },
  optionTextActive: {
    color: palette.accent,
    fontWeight: '600',
  },
  optionMeta: {
    ...typography.caption,
    color: palette.slate500,
    fontWeight: '700',
  },
  optionMetaPicked: {
    color: palette.accent,
    fontWeight: '600',
  },
  inlineTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.slate200,
    overflow: 'hidden',
    width: '100%',
  },
  inlineFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  buttonLabel: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 16,
  },
});
