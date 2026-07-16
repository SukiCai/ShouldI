import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import { council, screenContentGutter, semantic } from '@/constants/theme';
import type { ProfileStatDestination } from '@/lib/profileScreenData';
import type { ProfileStatMock } from '@/lib/profileMockData';

import { youScreenStyles as styles } from './youScreenStyles';

type ProfileMomentumStat = ProfileStatMock & {
  destination: ProfileStatDestination;
};

type ProfileStatsRowProps = {
  stats: ProfileMomentumStat[];
  textDisplay: string;
  textMuted: string;
  statTileBg: string;
  statTileBorder: string;
};

function navigateStat(destination: ProfileStatDestination) {
  if (destination === 'decide') {
    router.replace('/(tabs)/decide');
    return;
  }
  router.replace('/(tabs)/replay');
}

function StatCard({
  item,
  textDisplay,
  textMuted,
  statTileBg,
  statTileBorder,
}: {
  item: ProfileMomentumStat;
  textDisplay: string;
  textMuted: string;
  statTileBg: string;
  statTileBorder: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}: ${item.value}. ${item.hint}`}
      onPress={() => navigateStat(item.destination)}
      style={({ pressed }) => [
        styles.statMiniCard,
        { backgroundColor: statTileBg, borderColor: statTileBorder },
        pressed && { opacity: 0.92 },
      ]}>
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
    </Pressable>
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
