import { router, useFocusEffect } from 'expo-router';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscussExpandTransition, DiscussExpanded, DiscussScreenBackdrop } from '@/components/decide/discuss';
import { TabScreenHeader } from '@/components/screen/TabScreenHeader';
import { decisionFeedStatus } from '@/components/explore/PagedDecisionFeed';
import { ExploreDecisionCard } from '@/components/explore/ExploreDecisionCard';
import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import { ctaStyles } from '@/components/screen/ctaStyles';
import { reelSurfaceGradientCoarse } from '@/constants/reelSurfaceGradients';
import { palette, radius, screenContentGutter, semantic, themeSurface, typography } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { GATEWAY_ORIGIN, apiGetJson } from '@/lib/api';
import type { DecisionCategory, ExploreCard } from '@shouldi/contracts';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

const FILTERS = ['All', 'Career', 'Money', 'Relationship', 'Life'] as const;
const REPLAY_SEGMENTS = ['mine', 'community'] as const;

type ReplaySegment = (typeof REPLAY_SEGMENTS)[number];

function formatCompact(n: number): string {
  try {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return n.toLocaleString();
  }
}

function shorten(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function winningOptionId(card: ExploreCard): string {
  if (card.rewardEligibleOptionId) return card.rewardEligibleOptionId;
  const distributionMap = Object.fromEntries(card.distribution.map((row) => [row.optionId, row.votes]));
  return card.options.reduce((best, option) =>
    (distributionMap[option.id] ?? 0) > (distributionMap[best.id] ?? 0) ? option : best,
  ).id;
}

function buildReplayPresentation(card: ExploreCard) {
  const distributionMap = Object.fromEntries(card.distribution.map((row) => [row.optionId, row.votes]));
  const totalVotes = card.options.reduce((sum, option) => sum + (distributionMap[option.id] ?? 0), 0);
  const winnerId = winningOptionId(card);
  const winningLabel = card.options.find((option) => option.id === winnerId)?.label ?? null;
  const userPickLabel = card.myVoteOptionId
    ? card.options.find((option) => option.id === card.myVoteOptionId)?.label ?? null
    : null;
  const predictionMatch = card.myVoteOptionId
    ? card.myVoteOptionId === winnerId
      ? ('match' as const)
      : ('miss' as const)
    : ('unknown' as const);

  const outcomeHeadline = card.outcome?.trim()
    ? shorten(card.outcome.trim(), 140)
    : winningLabel ?? shorten(card.question, 140);

  const lessonText = card.takeaway?.trim()
    ? shorten(card.takeaway.trim(), 160)
    : 'Compare what the crowd expected with what actually happened.';

  return {
    totalVotes,
    outcomeHeadline,
    questionContext: shorten(card.question, 100),
    lessonText,
    userPickLabel,
    winningLabel: winningLabel ? shorten(winningLabel, 48) : null,
    predictionMatch,
  };
}

function ReplaySegmentControl({
  active,
  onChange,
  surface,
}: {
  active: ReplaySegment;
  onChange: (segment: ReplaySegment) => void;
  surface: ReturnType<typeof themeSurface>;
}) {
  return (
    <View style={styles.segmentRow}>
      {REPLAY_SEGMENTS.map((segment) => {
        const selected = segment === active;
        const label = segment === 'mine' ? 'Mine' : 'Community';
        return (
          <Pressable
            key={segment}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show ${label} replays`}
            onPress={() => onChange(segment)}
            style={[
              styles.segmentChip,
              { borderColor: surface.hairline, backgroundColor: surface.groupedSurface },
              selected && { backgroundColor: semantic.actionPrimary, borderColor: semantic.actionPrimary },
            ]}>
            <Text
              style={[
                styles.segmentChipLabel,
                { color: selected ? palette.sheet : surface.textMuted },
                selected && styles.segmentChipLabelActive,
              ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function PlotDeckScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const scrollRef = React.useRef<ScrollView>(null);
  const [activeSegment, setActiveSegment] = React.useState<ReplaySegment>('community');
  const [activeFilter, setActiveFilter] = React.useState<(typeof FILTERS)[number]>('All');
  const [activeDetailCardId, setActiveDetailCardId] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ['explore'],
    queryFn: async () => {
      const json = await apiGetJson('/v1/explore');
      return ExploreFeedResponseSchema.parse(json);
    },
  });

  const cards = query.data?.cards ?? [];
  const resolvedCards = React.useMemo(
    () => cards.filter((c) => decisionFeedStatus(c) === 'resolved'),
    [cards],
  );
  const visibleCards = React.useMemo(() => {
    if (activeFilter === 'All') return resolvedCards;
    return resolvedCards.filter((card) => card.category.toLowerCase() === activeFilter.toLowerCase());
  }, [activeFilter, resolvedCards]);

  const cardsById = React.useMemo(() => {
    const m = new Map<string, ExploreCard>();
    for (const card of resolvedCards) m.set(card.id, card);
    return m;
  }, [resolvedCards]);

  const activeDetailCard = React.useMemo(() => {
    if (!activeDetailCardId) return null;
    return cardsById.get(activeDetailCardId) ?? null;
  }, [activeDetailCardId, cardsById]);

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

  useFocusEffect(
    React.useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  if (query.isLoading && !query.data) {
    return <AppLaunchScreen detail="Loading Outcome Replay…" />;
  }

  if (query.error) {
    return (
      <View style={[styles.errorWrap, { backgroundColor: surface.canvas }]}>
        <Text style={[styles.errorTitle, { color: surface.textDisplay }]}>Couldn&apos;t load Replay</Text>
        <Text style={[styles.errorBody, { color: surface.textMuted }]}>
          {`Trying ${GATEWAY_ORIGIN}\nRun npm run api locally`}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry loading Replay" onPress={() => query.refetch()} style={ctaStyles.primary}>
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
          title="Replay"
          subtitle="Compare what you expected with what happened."
          textDisplay={surface.textDisplay}
          textMuted={surface.textMuted}
          groupedSurface={surface.groupedSurface}
          hairline={surface.hairline}
          textPrimary={surface.textPrimary}
        />

        <View style={styles.segmentWrap}>
          <ReplaySegmentControl active={activeSegment} onChange={setActiveSegment} surface={surface} />
        </View>

        {activeSegment === 'mine' ? (
          <View style={styles.listWrap}>
            <View style={[styles.empty, { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder }]}>
              <Text style={[styles.sectionEyebrow, { color: surface.textMuted }]}>Your calibration loop</Text>
              <Text style={[styles.emptyTitle, { color: surface.textDisplay }]}>No personal replays yet</Text>
              <Text style={[styles.emptyBody, { color: surface.textMuted }]}>
                Finish a decision in Decide, then return here to log the outcome and calibrate your judgment.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go to Decide"
                onPress={() => router.replace('/(tabs)/decide')}
                style={ctaStyles.primary}>
                <Text style={ctaStyles.primaryLabel}>Go to Decide</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Browse community lessons"
                onPress={() => setActiveSegment('community')}
                style={({ pressed }) => [styles.inlineGhostBtn, pressed && { opacity: 0.7 }]}>
                <Text style={[styles.inlineGhostBtnText, { color: semantic.actionPrimary }]}>Browse community lessons</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.filterRow}>
              <Text style={[styles.sectionEyebrow, { color: surface.textMuted, marginBottom: 8 }]}>
                Community lessons
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                {FILTERS.map((filter) => {
                  const active = filter === activeFilter;
                  return (
                    <Pressable
                      key={filter}
                      onPress={() => setActiveFilter(filter)}
                      style={[ctaStyles.segmentChip, active ? { backgroundColor: semantic.actionPrimary } : null]}>
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
              {visibleCards.map((card) => {
                const replay = buildReplayPresentation(card);
                return (
                  <ExploreDecisionCard
                    key={card.id}
                    mode="replay"
                    category={card.category}
                    outcomeHeadline={replay.outcomeHeadline}
                    questionContext={replay.questionContext}
                    lessonText={replay.lessonText}
                    userPickLabel={replay.userPickLabel}
                    winningLabel={replay.winningLabel}
                    predictionMatch={replay.predictionMatch}
                    totalVotes={replay.totalVotes}
                    formatVoteCount={formatCompact}
                    onPressCard={() => openDetailCard(card)}
                    onApplySimilar={() => router.push('/(tabs)/decide')}
                    onOpenDetails={() => openDetailCard(card)}
                  />
                );
              })}

              {visibleCards.length === 0 ? (
                <View style={[styles.empty, { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder }]}>
                  <Text style={[styles.emptyTitle, { color: surface.textDisplay }]}>
                    {resolvedCards.length === 0 ? 'No community lessons yet' : 'Nothing in this filter'}
                  </Text>
                  <Text style={[styles.emptyBody, { color: surface.textMuted }]}>
                    {resolvedCards.length === 0
                      ? 'Resolved decisions will appear here once outcomes are published.'
                      : 'Try another category or check Explore for open decisions.'}
                  </Text>
                  <Pressable onPress={() => router.replace('/(tabs)/explore')} style={ctaStyles.primary}>
                    <Text style={ctaStyles.primaryLabel}>Explore live decisions</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

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
                  pickedOptionOverride={activeDetailCard.myVoteOptionId ?? null}
                  onRequestClose={closeDetailCard}
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
  segmentWrap: {
    paddingHorizontal: screenContentGutter,
    marginBottom: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentChip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  segmentChipLabel: {
    ...typography.compact,
    fontWeight: '600',
  },
  segmentChipLabelActive: {
    fontWeight: '700',
  },
  sectionEyebrow: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
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
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.compact,
    lineHeight: 21,
    textAlign: 'center',
  },
  inlineGhostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inlineGhostBtnText: {
    ...typography.compact,
    fontWeight: '700',
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
  detailOverlayShell: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  detailScroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
