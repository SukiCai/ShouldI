import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Animated,
  BackHandler,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscussExpandTransition, DiscussExpanded, DiscussScreenBackdrop } from '@/components/decide/discuss';
import { decisionFeedStatus } from '@/components/explore/PagedDecisionFeed';
import { ExploreDecisionCard } from '@/components/explore/ExploreDecisionCard';
import { exploreCategoryTheme } from '@/components/explore/exploreCategoryTheme';
import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import { reelSurfaceGradientCoarse } from '@/constants/reelSurfaceGradients';
import { radius, screenContentGutter, semantic, themeSurface, typography } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetJson, GATEWAY_ORIGIN } from '@/lib/api';
import { trackProductEvent } from '@/lib/analytics';
import {
  clearPendingHighlightCardId,
  peekPendingHighlightCardId,
  usePostedCommunityCards,
} from '@/lib/exploreCommunityPosts';
import type { DecisionCategory, ExploreCard } from '@shouldi/contracts';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

const FILTERS = ['All', 'Career', 'Money', 'Relationship', 'Life'] as const;

const CATEGORY_FILTER: Record<DecisionCategory, (typeof FILTERS)[number]> = {
  career: 'Career',
  money: 'Money',
  relationship: 'Relationship',
  life: 'Life',
};

function formatCompact(n: number): string {
  try {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return n.toLocaleString();
  }
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const { highlightCardId: highlightCardIdParam } = useLocalSearchParams<{ highlightCardId?: string }>();
  const postedCommunityCards = usePostedCommunityCards();
  const scrollRef = React.useRef<ScrollView>(null);
  const [activeFilter, setActiveFilter] = React.useState<(typeof FILTERS)[number]>('All');
  const [selectedByCard, setSelectedByCard] = React.useState<Record<string, string>>({});
  const [localDistributionByCard, setLocalDistributionByCard] = React.useState<Record<string, Record<string, number>>>({});
  const [toast, setToast] = React.useState<string | null>(null);
  const [activeDetailCardId, setActiveDetailCardId] = React.useState<string | null>(null);
  const [highlightedCardId, setHighlightedCardId] = React.useState<string | null>(null);
  const livePulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [livePulse]);

  React.useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  React.useEffect(() => {
    if (!highlightedCardId) return;
    const timer = setTimeout(() => setHighlightedCardId(null), 4500);
    return () => clearTimeout(timer);
  }, [highlightedCardId]);

  const lastHandledHighlightRef = React.useRef<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const highlightId =
        peekPendingHighlightCardId() ??
        (typeof highlightCardIdParam === 'string' ? highlightCardIdParam : null);
      if (!highlightId || lastHandledHighlightRef.current === highlightId) return;
      lastHandledHighlightRef.current = highlightId;
      const postedCard = postedCommunityCards.find((card) => card.id === highlightId);
      if (postedCard) {
        setActiveFilter(CATEGORY_FILTER[postedCard.category]);
      }
      setHighlightedCardId(highlightId);
      setToast('Posted to community');
      clearPendingHighlightCardId();
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
    }, [highlightCardIdParam, postedCommunityCards]),
  );

  const query = useQuery({
    queryKey: ['explore'],
    queryFn: async () => {
      const json = await apiGetJson('/v1/explore');
      return ExploreFeedResponseSchema.parse(json);
    },
  });

  const cards = query.data?.cards ?? [];
  const openCards = React.useMemo(() => {
    const postedIds = new Set(postedCommunityCards.map((card) => card.id));
    const apiOpen = cards.filter((card) => decisionFeedStatus(card) === 'open' && !postedIds.has(card.id));
    return [...postedCommunityCards, ...apiOpen];
  }, [cards, postedCommunityCards]);
  const visibleCards = React.useMemo(() => {
    if (activeFilter === 'All') return openCards;
    return openCards.filter((card) => card.category.toLowerCase() === activeFilter.toLowerCase());
  }, [activeFilter, openCards]);

  const cardsById = React.useMemo(() => {
    const m = new Map<string, ExploreCard>();
    for (const card of openCards) m.set(card.id, card);
    return m;
  }, [openCards]);

  const activeDetailCard = React.useMemo(() => {
    if (!activeDetailCardId) return null;
    const base = cardsById.get(activeDetailCardId);
    if (!base) return null;
    const localDistribution = localDistributionByCard[base.id];
    const distribution = localDistribution
      ? base.options.map((option) => ({ optionId: option.id, votes: localDistribution[option.id] ?? 0 }))
      : base.distribution;
    const selectedOption = selectedByCard[base.id] ?? base.myVoteOptionId;
    return {
      ...base,
      distribution,
      myVoteOptionId: selectedOption ?? undefined,
    };
  }, [activeDetailCardId, cardsById, localDistributionByCard, selectedByCard]);

  const recordVote = React.useCallback(async (card: ExploreCard, optionId: string, source: 'option_direct' | 'expanded_option') => {
    const previousVote = selectedByCard[card.id] ?? card.myVoteOptionId ?? null;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    setSelectedByCard((prev) => ({ ...prev, [card.id]: optionId }));
    setLocalDistributionByCard((prev) => {
      const baseDistribution =
        prev[card.id] ??
        Object.fromEntries(card.distribution.map((row) => [row.optionId, row.votes]));
      const nextDistribution = { ...baseDistribution };
      if (previousVote && previousVote !== optionId) {
        nextDistribution[previousVote] = Math.max(0, (nextDistribution[previousVote] ?? 0) - 1);
      }
      if (previousVote !== optionId) {
        nextDistribution[optionId] = (nextDistribution[optionId] ?? 0) + 1;
      }
      return { ...prev, [card.id]: nextDistribution };
    });
    setToast('Vote recorded');
    await trackProductEvent({
      name: 'vote_cast',
      cardId: card.id,
      metadata: {
        source,
      },
    });
  }, [selectedByCard]);

  const openDetailCard = React.useCallback((card: ExploreCard) => {
    setActiveDetailCardId(card.id);
  }, []);

  const closeDetailCard = React.useCallback(() => {
    setActiveDetailCardId(null);
  }, []);

  React.useEffect(() => {
    if (!activeDetailCardId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDetailCard();
      return true;
    });
    return () => sub.remove();
  }, [activeDetailCardId, closeDetailCard]);

  if (query.isLoading) {
    return <AppLaunchScreen detail="Loading reels…" />;
  }

  if (query.error) {
    return (
      <View style={[styles.errorWrap, { backgroundColor: surface.canvas }]}>
        <Text style={[styles.errorTitle, { color: surface.textDisplay }]}>Couldn't connect</Text>
        <Text style={[styles.errorBody, { color: surface.textMuted }]}>{`Trying ${GATEWAY_ORIGIN}\nRun npm run api locally`}</Text>
        <Pressable onPress={() => query.refetch()} style={[styles.retryBtn, { backgroundColor: semantic.actionPrimary }]}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.surface, { backgroundColor: surface.canvas }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top + 10, 28),
          paddingBottom: Math.max(insets.bottom + 90, 120),
        }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: surface.textDisplay }]}>Explore</Text>
            <Text style={[styles.subtitle, { color: surface.textMuted }]}>Start with one vote. Learn from real decision outcomes.</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            {FILTERS.map((filter) => {
              const active = filter === activeFilter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive,
                    active ? { backgroundColor: semantic.actionPrimary } : null,
                  ]}>
                  <Text style={[styles.filterLabel, { color: surface.textMuted }, active && styles.filterLabelActive]}>{filter}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.listWrap}>
          {visibleCards.slice(0, 8).map((card) => {
            const theme = exploreCategoryTheme(card.category);
            const distributionMap = localDistributionByCard[card.id] ?? Object.fromEntries(card.distribution.map((row) => [row.optionId, row.votes]));
            const totalVotes = card.options.reduce((sum, option) => sum + (distributionMap[option.id] ?? 0), 0);
            const effectivePicked = selectedByCard[card.id] ?? card.myVoteOptionId ?? null;
            const votePctByOptionId = Object.fromEntries(
              card.options.map((option) => {
                const rowVotes = distributionMap[option.id] ?? 0;
                const pct = totalVotes > 0 ? Math.round((rowVotes / totalVotes) * 100) : 0;
                return [option.id, pct];
              }),
            );
            return (
              <ExploreDecisionCard
                key={card.id}
                mode="live"
                highlighted={card.id === highlightedCardId}
                category={card.category}
                question={card.question}
                options={card.options}
                votePctByOptionId={votePctByOptionId}
                effectivePicked={effectivePicked}
                aiSuggestedOptionId={card.aiSuggestedOptionId}
                totalVotes={totalVotes}
                livePulse={livePulse}
                onPressQuestion={() => openDetailCard(card)}
                onVote={(optionId) => {
                  void recordVote(card, optionId, 'option_direct');
                }}
                onOpenDetails={() => openDetailCard(card)}
              />
            );
          })}
          {visibleCards.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder }]}>
              <Text style={[styles.emptyTitle, { color: surface.textDisplay }]}>You're caught up</Text>
              <Text style={[styles.emptyBody, { color: surface.textMuted }]}>No open decisions in this filter. Check Outcome Replay instead.</Text>
              <Pressable onPress={() => router.push('/outcome-replay')} style={[styles.retryBtn, { backgroundColor: semantic.actionPrimary }]}>
                <Text style={styles.retryText}>Open Outcome Replay</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={[styles.toast, { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder }]}>
            <Text style={[styles.toastText, { color: surface.textPrimary }]}>{toast}</Text>
          </View>
        </View>
      ) : null}

      {activeDetailCard ? (
        <View style={[styles.detailOverlayShell, { backgroundColor: surface.canvas }]}>
          <DiscussExpandTransition>
            <DiscussScreenBackdrop
              category={activeDetailCard.category as DecisionCategory}
              coarseGradient={reelSurfaceGradientCoarse(activeDetailCard.category as DecisionCategory)}
              showGradient={false}
              showAtmosphere={false}
              opaqueBackgroundColor={surface.canvas}>
              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={{
                  paddingTop: Math.max(insets.top + 4, 12),
                  paddingLeft: Math.max(insets.left, 0),
                  paddingRight: Math.max(insets.right, 0),
                  paddingBottom: Math.max(insets.bottom + 8, 16),
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <DiscussExpanded
                  card={activeDetailCard}
                  pickedOptionOverride={selectedByCard[activeDetailCard.id] ?? activeDetailCard.myVoteOptionId ?? null}
                  distributionOverride={localDistributionByCard[activeDetailCard.id]}
                  onRequestClose={closeDetailCard}
                  onSelectOption={(optionId) => {
                    void recordVote(activeDetailCard, optionId, 'expanded_option');
                  }}
                />
              </ScrollView>
            </DiscussScreenBackdrop>
          </DiscussExpandTransition>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scroll: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenContentGutter,
    marginBottom: 14,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  title: {
    ...typography.hero,
    color: '#0c0d10',
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.8,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.compact,
    color: 'rgba(60,60,67,0.72)',
    marginTop: 2,
  },
  filterRow: {
    paddingHorizontal: screenContentGutter,
    marginBottom: 12,
  },
  filterContent: {
    gap: 10,
    paddingRight: 8,
  },
  filterChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#111113',
  },
  filterLabel: {
    ...typography.compact,
    color: 'rgba(60,60,67,0.75)',
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#ffffff',
  },
  listWrap: {
    paddingHorizontal: screenContentGutter,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    shadowColor: '#0b1224',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  cardHeaderTapArea: {
    borderRadius: 12,
  },
  cardHeaderTapAreaPressed: {
    opacity: 0.92,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  cardCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDotWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
  cardMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  votesMetaLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16,185,129,0.22)',
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  votesMetaLiveLabel: {
    ...typography.micro,
    color: '#059669',
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  votesMetaCount: {
    ...typography.caption,
    fontWeight: '700',
  },
  question: {
    ...typography.title,
    color: '#121316',
    marginTop: 6,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  rows: {
    gap: 9,
  },
  rowLine: {
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  rowLineSelected: {
    backgroundColor: 'rgba(79,118,194,0.08)',
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLabel: {
    ...typography.caption,
    color: '#3a3d44',
    flex: 1,
  },
  rowPct: {
    ...typography.caption,
    fontWeight: '700',
  },
  track: {
    height: 3,
    borderRadius: 999,
    backgroundColor: '#eceef3',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  people: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  avatarOverlap: {
    marginLeft: -6,
  },
  peopleText: {
    ...typography.caption,
    flex: 1,
    fontWeight: '600',
  },
  voteBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  voteBtnText: {
    ...typography.compact,
    fontWeight: '700',
  },
  empty: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    ...typography.h2,
    color: '#111113',
  },
  emptyBody: {
    ...typography.compact,
    color: 'rgba(60,60,67,0.68)',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 28,
    gap: 10,
  },
  errorTitle: {
    ...typography.title,
    color: '#111113',
    fontWeight: '800',
  },
  errorBody: {
    ...typography.compact,
    color: 'rgba(60,60,67,0.72)',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: '#111113',
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    ...typography.compact,
    color: '#fff',
    fontWeight: '700',
  },
  toastWrap: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  toastText: {
    ...typography.compact,
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 10,
  },
  sheetTitle: {
    ...typography.titleSm,
    fontWeight: '800',
  },
  sheetAction: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  sheetActionText: {
    ...typography.bodySm,
    fontWeight: '600',
  },
  detailOverlayShell: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  detailScroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
