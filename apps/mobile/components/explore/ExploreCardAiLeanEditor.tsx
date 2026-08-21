import * as React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, themeSurface, typography } from '@/constants/theme';
import { ExpertVerdictList } from '@/components/explore/ExpertVerdictList';
import { keyMomentTagText } from '@/lib/textExcerpt';
import type { DecideInterviewFinalDecision } from '@shouldi/contracts';

const BODY_LINE_HEIGHT = 21;
const HEADLINE_LINE_HEIGHT = 22;

function useAutoGrowHeight(text: string, lineHeight: number, minHeight: number) {
  const [height, setHeight] = React.useState(minHeight);
  const lineCount = Math.max(1, text.split('\n').length);
  const estimated = Math.max(minHeight, lineCount * lineHeight + 4);

  React.useEffect(() => {
    setHeight((prev) => Math.max(prev, estimated));
  }, [estimated]);

  const onContentSizeChange = React.useCallback(
    (contentHeight: number) => {
      setHeight(Math.max(minHeight, contentHeight));
    },
    [minHeight],
  );

  return { height, onContentSizeChange };
}

function AutoGrowTextInput({
  value,
  onChangeText,
  style,
  minHeight,
  lineHeight,
  ...rest
}: React.ComponentProps<typeof TextInput> & { minHeight: number; lineHeight: number }) {
  const { height, onContentSizeChange } = useAutoGrowHeight(String(value ?? ''), lineHeight, minHeight);

  return (
    <TextInput
      {...rest}
      value={value}
      onChangeText={onChangeText}
      multiline
      scrollEnabled={false}
      textAlignVertical="top"
      onContentSizeChange={(event) => onContentSizeChange(event.nativeEvent.contentSize.height)}
      style={[style, { height, lineHeight }]}
    />
  );
}

type Props = {
  verdictLine: string;
  verdictBecause: string;
  confidenceScore?: number;
  keyMoments?: DecideInterviewFinalDecision['keyMoments'];
  selectedKeyMomentIndices?: number[];
  onToggleKeyMoment?(index: number): void;
  expertVerdicts?: DecideInterviewFinalDecision['expertVerdicts'];
  onChangeVerdictLine(text: string): void;
  onChangeVerdictBecause(text: string): void;
};

export function ExploreCardAiLeanEditor({
  verdictLine,
  verdictBecause,
  confidenceScore,
  keyMoments,
  selectedKeyMomentIndices,
  onToggleKeyMoment,
  expertVerdicts,
  onChangeVerdictLine,
  onChangeVerdictBecause,
}: Props) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const selectedSet = new Set(selectedKeyMomentIndices ?? []);
  const keyContextTags = (keyMoments ?? [])
    .map((m, index) => ({ index, excerpt: keyMomentTagText(m) }))
    .filter((tag) => tag.excerpt.length > 0);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder },
      ]}
      accessibilityLabel="ShouldI lean preview">
      <Text style={[styles.eyebrow, { color: surface.textMuted }]}>ShouldI lean</Text>

      {confidenceScore != null ? (
        <View style={styles.clarityRow}>
          <Text style={[styles.clarityLabel, { color: surface.textMuted }]}>AI Confidence</Text>
          <Text style={[styles.clarityValue, { color: surface.textPrimary }]}>{confidenceScore}%</Text>
        </View>
      ) : null}
      {confidenceScore != null ? (
        <View style={[styles.clarityTrack, { backgroundColor: surface.groupedBorder }]}>
          <View
            style={[
              styles.clarityFill,
              { width: `${Math.min(100, Math.max(0, confidenceScore))}%` },
            ]}
          />
        </View>
      ) : null}

      <AutoGrowTextInput
        accessibilityLabel="Recommendation headline"
        value={verdictLine}
        onChangeText={onChangeVerdictLine}
        placeholder="Clear recommendation headline"
        placeholderTextColor={surface.textMuted}
        minHeight={HEADLINE_LINE_HEIGHT}
        lineHeight={HEADLINE_LINE_HEIGHT}
        style={[styles.headlineInput, { color: surface.textPrimary }]}
      />
      <AutoGrowTextInput
        accessibilityLabel="Recommendation reasoning"
        value={verdictBecause}
        onChangeText={onChangeVerdictBecause}
        placeholder="Why this recommendation — tradeoffs, risks, and constraints."
        placeholderTextColor={surface.textMuted}
        minHeight={BODY_LINE_HEIGHT * 3}
        lineHeight={BODY_LINE_HEIGHT}
        style={[styles.bodyInput, { color: surface.textPrimary }]}
      />

      {keyContextTags.length > 0 ? (
        <View style={[styles.keyContextBlock, { borderTopColor: surface.groupedBorder }]}>
          <Text style={[styles.keyContextEyebrow, { color: surface.textMuted }]}>
            Key context — tap to include on the post card
          </Text>
          <View style={styles.keyContextTagRow}>
            {keyContextTags.map(({ index, excerpt }) => {
              const selected = selectedSet.has(index);
              return (
                <Pressable
                  key={index}
                  onPress={() => onToggleKeyMoment?.(index)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.keyContextTag,
                    {
                      backgroundColor: selected ? palette.heroInk : 'transparent',
                      borderColor: selected ? palette.heroInk : surface.groupedBorder,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.keyContextTagText,
                      { color: selected ? palette.textOnCanvas : surface.textMuted },
                    ]}
                    numberOfLines={2}>
                    {excerpt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {expertVerdicts && expertVerdicts.length > 0 ? (
        <ExpertVerdictList expertVerdicts={expertVerdicts} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  eyebrow: {
    ...typography.caption,
    fontWeight: '600',
  },
  clarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clarityLabel: {
    ...typography.caption,
    fontWeight: '500',
  },
  clarityValue: {
    ...typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  clarityTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  clarityFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.heroInk,
  },
  headlineInput: {
    ...typography.compact,
    fontWeight: '700',
    padding: 0,
    margin: 0,
  },
  bodyInput: {
    ...typography.compact,
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  keyContextBlock: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  keyContextEyebrow: {
    ...typography.caption,
    fontWeight: '600',
  },
  keyContextTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  keyContextTag: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  keyContextTagText: {
    ...typography.caption,
    fontWeight: '500',
  },
});
