import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { themeSurface, typography } from '@/constants/theme';

export type ExpertVerdictListItem = {
  expertTitle: string;
  verdictLine: string;
  reasoning?: string;
};

type Props = {
  expertVerdicts: ExpertVerdictListItem[];
};

/**
 * Every expert is always shown — this list isn't opt-in like key context
 * tags. Tapping a row with reasoning expands it inline; collapsed rows show
 * just the one-line stance.
 */
export function ExpertVerdictList({ expertVerdicts }: Props) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  if (expertVerdicts.length === 0) return null;

  return (
    <View style={[styles.block, { borderTopColor: surface.groupedBorder }]}>
      <Text style={[styles.eyebrow, { color: surface.textMuted }]}>
        {expertVerdicts.length} experts weighed in
      </Text>
      {expertVerdicts.map((verdict, index) => {
        const hasReasoning = !!verdict.reasoning?.trim();
        const expanded = expandedIndex === index;
        return (
          <Pressable
            key={index}
            disabled={!hasReasoning}
            accessibilityRole={hasReasoning ? 'button' : undefined}
            accessibilityState={hasReasoning ? { expanded } : undefined}
            accessibilityLabel={
              hasReasoning ? `${verdict.expertTitle} — tap to ${expanded ? 'collapse' : 'expand'} full reasoning` : undefined
            }
            onPress={() => hasReasoning && setExpandedIndex(expanded ? null : index)}
            style={styles.row}>
            <Text style={[styles.line, { color: surface.textMuted }]}>
              · {verdict.expertTitle}: {verdict.verdictLine}
              {hasReasoning ? (expanded ? '  ▲' : '  ▾') : ''}
            </Text>
            {expanded && verdict.reasoning ? (
              <Text style={[styles.reasoning, { color: surface.textMuted }]}>{verdict.reasoning}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  eyebrow: {
    ...typography.caption,
    fontWeight: '600',
  },
  row: {
    paddingVertical: 2,
  },
  line: {
    ...typography.caption,
    fontWeight: '500',
  },
  reasoning: {
    ...typography.caption,
    marginTop: 4,
    marginLeft: 12,
    lineHeight: 18,
    opacity: 0.92,
  },
});
