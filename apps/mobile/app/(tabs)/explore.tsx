import { router } from 'expo-router';
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
  Switch,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { ExploreMomentHeader } from '@/components/ui/ExploreMomentHeader';
import { GlassCard, PillTag } from '@/components/ui/Premium';
import ProvenanceChip from '@/components/ui/ProvenanceChip';
import { palette, typography } from '@/constants/theme';
import { apiGetJson, GATEWAY_ORIGIN } from '@/lib/api';
import type { DecisionCategory } from '@shouldi/contracts';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as React from 'react';

const SWIPE_CUES = [
  'Flick up — next dilemma locked in 🔒',
  'One more swipe, fresh takes incoming ✨',
  'Keep cruising — surprises live above ↑',
  'Plot twist boarding on the next card 🎬',
  'Scroll up for your next dopamine vote 📈',
];

function swipeCueForIndex(index: number): string {
  return SWIPE_CUES[index % SWIPE_CUES.length];
}

function BouncySwipeCue({ index }: { index: number }) {
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

  return (
    <View style={styles.swipeCueCluster} accessibilityRole="text">
      <Animated.Text style={[styles.swipeArrow, { opacity: arrowOpacity, transform: [{ translateY: arrowY }] }]} accessibilityLabel="">
        ↑
      </Animated.Text>
      <Text style={[typography.compact, styles.scrollCue]}>{swipeCueForIndex(index)}</Text>
    </View>
  );
}

const categoryLabel = (category: DecisionCategory): string =>
  ({
    life: 'Life',
    career: 'Career',
    relationship: 'Relationship',
    money: 'Money',
  })[category];

const shorten = (text: string, max = 150): string => {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
};

function totalVotesFromCard(card: {
  distribution: Array<{ optionId: string; votes: number }>;
}): number {
  return card.distribution.reduce((sum, d) => sum + d.votes, 0);
}

function safeStatus(card: unknown): 'open' | 'resolved' {
  const value = (card as { status?: string })?.status;
  return value === 'resolved' ? 'resolved' : 'open';
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

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [selectedByCard, setSelectedByCard] = React.useState<Record<string, string>>({});
  const [openOnly, setOpenOnly] = React.useState(false);
  const [feedViewportH, setFeedViewportH] = React.useState(0);

  /** One “reel” = measured feed area height; fallback before first layout. */
  const pageHeight = React.useMemo(() => {
    const headerEstimate = 112;
    const tabBarClearance = 100;
    const fallback = Math.max(
      360,
      windowHeight - Math.max(insets.top, 12) - headerEstimate - Math.max(insets.bottom, 8) - tabBarClearance,
    );
    const raw = feedViewportH > 0 ? feedViewportH : fallback;
    return Math.max(320, Math.round(raw));
  }, [feedViewportH, insets.bottom, insets.top, windowHeight]);

  React.useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const query = useQuery({
    queryKey: ['explore'],
    queryFn: async () => {
      const json = await apiGetJson('/v1/explore');
      return ExploreFeedResponseSchema.parse(json);
    },
  });

  const viewabilityConfig = React.useMemo(
    () => ({ itemVisiblePercentThreshold: 45, minimumViewTime: 110 }),
    [],
  );
  const hapticPrimedRef = React.useRef(false);
  const lastFocusedIndexRef = React.useRef(-1);

  // VirtualizedList requires a stable identity (never flipping undefined ↔ function across updates).
  // useRef initializes once per mount — same handler reference even when switching loading/error/content.
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

  const cards = query.data?.cards ?? [];
  const visibleCards = openOnly ? cards.filter((c) => safeStatus(c) === 'open') : cards;

  if (query.isLoading) {
    return <AppLaunchScreen detail="Fetching community reels…" />;
  }

  if (query.error) {
    return (
      <View style={[styles.center, styles.errorPad]}>
        <Text style={typography.title}>Couldn’t connect to ShouldI API</Text>
        <Text style={[typography.body, styles.centerText, styles.muted]}>
          Trying <Text style={styles.mono}>{GATEWAY_ORIGIN}</Text>
        </Text>
        <Text style={[typography.caption, styles.centerText, styles.muted]}>
          Start API: npm run api or docker compose up
        </Text>
        <PrimaryButton accessibilityLabel="Retry loading explore cards" onPress={() => query.refetch()}>
          <Text style={styles.buttonLabel}>Retry</Text>
        </PrimaryButton>
      </View>
    );
  }

  return (
    <View style={styles.surface}>
      <View style={[styles.headerWrap, { paddingTop: Math.max(10, insets.top + 6) }]}>
        <View style={styles.topBand}>
          <View style={styles.topBandGrow}>
            <ExploreMomentHeader caseCount={visibleCards.length} variant="minimal" />
          </View>
          <View style={styles.filterRow}>
            <Text style={styles.filterText}>Open only</Text>
            <Switch
              accessibilityLabel="Show open decisions only"
              value={openOnly}
              onValueChange={setOpenOnly}
              trackColor={{ false: '#d8e0f6', true: '#b9ccff' }}
              thumbColor={openOnly ? palette.accent : '#ffffff'}
            />
          </View>
        </View>
      </View>
      <View
        style={styles.feedFrame}
        onLayout={(e) => setFeedViewportH(e.nativeEvent.layout.height)}>
        <FlatList
          style={styles.pagedList}
          data={visibleCards}
          accessibilityRole="list"
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.pagedListContent}
          refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />}
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
          const status = safeStatus(item);
          const isOpen = status === 'open';

          return (
          <View style={[styles.pageSheet, { height: pageHeight }]}>
            <ScrollView
              style={styles.pageScroll}
              contentContainerStyle={[
                styles.pageScrollContent,
                { paddingBottom: Math.max(insets.bottom, 12) + 88 },
              ]}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces
              {...(Platform.OS === 'ios' ? { directionalLockEnabled: true } : {})}>
            <GlassCard style={[styles.cardOuter, styles.cardSpotlight]}>
              <View style={styles.topicRow}>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>{categoryLabel(item.category)}</Text>
                </View>
                <View style={styles.provenanceShrink}>
                  <ProvenanceChip provenance={item.provenance} />
                </View>
                <PillTag
                  label={status === 'open' ? 'Open' : 'Resolved'}
                  tone={status === 'open' ? 'brand' : 'good'}
                  style={styles.topicStatusTag}
                />
              </View>
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
                {isOpen ? null : (
                  <Text style={[typography.caption, styles.pollEyebrow]}>Community poll</Text>
                )}
                <Text
                  accessibilityRole="header"
                  style={[isOpen ? typography.title : typography.h2, styles.pollQuestion, isOpen && styles.pollQuestionOpen]}>
                  {item.question}
                </Text>
                {(() => {
                  const isResolved = status === 'resolved';
                  const effectivePicked = selectedByCard[item.id] ?? item.myVoteOptionId;
                  const hasPicked = isResolved || !!effectivePicked;
                  const total = totalVotesFromCard(item);
                  return (
                    <>
                      {!hasPicked && !isResolved ? (
                        <Text style={[typography.caption, styles.pollHint]}>
                          {status === 'open' ? (
                            <>
                              Choose one to see how the community splits —{' '}
                              <Text style={styles.pollHintStrong}>{safeRewardPoints(item)} pts</Text> up for grabs when this
                              closes.
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
                          return (
                            <Pressable
                              key={option.id}
                              accessibilityRole="button"
                              accessibilityLabel={isResolved ? `${option.label}, voting closed` : `Pick ${option.label}`}
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
                                isResolved && styles.optionPillDisabled,
                                !isResolved && pressed && styles.optionPillPressed,
                              ]}>
                              <View style={styles.optionTopRow}>
                                <Text style={[styles.optionText, selected && styles.optionTextActive]}>{option.label}</Text>
                                {hasPicked ? (
                                  <Text style={[styles.optionMeta, selected && styles.optionMetaPicked]}>
                                    {percentage}%
                                    {selected ? (isResolved ? ' · Final' : ' · You') : ''}
                                  </Text>
                                ) : selected ? (
                                  <Text style={styles.optionMeta}>Selected</Text>
                                ) : null}
                              </View>
                              {hasPicked ? <InlineDistributionTrack percentage={percentage} /> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={styles.pollFooter}>
                        <Text style={[typography.caption, styles.votesMetaStrong]}>
                          {total.toLocaleString()} votes
                        </Text>
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
                <Text style={[typography.caption, styles.pendingInline]}>
                  Outcome still open — follow the thread for updates.
                </Text>
              )}
              <View style={styles.cardActions}>
                <PrimaryButton
                  accessibilityLabel="Open discussion and full thread"
                  onPress={() => router.push(`/decision/${item.id}`)}>
                  <Text style={styles.buttonLabel}>Open full thread</Text>
                </PrimaryButton>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Decide for your own dilemma"
                  accessibilityHint="Opens the Decide tab to work through your own choice"
                  onPress={() => router.push('/(tabs)/decide')}
                  style={({ pressed }) => [styles.decideCue, pressed && styles.decideCuePressed]}>
                  <Text style={styles.decideCueText}>Your turn — run this through Decide</Text>
                  <Text style={styles.decideCueArrow}>→</Text>
                </Pressable>
                <BouncySwipeCue index={index} />
              </View>
            </GlassCard>
            </ScrollView>
          </View>
          );
        }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: palette.mist,
  },
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
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  topBand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 44,
  },
  topBandGrow: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  filterRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#eef3ff',
    flexShrink: 0,
  },
  filterText: {
    ...typography.caption,
    color: palette.slate900,
    fontWeight: '600',
  },
  headerSub: {
    color: palette.slate500,
    marginTop: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: palette.mist,
  },
  errorPad: {
    paddingHorizontal: 24,
  },
  centerText: {
    textAlign: 'center',
  },
  mono: {
    ...typography.caption,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  cardOuter: {
    marginHorizontal: 12,
    borderRadius: 26,
    padding: 22,
    gap: 14,
  },
  cardSpotlight: {
    backgroundColor: palette.white,
    borderColor: '#c8dafb',
    borderWidth: 1,
    shadowColor: palette.accent,
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  categoryPill: {
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cdd9ff',
    justifyContent: 'center',
  },
  categoryPillText: {
    ...typography.caption,
    color: palette.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  provenanceShrink: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  topicStatusTag: {
    alignSelf: 'center',
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
    backgroundColor: '#f4f7ff',
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
    backgroundColor: palette.white,
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
  decideCue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cdd9ff',
    backgroundColor: palette.accentSoft,
  },
  decideCuePressed: {
    opacity: 0.92,
  },
  decideCueText: {
    ...typography.compact,
    color: palette.accent,
    fontWeight: '700',
  },
  decideCueArrow: {
    ...typography.compact,
    color: palette.accent,
    fontWeight: '700',
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
  muted: {
    color: palette.slate500,
  },
  buttonLabel: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 16,
  },
});
