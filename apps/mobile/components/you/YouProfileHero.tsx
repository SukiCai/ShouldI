import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { ImageSourcePropType } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import {
  PROFILE_HERO_GRADIENT_DARK,
  PROFILE_HERO_GRADIENT_LIGHT,
  radius,
  semantic,
  typography,
} from '@/constants/theme';
import { usePrefersReducedMotion } from '@/constants/motion';
import { COUNCIL_SESSION_POINTS_COST } from '@/lib/useViewerEntitlements';

import { ProfileAvatar } from './ProfileAvatar';
import { ProfileSpringPress } from './profileMotion';
import { youScreenStyles as styles } from './youScreenStyles';

type YouProfileHeroProps = {
  displayName: string;
  avatarEmoji: string;
  avatarSource?: ImageSourcePropType;
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
  avatarEmoji,
  avatarSource,
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
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const reducedMotion = usePrefersReducedMotion();
  const wallet = walletHydrated ? walletFooterCopy(isPremium, pointsBalance) : null;

  const avatarEntering = reducedMotion ? undefined : FadeIn.duration(420).springify().damping(20);

  return (
    <View
      style={[
        styles.insightFeedCard,
        styles.insightCardShell,
        heroStyles.cardShell,
        { backgroundColor: groupedSurface, borderColor: groupedBorder },
      ]}>
      <LinearGradient
        colors={isDark ? [...PROFILE_HERO_GRADIENT_DARK] : [...PROFILE_HERO_GRADIENT_LIGHT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={heroStyles.identityBlock}>
        <Animated.View entering={avatarEntering}>
          <ProfileAvatar
            emoji={avatarEmoji}
            imageSource={avatarSource}
            borderColor={groupedBorder}
            surfaceColor={groupedSurface}
          />
        </Animated.View>
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
        <ProfileSpringPress
          accessibilityRole="button"
          accessibilityLabel={`Open wallet and membership, ${wallet.balanceLabel}`}
          haptic="selection"
          onPress={() => router.push('/wallet')}
          style={[
            heroStyles.walletFooter,
            !showOnboardingCta && heroStyles.walletFooterFlush,
            { borderTopColor: hairline, borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero },
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
        </ProfileSpringPress>
      ) : null}

      {showOnboardingCta ? (
        <ProfileSpringPress
          accessibilityRole="button"
          accessibilityLabel="Start your first decision"
          haptic="light"
          onPress={() => router.replace('/(tabs)/decide')}
          style={[
            styles.focusPrimaryBtn,
            heroStyles.onboardingBtn,
            { backgroundColor: semantic.actionPrimary },
          ]}>
          <Text style={styles.focusPrimaryBtnText}>Start your first decision</Text>
        </ProfileSpringPress>
      ) : null}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  cardShell: {
    overflow: 'hidden',
  },
  identityBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginHorizontal: -14,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
    gap: 4,
  },
  walletFooterFlush: {
    marginBottom: -14,
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
