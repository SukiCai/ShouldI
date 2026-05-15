/**
 * Shared reel poll chrome — used by Explore pager and Discuss expansion.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ReelCardLiquidBackdrop } from '@/components/explore/ReelCardLiquidBackdrop';
import { palette, typography } from '@/constants/theme';

import type { ExploreFeedResponse } from '@shouldi/contracts';

export type ReelDiscussCategory = ExploreFeedResponse['cards'][number]['category'];

const REEL_STAR_GRADIENT = ['#fff6e8', '#ffe1b8', '#fecf7a'] as const;
const REEL_BELL_GRADIENT = ['#7aa2ff', '#4d74f7', '#2d53e6'] as const;
/** Soft gold chip — bounty / participation reward pool. */
const REWARD_CHIP_GRADIENT = ['#fffefb', '#fff3d8', '#ffe8b8'] as const;

export function RewardPointsGem({ rewardPoints }: { rewardPoints?: number | null | undefined }) {
  const pts = typeof rewardPoints === 'number' ? rewardPoints : NaN;
  if (!Number.isFinite(pts) || pts <= 0) return null;
  const a11y = `本题奖励积分 ${pts}，参与讨论或贡献优质观点可获得`;
  return (
    <View accessibilityRole="text" accessibilityLabel={a11y}>
      <LinearGradient
        colors={[...REWARD_CHIP_GRADIENT]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={reelDiscussStyles.rewardPointsChip}>
        <Ionicons name="sparkles" size={14} color="#b45309" />
        <Text style={reelDiscussStyles.rewardPointsChipText}>{pts} 积分</Text>
      </LinearGradient>
    </View>
  );
}

export function formatCategoryLabel(category: ReelDiscussCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function compactVoteCount(n: number): string {
  try {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return n.toLocaleString();
  }
}

export function totalVotesFromDistribution(
  rows: readonly { votes: number }[],
): number {
  return rows.reduce((s, x) => s + x.votes, 0);
}

export function ReelCardAtmosphereLayers({ category }: Readonly<{ category: ReelDiscussCategory }>) {
  return (
    <>
      <ReelCardLiquidBackdrop category={category} />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', '#ffffff']}
        locations={[0.42, 0.72, 1]}
        start={{ x: 0.5, y: 0.08 }}
        end={{ x: 0.5, y: 1 }}
        style={reelDiscussStyles.reelCardAmbient}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(248,250,252,0)', 'rgba(15,23,42,0.04)']}
        locations={[0.55, 1]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 0.5, y: 1 }}
        style={reelDiscussStyles.reelCardAmbient}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.42, y: 0 }}
        end={{ x: 0.58, y: 0.42 }}
        style={reelDiscussStyles.reelCardRim}
      />
    </>
  );
}

export function ReelCardSurface({
  category,
  isOpen,
  children,
  layout = 'card',
  suppressAtmosphere = false,
}: {
  category: ReelDiscussCategory;
  isOpen: boolean;
  children: React.ReactNode;
  layout?: 'card' | 'fullscreen';
  suppressAtmosphere?: boolean;
}) {
  const innerPad =
    layout === 'fullscreen'
      ? [reelDiscussStyles.reelCardInnerFullscreen, isOpen && reelDiscussStyles.reelCardInnerOpen]
      : [reelDiscussStyles.reelCardInner, isOpen && reelDiscussStyles.reelCardInnerOpen];

  if (layout === 'fullscreen' && suppressAtmosphere) {
    return <View style={innerPad}>{children}</View>;
  }

  const outerStyle =
    layout === 'fullscreen' ? [reelDiscussStyles.reelCardOuter, reelDiscussStyles.reelCardOuterFullscreen] : reelDiscussStyles.reelCardOuter;
  return (
    <View style={outerStyle}>
      {!suppressAtmosphere ? <ReelCardAtmosphereLayers category={category} /> : null}
      <View style={innerPad}>{children}</View>
    </View>
  );
}

export function ReelCardActionBar({
  category,
  rewardPoints,
  saved,
  following,
  onToggleSave,
  onToggleFollow,
  /** When set, shows a frosted back control instead of the category chip (Discuss screen). */
  onLeadingBackPress,
}: {
  category: ReelDiscussCategory;
  rewardPoints?: number | null | undefined;
  saved: boolean;
  following: boolean;
  onToggleSave: () => void;
  onToggleFollow: () => void;
  onLeadingBackPress?: () => void;
}) {
  const saveLabel = saved ? 'Saved — tap to remove from saved' : 'Save this dilemma';
  const followLabel = following ? 'Following — tap to stop update alerts' : 'Follow for updates';
  const hasRewardPoints =
    typeof rewardPoints === 'number' && Number.isFinite(rewardPoints) && rewardPoints > 0;

  return (
    <View style={reelDiscussStyles.cardTopRow}>
      {onLeadingBackPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() => {
            if (Platform.OS !== 'web') {
              void Haptics.selectionAsync().catch(() => undefined);
            }
            onLeadingBackPress();
          }}
          style={({ pressed }) => [
            reelDiscussStyles.toolbarBackGem,
            pressed && reelDiscussStyles.toolbarIconHitPressed,
          ]}>
          <Ionicons name="chevron-back" size={22} color={palette.slate900} />
        </Pressable>
      ) : hasRewardPoints ? (
        /** 信息流左侧：悬赏积分替换原「分类」圆角标签 */
        <View style={reelDiscussStyles.categoryChipSlot}>
          <RewardPointsGem rewardPoints={rewardPoints} />
        </View>
      ) : (
        <View style={reelDiscussStyles.categoryChip}>
          <Text style={reelDiscussStyles.categoryChipText}>{formatCategoryLabel(category)}</Text>
        </View>
      )}
      <View style={reelDiscussStyles.cardActionBarTrailing}>
        {onLeadingBackPress ? <RewardPointsGem rewardPoints={rewardPoints} /> : null}
        <View style={reelDiscussStyles.cardIconGroup}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saveLabel}
          hitSlop={8}
          onPress={() => {
            if (Platform.OS !== 'web') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            }
            onToggleSave();
          }}
          style={({ pressed }) => [
            reelDiscussStyles.toolbarIconHit,
            saved && reelDiscussStyles.toolbarIconHitActiveGlowSave,
            pressed && reelDiscussStyles.toolbarIconHitPressed,
          ]}>
          {saved ? (
            <LinearGradient
              colors={[...REEL_STAR_GRADIENT]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.95, y: 1 }}
              style={[
                reelDiscussStyles.toolbarIconGem,
                Platform.OS === 'android' ? reelDiscussStyles.toolbarIconGemRaisedAndroid : null,
              ]}>
              <Ionicons name="star" size={19} color="#734210" />
            </LinearGradient>
          ) : (
            <View style={[reelDiscussStyles.toolbarIconGem, reelDiscussStyles.toolbarIconFrost]}>
              <Ionicons name="star-outline" size={20} color={palette.slate500} />
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={followLabel}
          hitSlop={8}
          onPress={() => {
            if (Platform.OS !== 'web') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            }
            onToggleFollow();
          }}
          style={({ pressed }) => [
            reelDiscussStyles.toolbarIconHit,
            following && reelDiscussStyles.toolbarIconHitActiveGlowBell,
            pressed && reelDiscussStyles.toolbarIconHitPressed,
          ]}>
          {following ? (
            <LinearGradient
              colors={[...REEL_BELL_GRADIENT]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={[
                reelDiscussStyles.toolbarIconGem,
                Platform.OS === 'android' ? reelDiscussStyles.toolbarIconGemRaisedAndroid : null,
              ]}>
              <Ionicons name="notifications" size={18} color={palette.white} />
            </LinearGradient>
          ) : (
            <View style={[reelDiscussStyles.toolbarIconGem, reelDiscussStyles.toolbarIconFrost]}>
              <Ionicons name="notifications-outline" size={19} color={palette.slate500} />
            </View>
          )}
        </Pressable>
        </View>
      </View>
    </View>
  );
}

function LivePulseDot() {
  const pulse = React.useRef(new Animated.Value(0.35)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 820,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 820,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        reelDiscussStyles.livePulseDot,
        {
          opacity: pulse,
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0.35, 1],
                outputRange: [0.94, 1.12],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export function LiveVotesPill({
  voteTotal,
  isLivePoll,
  inline,
}: {
  voteTotal: number;
  isLivePoll: boolean;
  inline?: boolean;
}) {
  return (
    <View
      style={[reelDiscussStyles.headerVotePill, inline && reelDiscussStyles.headerVotePillInline]}
      accessibilityRole="text"
      accessibilityLabel={`${voteTotal.toLocaleString()} ${isLivePoll ? 'live votes' : 'total votes'}`}>
      {isLivePoll ? <LivePulseDot /> : null}
      <View style={[reelDiscussStyles.headerVoteTextStack, inline && reelDiscussStyles.headerVoteTextStackInline]}>
        <Text style={[reelDiscussStyles.headerVoteStrong, inline && reelDiscussStyles.headerVoteStrongInline]}>
          {compactVoteCount(voteTotal)}
        </Text>
        <Text style={[reelDiscussStyles.headerVoteMicro, inline && reelDiscussStyles.headerVoteMicroInline]}>
          {isLivePoll ? 'Live · voted' : 'Total votes'}
        </Text>
      </View>
    </View>
  );
}

export function InlineDistributionTrack({ percentage }: { percentage: number }) {
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [progress, percentage]);

  const animatedWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.max(percentage, 0)}%`],
  });

  return (
    <View style={reelDiscussStyles.inlineTrack}>
      <Animated.View style={[reelDiscussStyles.inlineFill, { width: animatedWidth }]} />
    </View>
  );
}

/** Poll row styles mirrored from Explore — use as `style={[reelDiscussStyles.optionPill, …]}` */
export const reelDiscussStyles = StyleSheet.create({
  reelCardOuter: {
    flexDirection: 'column',
    borderRadius: 28,
    borderWidth: Platform.OS === 'ios' ? 1 : StyleSheet.hairlineWidth,
    borderColor: 'rgba(248,250,252,0.92)',
    backgroundColor: 'rgba(248,250,252,0.94)',
    overflow: 'hidden',
    shadowColor: '#1e293b',
    shadowOpacity: Platform.OS === 'ios' ? 0.16 : 0.2,
    shadowRadius: Platform.OS === 'ios' ? 34 : 24,
    shadowOffset: { width: 0, height: Platform.OS === 'ios' ? 16 : 10 },
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  reelCardOuterFullscreen: {
    alignSelf: 'stretch',
    borderRadius: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  reelCardAmbient: {
    ...StyleSheet.absoluteFillObject,
  },
  reelCardRim: {
    ...StyleSheet.absoluteFillObject,
    opacity: Platform.OS === 'android' ? 0.92 : 1,
  },
  reelCardInner: {
    flexDirection: 'column',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 15,
    gap: 14,
    position: 'relative',
    zIndex: 1,
  },
  reelCardInnerOpen: {
    gap: 11,
  },
  /** Edge-to-edge body (Discuss) — same layering as reel card, tighter insets */
  reelCardInnerFullscreen: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
    position: 'relative',
    zIndex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
    minHeight: 40,
    paddingHorizontal: 0,
  },
  categoryChipSlot: {
    alignSelf: 'center',
    maxWidth: '58%',
    flexShrink: 1,
  },
  categoryChip: {
    alignSelf: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
    maxWidth: '58%',
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
      default: {},
    }),
  },
  categoryChipText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0.25,
    color: palette.slate800,
    textTransform: 'capitalize',
  },
  cardActionBarTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  cardIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  rewardPointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(180,106,26,0.18)',
    flexShrink: 0,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#92400e',
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      default: {},
    }),
  },
  rewardPointsChipText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.06,
    color: '#78350f',
    fontVariant: ['tabular-nums'],
  },
  toolbarIconHit: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarIconHitPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.95 }],
  },
  toolbarIconHitActiveGlowSave: Platform.select({
    ios: {
      shadowColor: '#d9a046',
      shadowOpacity: 0.35,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
    },
    default: {},
  }),
  toolbarIconHitActiveGlowBell: Platform.select({
    ios: {
      shadowColor: palette.accent,
      shadowOpacity: 0.4,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    default: {},
  }),
  toolbarIconGem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toolbarIconGemRaisedAndroid: {
    elevation: 3,
  },
  toolbarIconFrost: {
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.07)',
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.035,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  /** Same frosted affordance as toolbar icons; aligns with save/bell row height. */
  toolbarBackGem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.07)',
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.035,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  headerVotePill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.07)',
    shadowColor: '#0b1224',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerVotePillInline: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 84,
    maxWidth: 124,
    gap: 5,
    marginTop: Platform.OS === 'ios' ? 8 : 6,
  },
  headerVoteTextStack: {
    alignItems: 'center',
  },
  headerVoteTextStackInline: {
    alignItems: 'center',
    minWidth: 0,
  },
  headerVoteStrong: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    color: palette.slate950,
    letterSpacing: -0.35,
  },
  headerVoteMicro: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: palette.slate500,
    letterSpacing: 0.15,
  },
  headerVoteStrongInline: {
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: -0.35,
  },
  headerVoteMicroInline: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.08,
    textAlign: 'center',
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: palette.mint,
  },
  pollQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 2,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15,23,42,0.06)',
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  pollQuestion: {
    color: palette.slate950,
    marginTop: 0,
  },
  pollQuestionOpen: {
    marginTop: 0,
    marginBottom: 0,
  },
  pollHeroOpen: {
    fontWeight: '600',
    letterSpacing: -0.52,
    lineHeight: 33,
  },
  pollQuestionFlexible: {
    flex: 1,
    minWidth: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  optionWrap: {
    gap: 10,
  },
  optionPill: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 15,
    paddingVertical: 14,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    shadowColor: '#334e73',
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: Platform.OS === 'android' ? 1 : 0,
  },
  optionPillActive: {
    borderColor: 'rgba(79,118,194,0.42)',
    backgroundColor: 'rgba(255,255,255,0.93)',
  },
  optionPillAiLean: {
    borderColor: 'rgba(69,134,255,0.5)',
    backgroundColor: 'rgba(233,239,255,0.92)',
    borderWidth: 1,
  },
  optionPillDisabled: {
    opacity: 0.92,
  },
  optionPillPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.992 }],
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionMetaCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  aiLeanBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(79,118,194,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,118,194,0.18)',
  },
  aiLeanBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.45,
    color: palette.accent,
  },
  optionText: {
    ...typography.compact,
    color: palette.slate900,
    flex: 1,
    marginRight: 10,
  },
  optionTextActive: {
    color: palette.accent,
    fontWeight: '600',
  },
  optionMeta: {
    ...typography.caption,
    color: palette.slate500,
    fontWeight: '700',
  },
  optionMetaPicked: {
    color: palette.accent,
    fontWeight: '600',
  },
  inlineTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.slate200,
    overflow: 'hidden',
    width: '100%',
  },
  inlineFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.heroInk,
  },
});
