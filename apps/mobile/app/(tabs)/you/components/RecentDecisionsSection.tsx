import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { semantic } from '@/constants/theme';
import type { ProfileRecentDecisionMock, ProfileRecentDecisionStatus } from '@/lib/profileMockData';

import { ProfileSpringPress } from './profileMotion';
import { youScreenStyles as styles } from './youScreenStyles';

const statusPillStyle = {
  paddingHorizontal: 10,
  paddingVertical: 4,
  flexShrink: 0 as const,
};

type RecentDecisionsSectionProps = {
  decisions: ProfileRecentDecisionMock[];
  textDisplay: string;
  textPrimary: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  hairline: string;
};

function statusPillCopy(status: ProfileRecentDecisionStatus): string {
  if (status === 'needs_outcome') return 'Log outcome';
  if (status === 'in_progress') return 'In progress';
  return 'Decided';
}

function StatusPill({ status }: { status: ProfileRecentDecisionStatus }) {
  const isNeedsOutcome = status === 'needs_outcome';
  const isInProgress = status === 'in_progress';
  const color = isNeedsOutcome
    ? semantic.actionPrimary
    : isInProgress
      ? semantic.actionCaution
      : semantic.actionAffirm;
  const bg = isNeedsOutcome
    ? `${semantic.actionPrimary}18`
    : isInProgress
      ? `${semantic.actionCaution}20`
      : `${semantic.actionAffirm}18`;

  return (
    <View style={[styles.statusPill, statusPillStyle, { backgroundColor: bg }]}>
      <Text style={[styles.statusPillText, { color }]}>{statusPillCopy(status)}</Text>
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
  const pendingCount = decisions.filter((row) => row.status === 'needs_outcome').length;

  return (
    <View style={styles.sectionWrap}>
      <View
        style={[
          styles.insightFeedCard,
          styles.insightCardShell,
          { backgroundColor: groupedSurface, borderColor: groupedBorder, gap: 0 },
        ]}>
        <ProfileSpringPress
          accessibilityRole="button"
          accessibilityLabel="View all decisions"
          haptic="selection"
          onPress={() => router.replace('/(tabs)/replay')}
          style={styles.insightCardHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={[styles.insightCardTitle, { color: textDisplay }]}>Recent decisions</Text>
            {pendingCount > 0 ? (
              <Text style={[styles.postFoot, { color: textMuted }]}>
                {pendingCount} outcome{pendingCount === 1 ? '' : 's'} to log
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={14} color={textMuted} />
        </ProfileSpringPress>

        {decisions.map((decision, index) => {
          const isLast = index === decisions.length - 1;
          return (
            <ProfileSpringPress
              key={decision.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${decision.title}`}
              haptic="none"
              onPress={() =>
                router.push({
                  pathname: '/outcome-replay/[id]',
                  params: { id: decision.id },
                })
              }
              style={[
                styles.recentDecisionRow,
                !isLast && {
                  borderBottomColor: hairline,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
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
                    {decision.categoryLabel} · {decision.whenLabel}
                  </Text>
                </View>
                <StatusPill status={decision.status} />
              </View>
            </ProfileSpringPress>
          );
        })}

        <ProfileSpringPress
          accessibilityRole="button"
          accessibilityLabel="Start a decision"
          haptic="light"
          onPress={() => router.replace('/(tabs)/decide')}
          style={[
            styles.ghostBtn,
            styles.cardListFooterBtn,
            { borderColor: groupedBorder },
          ]}>
          <Text style={[styles.ghostBtnText, { color: textPrimary }]}>Start a decision</Text>
        </ProfileSpringPress>
      </View>
    </View>
  );
}
