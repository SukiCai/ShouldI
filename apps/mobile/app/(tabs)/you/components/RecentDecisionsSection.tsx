import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { semantic } from '@/constants/theme';
import type { ProfileRecentDecisionMock } from '@/lib/profileMockData';

import { youScreenStyles as styles } from './youScreenStyles';

type RecentDecisionsSectionProps = {
  decisions: ProfileRecentDecisionMock[];
  textDisplay: string;
  textPrimary: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  hairline: string;
};

function StatusPill({ isDecided }: { isDecided: boolean }) {
  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: isDecided ? `${semantic.actionAffirm}18` : `${semantic.actionCaution}20`,
          flexShrink: 0,
        },
      ]}>
      <Text
        style={[
          styles.statusPillText,
          { color: isDecided ? semantic.actionAffirm : semantic.actionCaution },
        ]}>
        {isDecided ? 'Decided' : 'In Progress'}
      </Text>
    </View>
  );
}

export function RecentDecisionsSection({
  decisions,
  textDisplay,
  textPrimary,
  textMuted,
  groupedSurface,
  groupedBorder,
  hairline,
}: RecentDecisionsSectionProps) {
  return (
    <View style={styles.sectionWrap}>
      <View
        style={[
          styles.insightFeedCard,
          styles.insightCardShell,
          { backgroundColor: groupedSurface, borderColor: groupedBorder, gap: 0 },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all decisions"
          onPress={() => router.replace('/(tabs)/replay')}
          style={styles.insightCardHeader}>
          <Text style={[styles.insightCardTitle, { color: textDisplay }]}>Recent Decisions</Text>
          <Ionicons name="chevron-forward" size={14} color={textMuted} />
        </Pressable>

        {decisions.length === 0 ? (
          <View style={styles.recentEmptyState}>
            <Text style={[styles.cardBody, { color: textMuted }]}>
              Your recent decisions will appear here after you complete Decide.
            </Text>
          </View>
        ) : null}

        {decisions.map((decision, index) => {
          const isLast = index === decisions.length - 1;
          const isDecided = decision.status === 'decided';
          return (
            <Pressable
              key={decision.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${decision.title}`}
              onPress={() =>
                router.push({
                  pathname: '/outcome-replay/[id]',
                  params: { id: decision.id },
                })
              }
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
          style={[
            styles.ghostBtn,
            { borderColor: groupedBorder, marginTop: 12, marginBottom: 2, alignSelf: 'stretch', alignItems: 'center' },
          ]}>
          <Text style={[styles.ghostBtnText, { color: textPrimary }]}>Start a new decision</Text>
        </Pressable>
      </View>
    </View>
  );
}
