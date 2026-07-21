import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, semantic, typography } from '@/constants/theme';
import type { DecideInterviewExpert } from '@shouldi/contracts';

import { ExpertGlyph } from './DecideThreadParts';
import { formatSenderDisplay } from './threadHelpers';

type Props = {
  clarityPercent: number | null;
  progressCaption?: string | null;
  experts: DecideInterviewExpert[];
  isCouncil: boolean;
  colors: {
    muted: string;
    primaryTxt: string;
    cardBorder: string;
    cardBg: string;
  };
  onPressExperts?: () => void;
};

function expertStatusLine(experts: DecideInterviewExpert[], isCouncil: boolean): string {
  if (experts.length === 0) {
    return isCouncil ? 'Assembling expert council' : 'Reviewing your decision';
  }
  if (isCouncil) {
    return experts.length === 1
      ? '1 expert deciding with you'
      : `${experts.length} experts deciding together`;
  }
  return `${formatSenderDisplay(experts[0].title)} is reviewing`;
}

export function DecideSessionStatus({
  clarityPercent,
  progressCaption,
  experts,
  isCouncil,
  colors,
  onPressExperts,
}: Props) {
  const canOpenRoster = !!onPressExperts && experts.length > 0;
  const statusLine = expertStatusLine(experts, isCouncil);
  const clarityValue = clarityPercent ?? 0;

  return (
    <Pressable
      accessibilityRole={canOpenRoster ? 'button' : 'text'}
      accessibilityLabel={
        clarityPercent !== null
          ? `Clarity ${clarityValue} percent. ${statusLine}`
          : statusLine
      }
      disabled={!canOpenRoster}
      onPress={onPressExperts}
      style={({ pressed }) => [styles.wrap, pressed && canOpenRoster && styles.wrapPressed]}>
      {clarityPercent !== null ? (
        <View style={styles.clarityBlock}>
          <View style={styles.clarityHeader}>
            <Text style={[styles.clarityLabel, { color: colors.muted }]}>Clarity</Text>
            <View style={styles.clarityMeta}>
              {progressCaption ? (
                <Text style={[styles.progressCaption, { color: colors.muted }]}>{progressCaption}</Text>
              ) : null}
              <Text style={[styles.clarityValue, { color: colors.primaryTxt }]}>{clarityValue}%</Text>
            </View>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, Math.max(0, clarityValue))}%`,
                  backgroundColor: semantic.actionPrimary,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.expertRow}>
        {experts.length > 0 ? (
          <View style={styles.avatarStack}>
            {experts.slice(0, 4).map((expert, index) => (
              <View
                key={expert.id}
                style={[
                  styles.avatarWrap,
                  index > 0 && styles.avatarOverlap,
                  { borderColor: colors.cardBg },
                ]}>
                <ExpertGlyph expert={expert} fallbackColor={semantic.actionPrimary} size={22} />
              </View>
            ))}
            {experts.length > 4 ? (
              <View style={[styles.avatarMore, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <Text style={[styles.avatarMoreText, { color: colors.muted }]}>+{experts.length - 4}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.avatarPlaceholder, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
            <Ionicons name={isCouncil ? 'people-outline' : 'sparkles-outline'} size={13} color={colors.muted} />
          </View>
        )}
        <Text style={[styles.expertStatusText, { color: colors.muted }]} numberOfLines={2}>
          {statusLine}
        </Text>
        {canOpenRoster ? <Ionicons name="chevron-down" size={12} color={colors.muted} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wrapPressed: {
    opacity: 0.88,
  },
  clarityBlock: {
    gap: 6,
  },
  clarityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  clarityLabel: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  clarityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressCaption: {
    ...typography.caption,
    fontWeight: '500',
  },
  clarityValue: {
    ...typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  expertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarWrap: {
    borderRadius: 99,
    borderWidth: 1.5,
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarMore: {
    marginLeft: -8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  avatarMoreText: {
    ...typography.caption,
    fontWeight: '700',
  },
  avatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expertStatusText: {
    flex: 1,
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 16,
  },
});
