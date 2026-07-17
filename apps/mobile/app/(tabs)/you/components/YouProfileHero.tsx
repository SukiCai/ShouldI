import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { semantic, typography } from '@/constants/theme';
import { COUNCIL_SESSION_POINTS_COST } from '@/lib/useViewerEntitlements';

import { youScreenStyles as styles } from './youScreenStyles';

const MOCK_AVATAR = require('@/assets/images/profile-mock-avatar.jpg');

type YouProfileHeroProps = {
  displayName: string;
  isPremium: boolean;
  pointsBalance: number;
  walletHydrated: boolean;
  decisionsCount: number;
  memberSinceLabel: string;
  showOnboardingCta: boolean;
  textDisplay: string;
  textPrimary: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  hairline: string;
};

function walletFooterCopy(isPremium: boolean, balance: number): {
  balanceLabel: string;
  hint: string | null;
} {
  const balanceLabel = `${balance.toLocaleString()} pts`;
  if (isPremium || balance >= COUNCIL_SESSION_POINTS_COST) {
    return { balanceLabel, hint: null };
  }
  return {
    balanceLabel,
    hint: `Council costs ${COUNCIL_SESSION_POINTS_COST} pts per session`,
  };
}

export function YouProfileHero({
  displayName,
  isPremium,
  pointsBalance,
  walletHydrated,
  decisionsCount,
  memberSinceLabel,
  showOnboardingCta,
  textDisplay,
  textPrimary,
  textMuted,
  groupedSurface,
  groupedBorder,
  hairline,
}: YouProfileHeroProps) {
  const wallet = walletHydrated ? walletFooterCopy(isPremium, pointsBalance) : null;

  return (
    <View
      style={[
        styles.insightFeedCard,
        styles.insightCardShell,
        { backgroundColor: groupedSurface, borderColor: groupedBorder },
      ]}>
      <View style={heroStyles.identityBlock}>
        <Image source={MOCK_AVATAR} style={heroStyles.avatar} />
        <View style={styles.identityCopy}>
          <View style={styles.identityNameRow}>
            <Text style={[styles.identityName, { color: textDisplay }]} numberOfLines={1}>
              {displayName}
            </Text>
            {isPremium ? (
              <View
                style={[
                  styles.premiumPill,
                  { backgroundColor: `${semantic.actionPrimary}14` },
                ]}>
                <Ionicons name="star" size={10} color={semantic.actionPrimary} />
                <Text style={[styles.premiumPillText, { color: semantic.actionPrimary }]}>Premium</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.identityMeta, { color: textMuted }]} numberOfLines={1}>
            {decisionsCount > 0
              ? `${decisionsCount} decision${decisionsCount === 1 ? '' : 's'} made · ${memberSinceLabel}`
              : memberSinceLabel}
          </Text>
        </View>
      </View>

      {wallet ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open wallet and membership, ${wallet.balanceLabel}`}
          onPress={() => router.push('/wallet')}
          style={({ pressed }) => [
            heroStyles.walletFooter,
            { borderTopColor: hairline },
            pressed && { backgroundColor: `${textPrimary}06` },
          ]}>
          <View style={heroStyles.walletRow}>
            <Text style={[heroStyles.walletLabel, { color: textPrimary }]} numberOfLines={1}>
              Wallet & membership
            </Text>
            <View style={heroStyles.walletTrailing}>
              <Text style={[heroStyles.walletValue, { color: textDisplay }]} numberOfLines={1}>
                {wallet.balanceLabel}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={textMuted} />
            </View>
          </View>
          {wallet.hint ? (
            <Text style={[styles.postFoot, heroStyles.walletHint, { color: textMuted }]} numberOfLines={1}>
              {wallet.hint}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      {showOnboardingCta ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start your first decision"
          onPress={() => router.replace('/(tabs)/decide')}
          style={({ pressed }) => [
            styles.focusPrimaryBtn,
            heroStyles.onboardingBtn,
            { backgroundColor: semantic.actionPrimary },
            pressed && { opacity: 0.92 },
          ]}>
          <Text style={styles.focusPrimaryBtnText}>Start your first decision</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  identityBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  walletFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginHorizontal: -14,
    marginBottom: -14,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    gap: 4,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 22,
  },
  walletLabel: {
    ...typography.compact,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  walletTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  walletValue: {
    ...typography.compact,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  walletHint: {
    textAlign: 'right',
  },
  onboardingBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 12,
  },
});
