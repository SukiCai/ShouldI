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
import { TabScreenHeader } from '@/components/screen/TabScreenHeader';
import { decisionFeedStatus } from '@/components/explore/PagedDecisionFeed';
import { ExploreDecisionCard } from '@/components/explore/ExploreDecisionCard';
import { exploreCategoryTheme } from '@/components/explore/exploreCategoryTheme';
import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import { reelSurfaceGradientCoarse } from '@/constants/reelSurfaceGradients';
import { radius, screenContentGutter, semantic, themeSurface, typography, palette } from '@/constants/theme';
import { ctaStyles } from '@/components/screen/ctaStyles';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetJson, GATEWAY_ORIGIN } from '@/lib/api';
import { trackProductEvent } from '@/lib/analytics';
import { recordParticipation } from '@/lib/exploreUserActivity';
import {
  consumeHighlightRequest,
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
      const highlightRequest = consumeHighlightRequest();
      const highlightId =
        highlightRequest?.id ??
        (typeof highlightCardIdParam === 'string' ? highlightCardIdParam : null);
      if (!highlightId) return;

      const isFreshRequest = highlightRequest != null;
      if (!isFreshRequest && lastHandledHighlightRef.current === highlightId) return;
      lastHandledHighlightRef.current = highlightId;

      const postedCard = postedCommunityCards.find((card) => card.id === highlightId);
      if (postedCard) {
        setActiveFilter(CATEGORY_FILTER[postedCard.category]);
      }
      setHighlightedCardId(highlightId);
      setToast(
        highlightRequest?.source === 'publish' ? 'Posted to community' : 'Your community post',
      );
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
    recordParticipation(card, optionId);
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
        <Pressable onPress={() => query.refetch()} style={ctaStyles.primary}>
          <Text style={ctaStyles.primaryLabel}>Retry</Text>
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
        <TabScreenHeader
          title="Explore"
          subtitle="Start with one vote. Learn from real decision outcomes."
          textDisplay={surface.textDisplay}
          textMuted={surface.textMuted}
          groupedSurface={surface.groupedSurface}
          hairline={surface.hairline}
          textPrimary={surface.textPrimary}
        />

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            {FILTERS.map((filter) => {
              const active = filter === activeFilter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[
                    ctaStyles.segmentChip,
                    active ? { backgroundColor: semantic.actionPrimary } : null,
                  ]}>
                  <Text
                    style={[
                      ctaStyles.segmentChipLabel,
                      { color: active ? palette.sheet : surface.textMuted },
                      active && ctaStyles.segmentChipLabelActive,
                    ]}>
                    {filter}
                  </Text>
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
              <Pressable onPress={() => router.push('/(tabs)/replay')} style={ctaStyles.primary}>
                <Text style={ctaStyles.primaryLabel}>Open Outcome Replay</Text>
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
  },
  scroll: {
    flex: 1,
  },
  filterRow: {
    paddingHorizontal: screenContentGutter,
    marginBottom: 12,
  },
  filterContent: {
    gap: 10,
    paddingRight: 8,
  },
  listWrap: {
    paddingHorizontal: screenContentGutter,
    gap: 12,
  },
  empty: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 6,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.title,
    fontWeight: '800',
  },
  emptyBody: {
    ...typography.compact,
    lineHeight: 21,
    textAlign: 'center',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  errorTitle: {
    ...typography.title,
    fontWeight: '800',
  },
  errorBody: {
    ...typography.compact,
    lineHeight: 21,
    textAlign: 'center',
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
  detailOverlayShell: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  detailScroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
