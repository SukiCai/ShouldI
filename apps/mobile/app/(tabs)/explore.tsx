import { router } from 'expo-router';
import { ActivityIndicator, Animated, FlatList, LayoutAnimation, Platform, Pressable, RefreshControl, StyleSheet, Switch, Text, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/ui/PrimaryButton';
import { GlassCard, GradientHero, PillTag } from '@/components/ui/Premium';
import ProvenanceChip from '@/components/ui/ProvenanceChip';
import { palette, spacing, typography } from '@/constants/theme';
import { apiGetJson, GATEWAY_ORIGIN } from '@/lib/api';
import type { DecisionCategory } from '@shouldi/contracts';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

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

function safeAuthor(card: unknown): { name: string; avatarEmoji: string } {
  const raw = (card as { author?: { name?: string; avatarEmoji?: string } })?.author;
  return {
    name: raw?.name ?? 'Anonymous',
    avatarEmoji: raw?.avatarEmoji ?? '🙂',
  };
}

function safeStatus(card: unknown): 'open' | 'resolved' {
  const value = (card as { status?: string })?.status;
  return value === 'resolved' ? 'resolved' : 'open';
}

function safeRewardPoints(card: unknown): number {
  const raw = (card as { rewardPoints?: number })?.rewardPoints;
  return Number.isFinite(raw) && (raw ?? 0) > 0 ? (raw as number) : 10;
}

function InlineDistributionTrack({ visible, percentage }: { visible: boolean; percentage: number }) {
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [progress, visible, percentage]);

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
  const [selectedByCard, setSelectedByCard] = React.useState<Record<string, string>>({});
  const [openOnly, setOpenOnly] = React.useState(false);

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

  const cards = query.data?.cards ?? [];
  const visibleCards = openOnly ? cards.filter((c) => safeStatus(c) === 'open') : cards;

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityHint="Fetching community experiences" />
        <Text style={[typography.caption, styles.muted]}>Loading…</Text>
      </View>
    );
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
      <View style={[styles.headerWrap, { paddingTop: Math.max(16, insets.top + 10) }]}>
        <GradientHero
          eyebrow="Professional feed"
          title="Explore outcomes"
          subtitle="Swipe real decision arcs and instantly reuse the framing for your own case."
          right={<PillTag label={`${visibleCards.length} cases`} tone="brand" />}
        />
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
      <FlatList
        data={visibleCards}
        accessibilityRole="list"
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <GlassCard style={styles.cardOuter}>
              {(() => {
                const author = safeAuthor(item);
                const status = safeStatus(item);
                return (
                  <View style={styles.metaRow}>
                    <Text style={[typography.compact, styles.author]}>
                      {author.avatarEmoji} {author.name}
                    </Text>
                    <PillTag label={status === 'open' ? 'Open' : 'Resolved'} tone={status === 'open' ? 'brand' : 'good'} />
                  </View>
                );
              })()}
              <ProvenanceChip provenance={item.provenance} />
              <Text accessibilityRole="header" style={[styles.category, typography.caption]}>
                {categoryLabel(item.category)}
              </Text>
              <Text accessibilityRole="header" style={[typography.hero, styles.hook]}>{item.hook}</Text>
              <Text style={[typography.body, styles.tension]}>{shorten(item.tension, 120)}</Text>
              <Text style={[typography.compact, styles.labelCaps]}>Community decision</Text>
              <Text style={[typography.h2, styles.question]}>{item.question}</Text>
              {(() => {
                const status = safeStatus(item);
                const isResolved = status === 'resolved';
                const effectivePicked = selectedByCard[item.id] ?? item.myVoteOptionId;
                const hasPicked = isResolved || !!effectivePicked;
                const total = totalVotesFromCard(item);
                return (
                  <>
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
                            style={[styles.optionPill, selected && styles.optionPillActive, isResolved && styles.optionPillDisabled]}
                          >
                            <View style={styles.optionTopRow}>
                              <Text style={[styles.optionText, selected && styles.optionTextActive]}>{option.label}</Text>
                              {hasPicked ? (
                                <Text style={[styles.optionMeta, selected && styles.optionMetaPicked]}>
                                  {percentage}%{selected ? (isResolved ? ' · Final pick' : ' · Your pick') : ''}
                                </Text>
                              ) : selected ? (
                                <Text style={styles.optionMeta}>Selected</Text>
                              ) : null}
                            </View>
                            <InlineDistributionTrack visible={hasPicked} percentage={percentage} />
                          </Pressable>
                        );
                      })}
                    </View>
                    {hasPicked ? (
                      <Text style={[typography.caption, styles.votesMeta]}>{total} community votes</Text>
                    ) : (
                      <Text style={[typography.caption, styles.votesMeta]}>
                        Vote to unlock distribution · reward pool {safeRewardPoints(item)} pts
                      </Text>
                    )}
                  </>
                );
              })()}
              <View style={styles.divider} />
              {safeStatus(item) === 'resolved' ? (
                <>
                  <Text style={[typography.compact, styles.labelCaps]}>Outcome</Text>
                  <Text style={[typography.body]}>{shorten(item.outcome ?? '', 150)}</Text>
                  <Text style={[typography.compact, styles.labelCaps]}>Lesson</Text>
                  <Text style={[typography.body]}>{shorten(item.takeaway ?? '', 120)}</Text>
                </>
              ) : (
                <View style={styles.pendingBlock}>
                  <Text style={[typography.compact, styles.labelCaps]}>Outcome pending</Text>
                  <Text style={typography.body}>Author has not posted final outcome yet.</Text>
                  <Text style={[typography.caption, styles.pendingHint]}>
                    Follow to get notified when outcome drops and see if your vote was right.
                  </Text>
                </View>
              )}
              {item.matchHint ? (
                <View style={styles.badge}>
                  <Text style={[typography.caption, styles.matchHint]}>Why swipe next: {item.matchHint}</Text>
                </View>
              ) : null}
              <View style={{ height: spacing.lg }} />
              <PrimaryButton
                accessibilityLabel="Open decision details and discussion"
                onPress={() =>
                  router.push(`/decision/${item.id}`)
                }>
                <Text style={styles.buttonLabel}>Open discussion details</Text>
              </PrimaryButton>
              <Text style={[typography.caption, styles.swipeCue]}>{`Scroll for next`}</Text>
            </GlassCard>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: palette.mist,
  },
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  listContent: {
    paddingBottom: 110,
  },
  filterRow: {
    marginTop: 10,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#eef3ff',
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
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 22,
    gap: 8,
  },
  cardWrap: {
    paddingBottom: 14,
  },
  category: {
    color: palette.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  author: {
    color: palette.slate500,
    flex: 1,
  },
  hook: {
    color: palette.slate950,
  },
  question: {
    color: palette.slate900,
    marginBottom: 4,
  },
  tension: {
    color: palette.slate800,
  },
  optionWrap: {
    gap: 8,
    marginBottom: 2,
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
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    backgroundColor: '#dbe3f7',
  },
  labelCaps: {
    color: palette.slate500,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  matchHint: {
    color: palette.mint,
    fontWeight: '600',
  },
  badge: {
    marginTop: 2,
    alignSelf: 'flex-start',
    backgroundColor: '#ecf8f3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBlock: {
    gap: 4,
  },
  pendingHint: {
    color: palette.warning,
  },
  swipeCue: {
    textAlign: 'center',
    color: palette.slate500,
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
