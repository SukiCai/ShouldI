import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Text, View } from 'react-native';

import { council, screenContentGutter, semantic } from '@/constants/theme';
import type { ProfileStatMock } from '@/lib/profileMockData';

import { youScreenStyles as styles } from './youScreenStyles';

type ProfileStatsRowProps = {
  stats: ProfileStatMock[];
  textDisplay: string;
  textMuted: string;
  statTileBg: string;
  statTileBorder: string;
};

function StatCard({
  item,
  textDisplay,
  textMuted,
  statTileBg,
  statTileBorder,
}: {
  item: ProfileStatMock;
  textDisplay: string;
  textMuted: string;
  statTileBg: string;
  statTileBorder: string;
}) {
  return (
    <View style={[styles.statMiniCard, { backgroundColor: statTileBg, borderColor: statTileBorder }]}>
      <View style={[styles.statIconWrap, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={16} color={item.iconColor} />
      </View>
      <Text style={[styles.statMiniValue, { color: textDisplay }]}>{item.value}</Text>
      <Text style={[styles.statMiniLabel, { color: textMuted }]} numberOfLines={2}>
        {item.label}
      </Text>
      <Text style={[styles.statMiniHint, { color: semantic.actionAffirm }]} numberOfLines={2}>
        {item.hint}
      </Text>
    </View>
  );
}

export function ProfileStatsRow({
  stats,
  textDisplay,
  textMuted,
  statTileBg,
  statTileBorder,
}: ProfileStatsRowProps) {
  return (
    <View style={[styles.statsRowGrid, { paddingHorizontal: screenContentGutter }]}>
      {stats.map((item) => (
        <StatCard
          key={item.label}
          item={item}
          textDisplay={textDisplay}
          textMuted={textMuted}
          statTileBg={statTileBg}
          statTileBorder={statTileBorder}
        />
      ))}
    </View>
  );
}
