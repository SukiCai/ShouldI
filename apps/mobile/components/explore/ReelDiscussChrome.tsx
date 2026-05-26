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

import {
  REEL_CROSS_WASH_LIGHT,
  REEL_EDGE_GLOSS,
  REEL_PANEL_DIAGONAL,
} from '@/constants/reelSurfaceGradients';
import {
  palette,
  profileLight,
  profileNeutralStroke,
  profileTypography,
  typography,
} from '@/constants/theme';

import type { ExploreFeedResponse } from '@shouldi/contracts';

export type ReelDiscussCategory = ExploreFeedResponse['cards'][number]['category'];

/** Saved reel — ivory + blush tint (reads with Profile type scale). */
const REEL_STAR_GRADIENT = ['#fffefb', `#fef6e8`, `${profileLight.pink}3a`] as const;
/** Alerts — sky → mint (matches Decide wallet CTA pairing). */
const REEL_BELL_GRADIENT = [profileLight.sky, `${profileLight.mint}f2`, '#1fb5a8'] as const;
/** Bounty chip — apricot/peach beside Profile oranges. */
const REWARD_CHIP_GRADIENT = ['#fffefb', `#ffefd9`, `#fdd19a`] as const;

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
        <Ionicons name="sparkles" size={14} color={profileLight.sky} />
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
  const base = REEL_PANEL_DIAGONAL[category];

  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[...base]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={reelDiscussStyles.reelCardAmbient}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[...REEL_CROSS_WASH_LIGHT]}
        locations={[0, 0.44, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={reelDiscussStyles.reelCardAmbient}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[...REEL_EDGE_GLOSS]}
        locations={[0, 0.22, 0.52]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.62 }}
        style={reelDiscussStyles.reelCardAmbient}
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
          <Ionicons name="chevron-back" size={22} color={profileTypography.body} />
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
              <Ionicons name="star" size={19} color={profileTypography.emphasis} />
            </LinearGradient>
          ) : (
            <View style={[reelDiscussStyles.toolbarIconGem, reelDiscussStyles.toolbarIconFrost]}>
              <Ionicons name="star-outline" size={20} color={profileTypography.subdued} />
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
              start={{ x: 0.05, y: 0 }}
              end={{ x: 0.95, y: 1 }}
              style={[
                reelDiscussStyles.toolbarIconGem,
                Platform.OS === 'android' ? reelDiscussStyles.toolbarIconGemRaisedAndroid : null,
              ]}>
              <Ionicons name="notifications" size={18} color={palette.heroInk} />
            </LinearGradient>
          ) : (
            <View style={[reelDiscussStyles.toolbarIconGem, reelDiscussStyles.toolbarIconFrost]}>
              <Ionicons name="notifications-outline" size={19} color={profileTypography.subdued} />
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

export type PollBarEmphasis = 'neutral' | 'user' | 'ai';

export function InlineDistributionTrack({
  percentage,
  emphasis = 'neutral',
}: {
  percentage: number;
  emphasis?: PollBarEmphasis;
}) {
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

  const fillStyle =
    emphasis === 'user'
      ? reelDiscussStyles.inlineFillUser
      : emphasis === 'ai'
        ? reelDiscussStyles.inlineFillAi
        : reelDiscussStyles.inlineFillNeutral;

  return (
    <View style={reelDiscussStyles.inlineTrack}>
      <Animated.View style={[fillStyle, { width: animatedWidth }]} />
    </View>
  );
}

/** Poll row styles mirrored from Explore — use as `style={[reelDiscussStyles.optionPill, …]}` */
export const reelDiscussStyles = StyleSheet.create({
  reelCardOuter: {
    flexDirection: 'column',
    borderRadius: 28,
    borderWidth: Platform.OS === 'ios' ? 1 : StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.08),
    backgroundColor: 'rgba(253,253,253,0.35)',
    overflow: 'hidden',
    shadowColor: '#374151',
    shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0.14,
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
    paddingHorizontal: 18,
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
    borderColor: profileNeutralStroke(0.06),
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
    color: profileTypography.emphasis,
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
    borderColor: profileNeutralStroke(0.14),
    flexShrink: 0,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#57534e',
        shadowOpacity: 0.06,
        shadowRadius: 8,
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
    color: profileTypography.emphasis,
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
      shadowColor: profileLight.sky,
      shadowOpacity: 0.32,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
    },
    default: {},
  }),
  toolbarIconHitActiveGlowBell: Platform.select({
    ios: {
      shadowColor: profileLight.mint,
      shadowOpacity: 0.36,
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
    borderColor: profileNeutralStroke(0.07),
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
    borderColor: profileNeutralStroke(0.07),
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
    borderColor: profileNeutralStroke(0.07),
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
    color: profileTypography.ink,
    letterSpacing: -0.35,
  },
  headerVoteMicro: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: profileTypography.subdued,
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
    backgroundColor: profileLight.sky,
  },
  pollQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 2,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  /** Title + hairline only under the question — not full width under the vote pill */
  pollQuestionTextCol: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 12,
  },
  pollQuestionUnderline: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: profileNeutralStroke(0.06),
    marginTop: 8,
  },
  pollQuestion: {
    color: profileTypography.ink,
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
  optionWrap: {
    gap: 10,
  },
  optionPill: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: profileNeutralStroke(0.06),
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 15,
    paddingVertical: 14,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    shadowColor: profileNeutralStroke(0.25),
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: Platform.OS === 'android' ? 1 : 0,
  },
  /** Cobalt rim — unmistakably “your vote” vs mint assistant cues */
  optionPillUserPick: {
    borderWidth: 2,
    borderColor: `${palette.accent}7a`,
    backgroundColor: `${palette.accent}12`,
    ...Platform.select({
      ios: {
        shadowColor: palette.accent,
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
      },
      default: {},
    }),
  },
  /** Assistant-lean row when it is not yours — ink/black frame (editorial, vs cobalt “you”) */
  optionPillAiLeanOnly: {
    borderWidth: 2,
    borderColor: 'rgba(13,13,17,0.82)',
    backgroundColor: 'rgba(13,13,17,0.055)',
    ...Platform.select({
      ios: {
        shadowColor: palette.heroInk,
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
      },
      default: {},
    }),
  },
  /** User pick === AI suggestion — dual edge: you = cobalt, assistant = ink */
  optionPillUserAndAiPick: {
    borderWidth: 1,
    borderColor: profileNeutralStroke(0.1),
    backgroundColor: 'rgba(246,251,251,0.96)',
    borderLeftWidth: 5,
    borderLeftColor: palette.accent,
    borderRightWidth: 5,
    borderRightColor: palette.heroInk,
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
    backgroundColor: palette.heroInk,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  aiLeanBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: palette.white,
  },
  userPickBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: `${palette.accent}18`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.accent}42`,
  },
  userPickBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.45,
    color: palette.accent,
  },
  optionText: {
    ...typography.compact,
    color: profileTypography.body,
    flex: 1,
    marginRight: 10,
  },
  optionTextActive: {
    color: '#2e4d8f',
    fontWeight: '700',
  },
  optionMeta: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '700',
  },
  optionMetaPicked: {
    color: palette.accent,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  inlineTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: profileNeutralStroke(0.06),
    overflow: 'hidden',
    width: '100%',
  },
  inlineFillNeutral: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(91,91,91,0.28)',
  },
  inlineFillUser: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  inlineFillAi: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.heroInk,
  },
});
