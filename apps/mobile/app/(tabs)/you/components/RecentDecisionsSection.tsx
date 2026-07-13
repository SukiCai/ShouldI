import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { council, semantic } from '@/constants/theme';
import type { ProfileRecentDecisionMock } from '@/lib/profileMockData';

import { youScreenStyles as styles } from './youScreenStyles';

type RecentDecisionsSectionProps = {
  decisions: ProfileRecentDecisionMock[];
  textDisplay: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  hairline: string;
  compact?: boolean;
};

function StatusPill({
  isDecided,
  compact,
}: {
  isDecided: boolean;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        compact ? styles.statusPillInsight : styles.statusPill,
        {
          backgroundColor: isDecided ? `${semantic.actionAffirm}18` : `${semantic.actionCaution}20`,
          flexShrink: 0,
        },
      ]}>
      <Text
        style={[
          compact ? styles.statusPillInsightText : styles.statusPillText,
          { color: isDecided ? semantic.actionAffirm : semantic.actionCaution },
        ]}>
        {isDecided ? '✓ Decided' : 'In Progress'}
      </Text>
    </View>
  );
}

export function RecentDecisionsSection({
  decisions,
  textDisplay,
  textMuted,
  groupedSurface,
  groupedBorder,
  hairline,
  compact = false,
}: RecentDecisionsSectionProps) {
  if (!compact) {
    return (
      <View style={styles.sectionWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all decisions"
          onPress={() => router.replace('/(tabs)/replay')}
          style={styles.sectionTitlePress}>
          <Text style={[styles.threadsTitle, { color: textDisplay }]}>Recent Decisions</Text>
          <Ionicons name="chevron-forward" size={18} color={textMuted} />
        </Pressable>
        <View
          style={[
            styles.feedCard,
            { backgroundColor: groupedSurface, borderColor: groupedBorder, gap: 0 },
          ]}>
          {decisions.map((decision, index) => {
            const isLast = index === decisions.length - 1;
            const isDecided = decision.status === 'decided';
            return (
              <Pressable
                key={decision.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${decision.title}`}
                onPress={() => router.replace('/(tabs)/decide')}
                style={({ pressed }) => [
                  styles.recentDecisionRow,
                  !isLast && {
                    borderBottomColor: hairline,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                  pressed && { opacity: 0.9 },
                ]}>
                <View style={styles.recentDecisionRowLayout}>
                  <View style={[styles.recentIconWrap, { backgroundColor: decision.iconBg }]}>
                    <Ionicons name={decision.icon} size={16} color={decision.iconColor} />
                  </View>
                  <View style={styles.recentDecisionCopy}>
                    <Text style={[styles.recentDecisionTitle, { color: textDisplay }]} numberOfLines={2}>
                      {decision.title}
                    </Text>
                    <Text style={[styles.postFoot, { color: textMuted }]}>
                      {decision.categoryLabel} • {decision.whenLabel}
                    </Text>
                  </View>
                  <StatusPill isDecided={isDecided} />
                </View>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new decision"
            onPress={() => router.replace('/(tabs)/decide')}
            style={[styles.startDecisionBtn, { borderColor: groupedBorder }]}>
            <Text style={[styles.startDecisionBtnText, { color: textDisplay, flex: 1 }]}>
              Start a new decision
            </Text>
            <Ionicons name="add" size={20} color={council.violet} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.insightColumnRecent}>
      <View
        style={[
          styles.insightFeedCard,
          styles.insightCardShell,
          styles.insightCardColumn,
          { backgroundColor: groupedSurface, borderColor: groupedBorder, gap: 0 },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all decisions"
          onPress={() => router.replace('/(tabs)/replay')}
          style={styles.insightCardHeader}>
          <Text style={[styles.insightCardTitle, { color: textDisplay }]} numberOfLines={1}>
            Recent Decisions
          </Text>
          <Ionicons name="chevron-forward" size={14} color={textMuted} />
        </Pressable>

        <View style={styles.insightListBody}>
          {decisions.map((decision, index) => {
            const isLast = index === decisions.length - 1;
            const isDecided = decision.status === 'decided';
            return (
              <Pressable
                key={decision.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${decision.title}`}
                onPress={() => router.replace('/(tabs)/decide')}
                style={({ pressed }) => [
                  styles.recentDecisionRowCompact,
                  !isLast && {
                    borderBottomColor: hairline,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                  pressed && { opacity: 0.9 },
                ]}>
                <View style={styles.recentDecisionRowLayout}>
                  <View
                    style={[styles.recentIconWrapCompact, { backgroundColor: decision.iconBg }]}>
                    <Ionicons name={decision.icon} size={14} color={decision.iconColor} />
                  </View>
                  <View style={styles.recentDecisionCopy}>
                    <Text
                      style={[styles.recentDecisionTitleCompact, { color: textDisplay }]}
                      numberOfLines={2}>
                      {decision.title}
                    </Text>
                    <Text style={[styles.postFootCompact, { color: textMuted }]}>
                      {decision.categoryLabel} • {decision.whenLabel}
                    </Text>
                  </View>
                  <StatusPill isDecided={isDecided} compact />
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new decision"
          onPress={() => router.replace('/(tabs)/decide')}
          style={[styles.startDecisionBtnCompact, { borderColor: groupedBorder }]}>
          <Text style={[styles.startDecisionBtnTextCompact, { color: textDisplay, flex: 1 }]}>
            Start a new decision
          </Text>
          <Ionicons name="add" size={18} color={council.violet} />
        </Pressable>
      </View>
    </View>
  );
}
