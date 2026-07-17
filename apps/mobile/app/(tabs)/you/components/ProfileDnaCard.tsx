import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import { semantic } from '@/constants/theme';
import { dnaSummarySurfaceBg } from '@/lib/profileChromatic';
import {
  buildDnaAccessibilityLabel,
  DNA_RADAR_MIN_DECISIONS,
} from '@/lib/profileScreenData';
import type { ProfileDnaDimensionMock } from '@/lib/profileMockData';

import { ProfileDnaRadar } from './ProfileDnaRadar';
import { youScreenStyles as styles } from './youScreenStyles';

type ProfileDnaCardProps = {
  summary: string;
  dimensions: ProfileDnaDimensionMock[];
  decisionsCount: number;
  metricsSubline?: string | null;
  textDisplay: string;
  textPrimary: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
};

export function ProfileDnaCard({
  summary,
  dimensions,
  decisionsCount,
  metricsSubline,
  textDisplay,
  textPrimary,
  textMuted,
  groupedSurface,
  groupedBorder,
}: ProfileDnaCardProps) {
  const showRadar = decisionsCount >= DNA_RADAR_MIN_DECISIONS && dimensions.length > 0;
  const radarLabel = buildDnaAccessibilityLabel(dimensions);
  const summaryBg = dnaSummarySurfaceBg();

  return (
    <View style={styles.sectionWrap}>
      <View
        style={[
          styles.insightFeedCard,
          styles.insightCardShell,
          { backgroundColor: groupedSurface, borderColor: groupedBorder },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View Decision DNA"
          onPress={() => router.replace('/(tabs)/replay')}
          style={[styles.insightCardHeader, metricsSubline ? { marginBottom: 2 } : null]}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={[styles.insightCardTitle, { color: textDisplay }]}>Decision DNA</Text>
            {metricsSubline ? (
              <Text style={[styles.postFoot, { color: textMuted }]} numberOfLines={1}>
                {metricsSubline}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={14} color={textMuted} />
        </Pressable>

        {showRadar ? (
          <View
            style={styles.dnaRadarWrap}
            accessible
            accessibilityRole="image"
            accessibilityLabel={radarLabel}>
            <ProfileDnaRadar
              dimensions={dimensions}
              accentColor={semantic.actionPrimary}
              gridColor={groupedBorder}
              fillColor={`${semantic.actionPrimary}33`}
              labelColor={textDisplay}
              levelColor={textMuted}
            />
          </View>
        ) : (
          <View style={styles.dnaTeaserBox}>
            <Text style={[styles.dnaTeaserTitle, { color: textDisplay }]}>Pattern forming</Text>
            <Text style={[styles.dnaTeaserBody, { color: textMuted }]}>
              Complete more decisions to see your pattern chart.
            </Text>
          </View>
        )}

        <View style={[styles.dnaSummaryBox, { backgroundColor: summaryBg }]}>
          <Ionicons name="sparkles" size={14} color={semantic.actionPrimary} style={{ marginTop: 1 }} />
          <Text style={[styles.dnaSummaryText, { color: textPrimary, flex: 1 }]}>{summary}</Text>
        </View>
      </View>
    </View>
  );
}
