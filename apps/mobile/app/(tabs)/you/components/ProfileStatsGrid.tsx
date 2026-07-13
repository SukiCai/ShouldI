import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import { youScreenStyles as styles } from './youScreenStyles';

type StatItem = {
  label: string;
  value: string;
  hint: string;
  onPress?(): void;
};

type ProfileStatsGridProps = {
  decisionsCount: number;
  calibrationScore?: number;
  activeThreadCount: number;
  pointsBalance: number;
  textDisplay: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  hairline: string;
  onOpenRewards(): void;
};

function StatTile({
  item,
  textDisplay,
  textMuted,
  groupedSurface,
  groupedBorder,
}: {
  item: StatItem;
  textDisplay: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
}) {
  const content = (
    <>
      <Text style={[styles.statTileLabel, { color: textMuted }]}>{item.label}</Text>
      <Text style={[styles.statTileValue, { color: textDisplay }]}>{item.value}</Text>
      <Text style={[styles.statTileHint, { color: textMuted }]} numberOfLines={2}>
        {item.hint}
      </Text>
    </>
  );

  if (!item.onPress) {
    return (
      <View style={[styles.statTile, { backgroundColor: groupedSurface, borderColor: groupedBorder }]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}: ${item.value}`}
      onPress={item.onPress}
      style={({ pressed }) => [
        styles.statTile,
        { backgroundColor: groupedSurface, borderColor: groupedBorder },
        pressed && { opacity: 0.92 },
      ]}>
      {content}
    </Pressable>
  );
}

export function ProfileStatsGrid(props: ProfileStatsGridProps) {
  const calibrationValue =
    props.calibrationScore != null ? `${Math.round(props.calibrationScore)}` : '—';

  const items: [StatItem, StatItem, StatItem, StatItem] = [
    {
      label: 'Decisions',
      value: String(props.decisionsCount),
      hint: props.decisionsCount > 0 ? 'Completed in ShouldI' : 'Start with Decide',
    },
    {
      label: 'Calibration',
      value: calibrationValue,
      hint: props.calibrationScore != null ? 'Decision Lens score' : 'After first replay',
    },
    {
      label: 'Threads',
      value: String(props.activeThreadCount),
      hint: 'Voted or watching',
    },
    {
      label: 'Rewards',
      value: props.pointsBalance.toLocaleString(),
      hint: 'Tap for activity',
      onPress: props.onOpenRewards,
    },
  ];

  return (
    <View style={styles.statsGrid}>
      <View style={styles.statsGridRow}>
        <StatTile
          item={items[0]}
          textDisplay={props.textDisplay}
          textMuted={props.textMuted}
          groupedSurface={props.groupedSurface}
          groupedBorder={props.groupedBorder}
        />
        <StatTile
          item={items[1]}
          textDisplay={props.textDisplay}
          textMuted={props.textMuted}
          groupedSurface={props.groupedSurface}
          groupedBorder={props.groupedBorder}
        />
      </View>
      <View style={styles.statsGridRow}>
        <StatTile
          item={items[2]}
          textDisplay={props.textDisplay}
          textMuted={props.textMuted}
          groupedSurface={props.groupedSurface}
          groupedBorder={props.groupedBorder}
        />
        <StatTile
          item={items[3]}
          textDisplay={props.textDisplay}
          textMuted={props.textMuted}
          groupedSurface={props.groupedSurface}
          groupedBorder={props.groupedBorder}
        />
      </View>
    </View>
  );
}
