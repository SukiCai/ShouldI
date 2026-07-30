import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { exploreCategoryTheme } from '@/components/explore/exploreCategoryTheme';
import { DraftOptionReorderList } from '@/components/explore/DraftOptionReorderList';
import { exploreDecisionCardStyles as styles } from '@/components/explore/exploreDecisionCardStyles';
import {
  optionTeamBarFill,
  optionTeamBorder,
  optionTeamColor,
  optionTeamSoftBg,
} from '@/lib/optionTeamChrome';
import { semantic, palette, themeSurface } from '@/constants/theme';

export type ExploreCardOption = {
  id: string;
  label: string;
};

type CardChromeProps = {
  category: string;
  style?: StyleProp<ViewStyle>;
};

type LiveProps = CardChromeProps & {
  mode: 'live';
  highlighted?: boolean;
  question: string;
  options: ExploreCardOption[];
  votePctByOptionId: Record<string, number>;
  effectivePicked?: string | null;
  aiSuggestedOptionId?: string;
  totalVotes: number;
  livePulse: Animated.Value;
  formatVoteCount?(n: number): string;
  onPressQuestion?(): void;
  onVote(optionId: string): void;
  onOpenDetails?(): void;
};

type ReplayProps = CardChromeProps & {
  mode: 'replay';
  /** What actually happened — card hero */
  outcomeHeadline: string;
  /** Original dilemma — supporting context */
  questionContext: string;
  /** Reusable lesson / takeaway */
  lessonText: string;
  userPickLabel?: string | null;
  winningLabel?: string | null;
  predictionMatch?: 'match' | 'miss' | 'unknown';
  totalVotes: number;
  formatVoteCount?(n: number): string;
  onPressCard?(): void;
  onApplySimilar?(): void;
  onOpenDetails?(): void;
};

type DraftProps = CardChromeProps & {
  mode: 'draft';
  question: string;
  options: ExploreCardOption[];
  aiSuggestedOptionId: string;
  maxOptions?: number;
  onChangeQuestion(text: string): void;
  onChangeOptionLabel(optionId: string, label: string): void;
  onSelectAiLean(optionId: string): void;
  onAddOption?(): void;
  onRemoveOption?(optionId: string): void;
  onReorderOptions?(options: ExploreCardOption[]): void;
};

export type ExploreDecisionCardProps = LiveProps | ReplayProps | DraftProps;

function formatCompact(n: number): string {
  try {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return n.toLocaleString();
  }
}

export function ExploreDecisionCard(props: ExploreDecisionCardProps) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const theme = exploreCategoryTheme(props.category);

  const cardStyle = [
    styles.card,
    { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder },
    props.mode === 'live' && props.highlighted
      ? {
          borderWidth: 2,
          borderColor: semantic.actionPrimary,
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 3,
        }
      : null,
    props.style,
  ];

  if (props.mode === 'replay') {
    const {
      outcomeHeadline,
      questionContext,
      lessonText,
      userPickLabel,
      winningLabel,
      predictionMatch = 'unknown',
      totalVotes,
      formatVoteCount = formatCompact,
      onPressCard,
      onApplySimilar,
      onOpenDetails,
    } = props;

    const matchLabel =
      predictionMatch === 'match' ? 'Aligned' : predictionMatch === 'miss' ? 'Missed' : '—';
    const matchColor =
      predictionMatch === 'match'
        ? semantic.actionAffirm
        : predictionMatch === 'miss'
          ? semantic.actionCaution
          : surface.textMuted;

    return (
      <View style={cardStyle}>
        <Pressable
          onPress={onPressCard}
          disabled={!onPressCard}
          style={({ pressed }) => [styles.cardHeaderTapArea, pressed && styles.cardHeaderTapAreaPressed]}>
          <View style={styles.cardTop}>
            <View style={styles.cardCategoryRow}>
              <View style={[styles.categoryDotWrap, { backgroundColor: theme.soft }]}>
                <Ionicons name={theme.icon} size={14} color={theme.accent} />
              </View>
              <Text style={[styles.categoryLabel, { color: theme.accent }]}>{theme.label}</Text>
            </View>
            <View style={styles.cardMetaRight}>
              <View
                style={[
                  styles.votesMetaPreview,
                  { borderColor: `${semantic.actionAffirm}38`, backgroundColor: `${semantic.actionAffirm}12` },
                ]}>
                <Text style={[styles.votesMetaPreviewLabel, { color: semantic.actionAffirm }]}>Resolved</Text>
                <Text style={[styles.votesMetaCount, { color: surface.textMuted }]}>
                  {formatVoteCount(totalVotes)}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.replayOutcomeHeadline, { color: surface.textDisplay }]} numberOfLines={3}>
            {outcomeHeadline}
          </Text>
          <Text style={[styles.replayQuestionContext, { color: surface.textMuted }]} numberOfLines={2}>
            {questionContext}
          </Text>
        </Pressable>

        <View style={styles.calibrationRow}>
          <View style={[styles.calibrationCell, { borderColor: surface.hairline, backgroundColor: surface.canvas }]}>
            <Text style={[styles.calibrationEyebrow, { color: surface.textMuted }]}>You picked</Text>
            <Text style={[styles.calibrationValue, { color: surface.textPrimary }]} numberOfLines={2}>
              {userPickLabel ?? 'No vote'}
            </Text>
          </View>
          <View style={[styles.calibrationCell, { borderColor: surface.hairline, backgroundColor: surface.canvas }]}>
            <Text style={[styles.calibrationEyebrow, { color: surface.textMuted }]}>Outcome</Text>
            <Text style={[styles.calibrationValue, { color: surface.textPrimary }]} numberOfLines={2}>
              {winningLabel ?? 'See details'}
            </Text>
          </View>
          <View style={[styles.calibrationCell, { borderColor: surface.hairline, backgroundColor: surface.canvas }]}>
            <Text style={[styles.calibrationEyebrow, { color: surface.textMuted }]}>Match</Text>
            <Text style={[styles.calibrationValue, { color: matchColor }]}>{matchLabel}</Text>
          </View>
        </View>

        <View style={styles.lessonBlock}>
          <Text style={[styles.lessonEyebrow, { color: surface.textMuted }]}>Lesson</Text>
          <Text style={[styles.lessonBody, { color: surface.textPrimary }]} numberOfLines={3}>
            {lessonText}
          </Text>
        </View>

        <View style={styles.replayFooter}>
          {onApplySimilar ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start a similar decision in Decide"
              onPress={onApplySimilar}
              style={[styles.replayPrimaryBtn, { backgroundColor: semantic.actionPrimary }]}>
              <Text style={styles.replayPrimaryBtnText}>Start similar decision</Text>
            </Pressable>
          ) : null}
          {onOpenDetails ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open full outcome details"
              onPress={onOpenDetails}
              style={styles.replayGhostBtn}>
              <Text style={[styles.replayGhostBtnText, { color: semantic.actionPrimary }]}>Details</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (props.mode === 'live') {
    const {
      question,
      options,
      votePctByOptionId,
      effectivePicked,
      aiSuggestedOptionId,
      totalVotes,
      livePulse,
      formatVoteCount = formatCompact,
      onPressQuestion,
      onVote,
      onOpenDetails,
    } = props;
    const selectedLabel = options.find((o) => o.id === effectivePicked)?.label ?? null;

    return (
      <View style={cardStyle}>
        <Pressable
          onPress={onPressQuestion}
          disabled={!onPressQuestion}
          style={({ pressed }) => [styles.cardHeaderTapArea, pressed && styles.cardHeaderTapAreaPressed]}>
          <View style={styles.cardTop}>
            <View style={styles.cardCategoryRow}>
              <View style={[styles.categoryDotWrap, { backgroundColor: theme.soft }]}>
                <Ionicons name={theme.icon} size={14} color={theme.accent} />
              </View>
              <Text style={[styles.categoryLabel, { color: theme.accent }]}>{theme.label}</Text>
            </View>
            <View style={styles.cardMetaRight}>
              <View style={[styles.votesMetaLive, { borderColor: `${palette.livePulse}38`, backgroundColor: `${palette.livePulse}14` }]}>
                <Animated.View
                  style={[
                    styles.liveDot,
                    { backgroundColor: palette.livePulse },
                    {
                      opacity: livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                      transform: [
                        {
                          scale: livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }),
                        },
                      ],
                    },
                  ]}
                />
                <Text style={[styles.votesMetaLiveLabel, { color: palette.livePulse }]}>Live votes</Text>
                <Text style={[styles.votesMetaCount, { color: surface.textMuted }]}>{formatVoteCount(totalVotes)}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.question, { color: surface.textPrimary }]}>{question}</Text>
        </Pressable>

        <View style={styles.rows}>
          {options.slice(0, 3).map((option) => {
            const pct = votePctByOptionId[option.id] ?? 0;
            const selected = effectivePicked === option.id;
            const aiLean = aiSuggestedOptionId === option.id;
            const optionColor = optionTeamColor(options, option.id);
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`Vote for ${option.label}`}
                onPress={() => onVote(option.id)}
                style={[
                  styles.rowLine,
                  selected && {
                    backgroundColor: optionTeamSoftBg(optionColor, '14'),
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: optionTeamBorder(optionColor, '40'),
                  },
                ]}>
                <View style={styles.rowHead}>
                  <Text
                    style={[styles.rowLabel, { color: surface.textPrimary }]}
                    numberOfLines={2}
                    ellipsizeMode="tail">
                    {option.label}
                  </Text>
                  <Text style={[styles.rowPct, { color: selected ? optionColor : surface.textMuted, flexShrink: 0 }]}>
                    {pct}%
                    {selected ? ' · you' : ''}
                    {aiLean && effectivePicked ? ' · ai' : ''}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: surface.hairline }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.max(2, pct)}%`,
                        backgroundColor: optionTeamBarFill(optionColor, selected ? 'user' : aiLean ? 'ai' : 'neutral'),
                      },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.peopleText, { color: surface.textMuted }]} numberOfLines={1}>
            {selectedLabel ? 'Tap an option to change your vote' : 'Tap an option to vote quickly'}
          </Text>
          {onOpenDetails ? (
            <Pressable onPress={onOpenDetails} style={[styles.voteBtn, { backgroundColor: theme.soft }]}>
              <Text style={[styles.voteBtnText, { color: theme.accent }]}>Open details</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.accent} />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const {
    question,
    options,
    aiSuggestedOptionId,
    maxOptions = 4,
    onChangeQuestion,
    onChangeOptionLabel,
    onSelectAiLean,
    onAddOption,
    onRemoveOption,
    onReorderOptions,
  } = props;
  const ghostPct = options.length > 0 ? Math.round(100 / options.length) : 0;
  const canAddOption = !!onAddOption && options.length < maxOptions;
  const canRemoveOption = !!onRemoveOption && options.length > 2;

  return (
    <View style={cardStyle} accessibilityLabel="Explore card preview">
      <View style={styles.cardTop}>
        <View style={styles.cardCategoryRow}>
          <View style={[styles.categoryDotWrap, { backgroundColor: theme.soft }]}>
            <Ionicons name={theme.icon} size={14} color={theme.accent} />
          </View>
          <Text style={[styles.categoryLabel, { color: theme.accent }]}>{theme.label}</Text>
        </View>
        <View style={styles.cardMetaRight}>
          <View
            style={[
              styles.votesMetaPreview,
              { borderColor: surface.groupedBorder, backgroundColor: surface.canvas },
            ]}>
            <Text style={[styles.votesMetaPreviewLabel, { color: surface.textMuted }]}>Preview</Text>
          </View>
        </View>
      </View>

      <TextInput
        accessibilityLabel="Poll question"
        value={question}
        onChangeText={onChangeQuestion}
        placeholder="The question peers will vote on"
        placeholderTextColor={surface.textMuted}
        multiline
        style={[styles.questionInput, { color: surface.textPrimary }]}
      />

      {onReorderOptions ? (
        <DraftOptionReorderList
          options={options}
          aiSuggestedOptionId={aiSuggestedOptionId}
          ghostPct={ghostPct}
          canRemoveOption={canRemoveOption}
          surface={surface}
          onChangeOptionLabel={onChangeOptionLabel}
          onSelectAiLean={onSelectAiLean}
          onRemoveOption={(optionId) => onRemoveOption?.(optionId)}
          onReorderOptions={onReorderOptions}
        />
      ) : (
        <View style={styles.rows}>
          {options.map((option) => {
            const aiLean = option.id === aiSuggestedOptionId;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`Set ShouldI lean to ${option.label || 'option'}`}
                accessibilityState={{ selected: aiLean }}
                onPress={() => onSelectAiLean(option.id)}
                style={[styles.rowLine, aiLean && styles.rowLineAiLean]}>
                <View style={styles.rowHead}>
                  <Text style={[styles.rowLabel, { color: surface.textPrimary }]} numberOfLines={1}>
                    {option.label}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: surface.hairline }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.max(2, ghostPct)}%`,
                        backgroundColor: surface.textMuted,
                        opacity: 0.35,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {canAddOption ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add vote option"
          onPress={onAddOption}
          style={({ pressed }) => [styles.addOptionBtn, pressed && { opacity: 0.7 }]}>
          <View style={styles.addOptionIconSlot}>
            <Ionicons name="add-circle-outline" size={18} color={surface.textMuted} />
          </View>
          <Text style={[styles.addOptionText, { color: surface.textMuted }]}>Add option</Text>
          <View style={styles.addOptionTrailingSpacer} />
        </Pressable>
      ) : null}

      <Text style={[styles.peopleText, { color: surface.textMuted }]} numberOfLines={3}>
        Tap a label to edit · tap the row to mark ShouldI&apos;s suggested lean · drag the handle on the right to reorder.
      </Text>
    </View>
  );
}
