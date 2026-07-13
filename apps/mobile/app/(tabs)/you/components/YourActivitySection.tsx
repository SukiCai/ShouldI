import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { exploreCategoryTheme } from '@/components/explore/exploreCategoryTheme';
import { semantic } from '@/constants/theme';
import {
  formatCommunityPostWhen,
  requestHighlightCard,
  totalVotesForCard,
  usePostedCommunityCards,
} from '@/lib/exploreCommunityPosts';
import {
  formatActivityWhen,
  useParticipatedCards,
  useWatchingEntries,
  type WatchingEntry,
} from '@/lib/exploreUserActivity';
import type { ExploreCard } from '@shouldi/contracts';

import { youScreenStyles as styles } from './youScreenStyles';

const ACTIVITY_FILTERS = ['Posted', 'Participated', 'Watching'] as const;
type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

type YourActivitySectionProps = {
  textDisplay: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  hairline: string;
};

function openExploreCard(cardId: string) {
  requestHighlightCard(cardId);
  router.replace({
    pathname: '/(tabs)/explore',
    params: { highlightCardId: cardId },
  });
}

function defaultFilter(counts: Record<ActivityFilter, number>): ActivityFilter {
  if (counts.Posted > 0) return 'Posted';
  if (counts.Participated > 0) return 'Participated';
  if (counts.Watching > 0) return 'Watching';
  return 'Posted';
}

function optionLabel(card: ExploreCard, optionId?: string): string | null {
  if (!optionId) return null;
  return card.options.find((option) => option.id === optionId)?.label ?? null;
}

function ActivityRow({
  card,
  footnote,
  textDisplay,
  textMuted,
  hairline,
  isLast,
  onPress,
}: {
  card: ExploreCard;
  footnote: string;
  textDisplay: string;
  textMuted: string;
  hairline: string;
  isLast: boolean;
  onPress(): void;
}) {
  const theme = exploreCategoryTheme(card.category);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open decision: ${card.question}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.postRow,
        !isLast && { borderBottomColor: hairline, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && styles.postRowPressed,
      ]}>
      <View style={styles.postTop}>
        <View style={[styles.categoryPill, { backgroundColor: theme.soft }]}>
          <Ionicons name={theme.icon} size={12} color={theme.accent} />
          <Text style={[styles.categoryText, { color: theme.accent }]}>{theme.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={textMuted} />
      </View>
      <Text style={[styles.postQuestion, { color: textDisplay }]} numberOfLines={2}>
        {card.question}
      </Text>
      <Text style={[styles.postFoot, { color: textMuted }]}>{footnote}</Text>
    </Pressable>
  );
}

function emptyLine(filter: ActivityFilter): string {
  switch (filter) {
    case 'Posted':
      return 'Nothing posted yet.';
    case 'Participated':
      return 'No votes yet — pick a side on Explore.';
    case 'Watching':
      return 'Nothing saved or followed yet.';
  }
}

function postedFootnote(card: ExploreCard): string {
  const votes = totalVotesForCard(card);
  const agree = card.aiValidation?.agreeWithAiVotes ?? 0;
  const voteLabel = votes === 0 ? 'No votes yet' : `${votes} vote${votes === 1 ? '' : 's'}`;
  const agreeLabel = agree > 0 ? ` · ${agree} agreed with your lean` : '';
  return `${voteLabel}${agreeLabel} · ${formatCommunityPostWhen(card.id)}`;
}

function participatedFootnote(card: ExploreCard): string {
  const pick = optionLabel(card, card.myVoteOptionId);
  return pick ? `You picked ${pick}` : 'You voted on this thread';
}

function watchingFootnote(entry: WatchingEntry): string {
  const tags = [entry.saved ? 'Saved' : null, entry.followed ? 'Following' : null].filter(Boolean);
  return `${tags.join(' · ')} · ${formatActivityWhen(entry.updatedAt)}`;
}

export function YourActivitySection({
  textDisplay,
  textMuted,
  groupedSurface,
  groupedBorder,
  hairline,
}: YourActivitySectionProps) {
  const postedCards = usePostedCommunityCards();
  const participatedCards = useParticipatedCards();
  const watchingEntries = useWatchingEntries();

  const counts = React.useMemo<Record<ActivityFilter, number>>(
    () => ({
      Posted: postedCards.length,
      Participated: participatedCards.length,
      Watching: watchingEntries.length,
    }),
    [postedCards.length, participatedCards.length, watchingEntries.length],
  );

  const [activeFilter, setActiveFilter] = React.useState<ActivityFilter>(() => defaultFilter(counts));

  React.useEffect(() => {
    setActiveFilter((current) => {
      if (counts[current] > 0) return current;
      return defaultFilter(counts);
    });
  }, [counts]);

  const rows =
    activeFilter === 'Posted'
      ? postedCards
      : activeFilter === 'Participated'
        ? participatedCards
        : watchingEntries.map((entry) => entry.card);

  return (
    <View style={styles.sectionWrap}>
      <Text style={[styles.threadsTitle, { color: textDisplay }]}>Your threads</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.activityFilterContent}>
        {ACTIVITY_FILTERS.map((filter) => {
          const active = filter === activeFilter;
          return (
            <Pressable
              key={filter}
              accessibilityRole="button"
              accessibilityLabel={`Show ${filter} threads`}
              accessibilityState={{ selected: active }}
              onPress={() => setActiveFilter(filter)}
              style={[
                styles.activityFilterChip,
                active && { backgroundColor: semantic.actionPrimary },
              ]}>
              <Text
                style={[
                  styles.activityFilterLabel,
                  { color: textMuted },
                  active && styles.activityFilterLabelActive,
                ]}>
                {filter}
                {counts[filter] > 0 ? ` ${counts[filter]}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {rows.length === 0 ? (
        <Text style={[styles.cardBody, { color: textMuted, paddingTop: 4 }]}>{emptyLine(activeFilter)}</Text>
      ) : (
        <View
          style={[
            styles.feedCard,
            {
              backgroundColor: groupedSurface,
              borderColor: groupedBorder,
            },
          ]}>
          <View style={styles.postList}>
            {activeFilter === 'Watching'
              ? watchingEntries.map((entry, index) => (
                  <ActivityRow
                    key={entry.card.id}
                    card={entry.card}
                    footnote={watchingFootnote(entry)}
                    textDisplay={textDisplay}
                    textMuted={textMuted}
                    hairline={hairline}
                    isLast={index === watchingEntries.length - 1}
                    onPress={() => openExploreCard(entry.card.id)}
                  />
                ))
              : (rows as ExploreCard[]).map((card, index) => (
                  <ActivityRow
                    key={card.id}
                    card={card}
                    footnote={
                      activeFilter === 'Posted' ? postedFootnote(card) : participatedFootnote(card)
                    }
                    textDisplay={textDisplay}
                    textMuted={textMuted}
                    hairline={hairline}
                    isLast={index === rows.length - 1}
                    onPress={() => openExploreCard(card.id)}
                  />
                ))}
          </View>
        </View>
      )}
    </View>
  );
}
