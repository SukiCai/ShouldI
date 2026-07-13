import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import { council } from '@/constants/theme';
import type { ProfileDnaDimensionMock } from '@/lib/profileMockData';

import { ProfileDnaRadar } from './ProfileDnaRadar';
import { youScreenStyles as styles } from './youScreenStyles';

type ProfileDnaCardProps = {
  summary: string;
  dimensions: ProfileDnaDimensionMock[];
  textDisplay: string;
  textPrimary: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  compact?: boolean;
};

export function ProfileDnaCard({
  summary,
  dimensions,
  textDisplay,
  textPrimary,
  textMuted,
  groupedSurface,
  groupedBorder,
  compact = false,
}: ProfileDnaCardProps) {
  if (!compact) {
    return (
      <View style={styles.sectionWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View Decision DNA"
          onPress={() => router.replace('/(tabs)/replay')}
          style={styles.sectionTitlePress}>
          <Text style={[styles.threadsTitle, { color: textDisplay }]}>Your Decision DNA</Text>
          <Ionicons name="chevron-forward" size={18} color={textMuted} />
        </Pressable>
        <View
          style={[
            styles.feedCard,
            { backgroundColor: groupedSurface, borderColor: groupedBorder },
          ]}>
          <ProfileDnaRadar
            dimensions={dimensions}
            accentColor={council.violet}
            gridColor={groupedBorder}
            fillColor={`${council.violet}33`}
            labelColor={textDisplay}
            levelColor={textMuted}
          />
          <View style={[styles.dnaSummaryBox, { backgroundColor: '#f5f3ff' }]}>
            <Ionicons name="sparkles" size={14} color={council.violet} style={{ marginTop: 1 }} />
            <Text style={[styles.dnaSummaryText, { color: textPrimary, flex: 1 }]}>{summary}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.insightColumnDna}>
      <View
        style={[
          styles.insightFeedCard,
          styles.insightCardShell,
          styles.insightCardColumn,
          { backgroundColor: groupedSurface, borderColor: groupedBorder },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View Decision DNA"
          onPress={() => router.replace('/(tabs)/replay')}
          style={styles.insightCardHeader}>
          <Text style={[styles.insightCardTitle, { color: textDisplay }]} numberOfLines={2}>
            Your Decision DNA
          </Text>
          <Ionicons name="chevron-forward" size={14} color={textMuted} />
        </Pressable>

        <ProfileDnaRadar
          dimensions={dimensions}
          accentColor={council.violet}
          gridColor={groupedBorder}
          fillColor={`${council.violet}33`}
          labelColor={textDisplay}
          levelColor={textMuted}
          compact
        />

        <View style={[styles.dnaSummaryBox, styles.dnaSummaryBoxCompact, { backgroundColor: '#f5f3ff' }]}>
          <Ionicons name="sparkles" size={12} color={council.violet} style={{ marginTop: 1 }} />
          <Text style={[styles.dnaSummaryCompact, { color: textPrimary, flex: 1 }]}>
            {summary}
          </Text>
        </View>
      </View>
    </View>
  );
}
