import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import JumpUpSheet from '@/components/ui/JumpUpSheet';
import { screenContentGutter, spacing, typography } from '@/constants/theme';

type WalletActivity = {
  id: string;
  label: string;
  amount: number;
  when: string;
};

type WalletHistorySheetProps = {
  visible: boolean;
  onClose: () => void;
  backgroundColor: string;
  borderTopColor: string;
  bottomInset: number;
  grabColor: string;
  primaryTxt: string;
  muted: string;
  accentColor: string;
  hairline: string;
  pointsBalance: number;
  pointsFromOthers: number;
  isPremium: boolean;
  councilSessionCost: number;
  activity: WalletActivity[];
};

export function WalletHistorySheet({
  visible,
  onClose,
  backgroundColor,
  borderTopColor,
  bottomInset,
  grabColor,
  primaryTxt,
  muted,
  accentColor,
  hairline,
  pointsBalance,
  pointsFromOthers,
  isPremium,
  councilSessionCost,
  activity,
}: WalletHistorySheetProps) {
  const fromSelf = Math.max(0, pointsBalance - pointsFromOthers);

  return (
    <JumpUpSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={backgroundColor}
      borderTopColor={borderTopColor}
      bottomInset={bottomInset}
      grabColor={grabColor}
      maxHeight="82%">
      <View style={styles.headRow}>
        <Text style={[styles.title, { color: primaryTxt }]}>Rewards</Text>
        <Pressable hitSlop={12} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.done, { color: muted }]}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.balanceBlock}>
        <Text style={[styles.balanceNum, { color: accentColor }]}>{pointsBalance.toLocaleString()}</Text>
        <Text style={[styles.balanceSuffix, { color: muted }]}>pts total</Text>
      </View>

      <View style={[styles.breakdownCard, { borderColor: hairline }]}>
        <BreakdownRow
          label="From others"
          value={pointsFromOthers}
          hint="Validations, boosts, referrals"
          primaryTxt={primaryTxt}
          muted={muted}
          accentColor={accentColor}
        />
        <View style={[styles.breakdownDivider, { backgroundColor: hairline }]} />
        <BreakdownRow
          label="From your activity"
          value={fromSelf}
          hint="Council runs, promos, dev grants"
          primaryTxt={primaryTxt}
          muted={muted}
          accentColor={accentColor}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: muted }]}>Recent activity</Text>
      <FlatList
        data={activity}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={activity.length > 4}
        style={styles.activityList}
        contentContainerStyle={styles.activityListContent}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: muted }]}>No activity yet — earn pts when others validate your threads.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.activityRow, { borderBottomColor: hairline }]}>
            <View style={[styles.activityGlyph, { backgroundColor: `${accentColor}18` }]}>
              <Ionicons
                name={item.amount >= 0 ? 'arrow-up' : 'arrow-down'}
                size={14}
                color={item.amount >= 0 ? accentColor : muted}
              />
            </View>
            <View style={styles.activityText}>
              <Text style={[styles.activityLabel, { color: primaryTxt }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.activityWhen, { color: muted }]}>{item.when}</Text>
            </View>
            <Text
              style={[
                styles.activityAmount,
                { color: item.amount >= 0 ? accentColor : muted },
              ]}>
              {item.amount >= 0 ? '+' : ''}
              {item.amount.toLocaleString()}
            </Text>
          </View>
        )}
      />

      <Text style={[styles.footerNote, { color: muted }]}>
        {isPremium
          ? 'Premium includes unlimited Expert Council sessions.'
          : `Expert Council costs ${councilSessionCost} pts per session. Tap pro on your profile to upgrade.`}
      </Text>
    </JumpUpSheet>
  );
}

function BreakdownRow({
  label,
  value,
  hint,
  primaryTxt,
  muted,
  accentColor,
}: {
  label: string;
  value: number;
  hint: string;
  primaryTxt: string;
  muted: string;
  accentColor: string;
}) {
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownText}>
        <Text style={[styles.breakdownLabel, { color: primaryTxt }]}>{label}</Text>
        <Text style={[styles.breakdownHint, { color: muted }]}>{hint}</Text>
      </View>
      <Text style={[styles.breakdownValue, { color: accentColor }]}>{value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenContentGutter,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.titleSm,
    fontWeight: '600',
    letterSpacing: -0.25,
  },
  done: {
    ...typography.titleSm,
    fontWeight: '600',
  },
  balanceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: screenContentGutter,
    marginBottom: spacing.md,
  },
  balanceNum: {
    ...typography.displayLg,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  balanceSuffix: {
    ...typography.bodySm,
    fontWeight: '600',
  },
  breakdownCard: {
    marginHorizontal: screenContentGutter,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  breakdownText: {
    flex: 1,
    minWidth: 0,
  },
  breakdownLabel: {
    ...typography.compact,
    fontWeight: '600',
  },
  breakdownHint: {
    ...typography.label,
    fontWeight: '500',
    marginTop: 2,
  },
  breakdownValue: {
    ...typography.body,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    paddingHorizontal: screenContentGutter,
    marginBottom: 8,
  },
  activityList: {
    maxHeight: 220,
  },
  activityListContent: {
    paddingHorizontal: screenContentGutter,
    paddingBottom: spacing.xs,
  },
  empty: {
    paddingVertical: 20,
    ...typography.compact,
    fontWeight: '500',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityGlyph: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
    minWidth: 0,
  },
  activityLabel: {
    ...typography.compact,
    fontWeight: '600',
  },
  activityWhen: {
    ...typography.label,
    fontWeight: '500',
    marginTop: 2,
  },
  activityAmount: {
    ...typography.compact,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  footerNote: {
    ...typography.caption,
    fontWeight: '500',
    paddingHorizontal: screenContentGutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
});
