import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { semantic } from '@/constants/theme';
import type { DecisionDnaProfile } from '@shouldi/contracts';

import { youScreenStyles as styles } from './youScreenStyles';

type TabKey = 'strengths' | 'growth';

type StrengthsGrowthSectionProps = {
  dna?: DecisionDnaProfile;
  textDisplay: string;
  textPrimary: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  canvasSecondary: string;
};

const DEFAULT_STRENGTHS = [
  { title: 'Strong at research', body: 'You gather context before committing.' },
  { title: 'Consistent follow-through', body: 'You return to log outcomes.' },
  { title: 'Clear values', body: 'Tradeoffs stay tied to what matters.' },
];

function growthItems(dna?: DecisionDnaProfile) {
  if (dna?.blindSpots?.length) {
    return dna.blindSpots.slice(0, 3).map((spot) => ({
      title: spot,
      body: 'An improvable pattern — not a fixed trait.',
    }));
  }
  return [
    {
      title: 'Outcome logging',
      body: 'Replay more decisions to sharpen calibration.',
    },
  ];
}

function strengthItems(dna?: DecisionDnaProfile) {
  if (dna?.trajectory?.length) {
    return dna.trajectory.slice(0, 3).map((line) => ({
      title: line.length > 48 ? `${line.slice(0, 48)}…` : line,
      body: 'Pattern from your replay history.',
    }));
  }
  return DEFAULT_STRENGTHS;
}

export function StrengthsGrowthSection({
  dna,
  textDisplay,
  textPrimary,
  textMuted,
  groupedSurface,
  groupedBorder,
  canvasSecondary,
}: StrengthsGrowthSectionProps) {
  const [tab, setTab] = React.useState<TabKey>('strengths');
  const items = tab === 'strengths' ? strengthItems(dna) : growthItems(dna);

  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.threadsTitle, { color: textDisplay }]}>Patterns</Text>
        <View style={styles.patternTabRow}>
          {(['strengths', 'growth'] as TabKey[]).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(key)}
                style={[
                  styles.patternTab,
                  active && { backgroundColor: semantic.actionPrimary },
                ]}>
                <Text
                  style={[
                    styles.activityFilterLabel,
                    { color: textMuted },
                    active && styles.activityFilterLabelActive,
                  ]}>
                  {key === 'strengths' ? 'Strengths' : 'Growth'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.feedCard,
          { backgroundColor: groupedSurface, borderColor: groupedBorder },
        ]}>
        {items.map((item, index) => (
          <View
            key={`${item.title}-${index}`}
            style={[
              styles.patternInsightRow,
              index < items.length - 1 && {
                borderBottomColor: groupedBorder,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}>
            <View style={[styles.patternInsightIcon, { backgroundColor: canvasSecondary }]}>
              <Text style={{ fontSize: 14 }}>{tab === 'strengths' ? '✓' : '↗'}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.cardTitle, { color: textPrimary }]}>{item.title}</Text>
              <Text style={[styles.cardBody, { color: textMuted }]}>{item.body}</Text>
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to Outcome Replay"
          onPress={() => router.replace('/(tabs)/replay')}
          style={[styles.ghostBtn, { borderColor: groupedBorder, marginTop: 4 }]}>
          <Text style={[styles.ghostBtnText, { color: textPrimary }]}>Go to Replay</Text>
        </Pressable>
      </View>
    </View>
  );
}
