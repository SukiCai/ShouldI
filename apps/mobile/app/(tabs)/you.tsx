import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as React from 'react';
import {
  Alert,
  FlatList,
  Image,
  ListRenderItem,
  Platform,
  Pressable,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { Card, EmptyState, Screen } from '@/components/ui';
import { MOTION, usePrefersReducedMotion } from '@/constants/motion';
import { resolveYouChromatics } from '@/constants/appChromatics';
import {
  elevation,
  palette,
  PROFILE_HERO_GRADIENT_DARK,
  PROFILE_HERO_GRADIENT_LIGHT,
  profileLight,
  profileNeutralStroke,
  radius,
  screenContentGutter,
  spacing,
  themeSurface,
} from '@/constants/theme';
import { useViewerEntitlements } from '@/lib/useViewerEntitlements';

import { ProfileStatSheet, type DemoPerson, type LikesBreakdownRow, type SocialStatKey } from './you/components/ProfileStatSheet';
import { WalletHistorySheet } from './you/components/WalletHistorySheet';

const AVATAR = require('@/constants/users/user-char-01.png');
const AVATAR_SIZE = 72;

function ProfileAvatar({
  surface,
  reducedMotion,
}: {
  surface: ReturnType<typeof themeSurface>;
  reducedMotion: boolean;
}) {
  const press = useSharedValue(1);
  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <Pressable
      accessibilityRole="image"
      accessibilityLabel="Profile photo"
      onPressIn={() => {
        if (reducedMotion) return;
        press.value = withSpring(0.96, MOTION.tab);
      }}
      onPressOut={() => {
        if (reducedMotion) return;
        press.value = withSpring(1, MOTION.tab);
      }}
      onPress={() => {
        if (Platform.OS !== 'web') {
          void Haptics.selectionAsync().catch(() => undefined);
        }
      }}>
      <Animated.View style={shellStyle}>
        <LinearGradient
          colors={[`${palette.neonMint}`, `${palette.neonSky}`, `${palette.neonPink}`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}>
          <View style={[styles.avatarCutout, { backgroundColor: surface.canvas }]}>
            <Image
              source={AVATAR}
              style={styles.avatarImg}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

/** Demo social metrics until profile API exists */
const DEMO_STATS = {
  followers: 128,
  /** Accounts this user follows */
  following: 64,
  /** Likes received on their activity */
  likesReceived: 942,
  /** Subset credited when others validate your threads, boosts, referrals, etc. (demo split). */
  pointsFromOthers: 620,
} as const;

const DEMO_FOLLOWERS: DemoPerson[] = [
  { id: 'f1', name: 'Alex Chen', handle: '@alexc', subtitle: 'Followed after your remote job thread' },
  { id: 'f2', name: 'Maya Ortiz', handle: '@maya', subtitle: 'Followed 3 days ago' },
  { id: 'f3', name: 'Sam Rivera', handle: '@samr', subtitle: 'Followed last week' },
  { id: 'f4', name: 'Priya Nair', handle: '@priya', subtitle: 'Followed 2 weeks ago' },
  { id: 'f5', name: 'Jordan Lee', handle: '@jlee', subtitle: 'Followed after your lease thread' },
];

const DEMO_FOLLOWING: DemoPerson[] = [
  { id: 'o1', name: 'Nina Patel', handle: '@ninap', subtitle: 'Posts career pivot threads' },
  { id: 'o2', name: 'Chris Wu', handle: '@chrisw', subtitle: 'Housing and money decisions' },
  { id: 'o3', name: 'Elena Rossi', handle: '@elenar', subtitle: 'Relationship and travel votes' },
  { id: 'o4', name: 'Devon Hayes', handle: '@devon', subtitle: 'Remote work debates' },
];

const DEMO_LIKES_BREAKDOWN: LikesBreakdownRow[] = [
  { id: 'l1', label: 'Validations on your threads', count: 412 },
  { id: 'l2', label: 'Boosts from others', count: 318 },
  { id: 'l3', label: 'Votes on your decisions', count: 212 },
];

type ProfileSheet = 'wallet' | SocialStatKey | null;

type DecisionPreview = {
  id: string;
  question: string;
  status: 'open' | 'resolved';
  hint: string;
  accent: 'mint' | 'sky' | 'pink';
};

const YOUR_DECISIONS: DecisionPreview[] = [
  {
    id: 'life-remote-01',
    question: 'Take the fully remote offer or stay hybrid?',
    status: 'open',
    hint: '128 votes · 2d',
    accent: 'mint',
  },
  {
    id: 'money-apartment-02',
    question: 'Lock this lease or wait for spring listings?',
    status: 'open',
    hint: '86 votes · 5d',
    accent: 'sky',
  },
  {
    id: 'relationship-trip-03',
    question: 'Solo trip vs. group holiday this summer?',
    status: 'resolved',
    hint: 'Closed · takeaway',
    accent: 'pink',
  },
];

const FOLLOWING: DecisionPreview[] = [
  {
    id: 'follow-1',
    question: 'Pivot to product design mid-career?',
    status: 'open',
    hint: '402 votes',
    accent: 'mint',
  },
  {
    id: 'follow-2',
    question: 'Pay extra for the quiet floor?',
    status: 'open',
    hint: '91 votes',
    accent: 'sky',
  },
];

const STARRED: DecisionPreview[] = [
  {
    id: 'star-1',
    question: 'Tell them how you feel this week?',
    status: 'open',
    hint: 'Starred Sat',
    accent: 'pink',
  },
];

const ACCENT = {
  mint: [palette.neonMint, `${palette.neonMint}33`] as const,
  sky: [palette.neonSky, `${palette.neonSky}33`] as const,
  pink: [palette.neonPink, `${palette.neonPink}33`] as const,
};

/** Grid rail tints in light mode — same triad feel as `ACCENT`, readable on white. */
const CARD_ACCENT_LIGHT: Record<DecisionPreview['accent'], string> = {
  mint: '#14b8a6',
  sky: profileLight.sky,
  pink: profileLight.pink,
};

type TabKey = 'yours' | 'orbit' | 'saved';

const TABS: {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  getData: () => DecisionPreview[];
}[] = [
  { key: 'yours', label: 'Mine', icon: 'grid-outline', getData: () => YOUR_DECISIONS },
  { key: 'orbit', label: 'Following', icon: 'people-outline', getData: () => FOLLOWING },
  { key: 'saved', label: 'Saved', icon: 'star-outline', getData: () => STARRED },
];

const GRID_GAP = 12;
const GRID_CARD_HEIGHT = 120;
const STAGGER_MS = 42;
const THEME_FADE_MS = 240;

/** Compact “on-air” cue — dot opacity only, no halo glow */
function LivePulsePill({ surface, isDark }: { surface: ReturnType<typeof themeSurface>; isDark: boolean }) {
  const pulse = useSharedValue(1);
  const chrom = resolveYouChromatics(isDark, surface);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.28, { duration: 950, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * pulse.value,
  }));

  return (
    <View style={[styles.livePill, { borderColor: chrom.liveBorder, backgroundColor: chrom.liveBg }]}>
      <Animated.View style={[styles.liveDot, { backgroundColor: chrom.liveDot }, dotStyle]} />
      <Text style={[styles.livePillText, { color: chrom.liveText }]}>live</Text>
    </View>
  );
}

type ProfileTabStripProps = {
  activeTab: TabKey;
  onSelect: (key: TabKey) => void;
  isDark: boolean;
  surface: ReturnType<typeof themeSurface>;
};

function ProfileSegmentedTabs({ activeTab, onSelect, isDark, surface }: ProfileTabStripProps) {
  const chrom = resolveYouChromatics(isDark, surface);
  const reducedMotion = usePrefersReducedMotion();
  const [trackWidth, setTrackWidth] = React.useState(0);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const selectionPop = useSharedValue(1);

  const activeIndex = React.useMemo(
    () => Math.max(0, TABS.findIndex((t) => t.key === activeTab)),
    [activeTab],
  );

  const moveIndicator = React.useCallback(
    (index: number, width: number, animated: boolean) => {
      if (width < 1) return;
      const gap = 6;
      const horizontalPad = 4;
      const inner = width - horizontalPad * 2;
      const seg = (inner - gap * (TABS.length - 1)) / TABS.length;
      const x = horizontalPad + index * (seg + gap);
      indicatorW.value = seg;
      if (animated && !reducedMotion) {
        indicatorX.value = withSpring(x, MOTION.tab);
        selectionPop.value = withSequence(
          withSpring(1.04, { damping: 18, stiffness: 420, mass: 0.34 }),
          withSpring(1, MOTION.tab),
        );
      } else {
        indicatorX.value = x;
        selectionPop.value = 1;
      }
    },
    [indicatorW, indicatorX, reducedMotion, selectionPop],
  );

  React.useEffect(() => {
    moveIndicator(activeIndex, trackWidth, true);
  }, [activeIndex, moveIndicator, trackWidth]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setTrackWidth(w);
    moveIndicator(activeIndex, w, false);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorW.value,
    transform: [{ translateX: indicatorX.value }, { scale: selectionPop.value }],
  }));

  const trackBg = isDark ? 'rgba(255,255,255,0.06)' : palette.field;
  const indicatorColors = isDark
    ? ([`${chrom.tabUnderline}44`, `${palette.neonSky}18`] as const)
    : ([`${profileLight.mint}28`, `${profileLight.sky}16`] as const);

  return (
    <View style={[styles.segmentTrack, { backgroundColor: trackBg }]} onLayout={onTrackLayout}>
      {trackWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentIndicator,
            { borderColor: isDark ? `${chrom.tabUnderline}66` : `${profileLight.mint}44` },
            indicatorStyle,
          ]}>
          <LinearGradient
            colors={indicatorColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      ) : null}

      {TABS.map((t) => {
        const active = activeTab === t.key;
        return (
          <SegmentTabPill
            key={t.key}
            label={t.label}
            icon={t.icon}
            active={active}
            chrom={chrom}
            reducedMotion={reducedMotion}
            onPress={() => onSelect(t.key)}
          />
        );
      })}
    </View>
  );
}

function SegmentTabPill({
  label,
  icon,
  active,
  chrom,
  reducedMotion,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  chrom: ReturnType<typeof resolveYouChromatics>;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const press = useSharedValue(1);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => {
        if (reducedMotion) return;
        press.value = withSpring(MOTION.press.scale, MOTION.tab);
      }}
      onPressOut={() => {
        if (reducedMotion) return;
        press.value = withSpring(1, MOTION.tab);
      }}
      style={styles.segmentHit}>
      <Animated.View style={[styles.segmentPill, shellStyle]}>
        <Ionicons name={icon} size={13} color={active ? chrom.tabActive : chrom.tabInactive} />
        <Text
          numberOfLines={1}
          style={[
            styles.segmentLabel,
            {
              color: active ? chrom.tabActive : chrom.tabInactive,
              fontWeight: active ? '700' : '500',
            },
          ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function InlineMetricsRow({
  stats,
  surface,
  isDark,
  onPressStat,
}: {
  stats: readonly { value: number; label: string; key: SocialStatKey }[];
  surface: ReturnType<typeof themeSurface>;
  isDark: boolean;
  onPressStat: (key: SocialStatKey) => void;
}) {
  const chrom = resolveYouChromatics(isDark, surface);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <View style={styles.metricsRow}>
      {stats.map((s, index) => (
        <React.Fragment key={s.label}>
          {index > 0 ? <View style={[styles.metricsDivider, { backgroundColor: surface.hairline }]} /> : null}
          <MetricHit
            value={s.value}
            label={s.label}
            chrom={chrom}
            reducedMotion={reducedMotion}
            onPress={() => onPressStat(s.key)}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

function MetricHit({
  value,
  label,
  chrom,
  reducedMotion,
  onPress,
}: {
  value: number;
  label: string;
  chrom: ReturnType<typeof resolveYouChromatics>;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const press = useSharedValue(1);
  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
    opacity: interpolate(press.value, [MOTION.press.scale, 1], [0.92, 1]),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value.toLocaleString()} ${label}`}
      onPress={onPress}
      onPressIn={() => {
        if (reducedMotion) return;
        press.value = withSpring(MOTION.press.scale, MOTION.tab);
      }}
      onPressOut={() => {
        if (reducedMotion) return;
        press.value = withSpring(1, MOTION.tab);
      }}
      style={styles.metricHit}>
      <Animated.View style={shellStyle}>
        <Text style={[styles.metricValue, { color: chrom.textPrimary }]}>{value.toLocaleString()}</Text>
        <Text style={[styles.metricLabel, { color: chrom.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Commercial wallet hero — points + membership are primary monetization surfaces. */
function WalletHeroBand({
  pointsBalance,
  isPremium,
  chrom,
  isDark,
  onAddPoints,
  onOpenDetails,
  onUpgradePremium,
}: {
  pointsBalance: number;
  isPremium: boolean;
  chrom: ReturnType<typeof resolveYouChromatics>;
  isDark: boolean;
  onAddPoints: () => void;
  onOpenDetails: () => void;
  onUpgradePremium: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const detailPress = useSharedValue(1);
  const addPress = useSharedValue(1);

  const detailStyle = useAnimatedStyle(() => ({
    transform: [{ scale: detailPress.value }],
    opacity: interpolate(detailPress.value, [MOTION.press.scale, 1], [0.94, 1]),
  }));

  const addStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addPress.value }],
  }));

  const openDetails = () => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onOpenDetails();
  };

  const handleAdd = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    onAddPoints();
  };

  const bandBg = isDark ? 'rgba(61,255,184,0.09)' : `${profileLight.mint}16`;
  const bandBorder = isDark ? `${chrom.mint}28` : `${profileLight.mint}40`;

  return (
    <View style={[styles.walletHeroBand, { backgroundColor: bandBg, borderColor: bandBorder }]}>
      <View style={styles.walletHeroRow}>
        <View style={styles.walletHeroCopy}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${pointsBalance.toLocaleString()} points. Tap for wallet details.`}
            onPress={openDetails}
            onPressIn={() => {
              if (reducedMotion) return;
              detailPress.value = withSpring(MOTION.press.scale, MOTION.tab);
            }}
            onPressOut={() => {
              if (reducedMotion) return;
              detailPress.value = withSpring(1, MOTION.tab);
            }}>
            <Animated.View style={[styles.walletHeroBalanceRow, detailStyle]}>
              <Text
                style={[styles.walletHeroNum, { color: chrom.mint }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {pointsBalance.toLocaleString()}
              </Text>
              <Text style={[styles.walletHeroPts, { color: chrom.textMuted }]}>points</Text>
            </Animated.View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPremium ? 'Premium member benefits' : 'Upgrade to Premium'}
            onPress={isPremium ? openDetails : onUpgradePremium}
            hitSlop={4}>
            <Text
              style={[
                styles.walletMembershipLine,
                { color: isPremium ? chrom.textMuted : chrom.mint },
              ]}
              numberOfLines={1}>
              {isPremium ? 'Premium · unlimited Expert Council' : 'Go Premium · unlimited Council'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add points"
          onPress={handleAdd}
          onPressIn={() => {
            if (reducedMotion) return;
            addPress.value = withSpring(0.94, MOTION.tab);
          }}
          onPressOut={() => {
            if (reducedMotion) return;
            addPress.value = withSpring(1, MOTION.tab);
          }}
          hitSlop={6}>
          <Animated.View style={addStyle}>
            <LinearGradient
              colors={isDark ? [palette.neonMint, palette.neonSky] : [profileLight.mint, profileLight.sky]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.walletAddPill}>
              <Ionicons name="add" size={14} color={palette.white} />
              <Text style={styles.walletAddLabel}>Add</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

function ProfileDecisionCard({
  item,
  surface,
  isDark,
  onOpen,
  listMode,
}: {
  item: DecisionPreview;
  surface: ReturnType<typeof themeSurface>;
  isDark: boolean;
  onOpen: (id: string) => void;
  listMode?: boolean;
}) {
  const chrom = resolveYouChromatics(isDark, surface);
  const accentColor = isDark ? ACCENT[item.accent][0] : CARD_ACCENT_LIGHT[item.accent];
  const open = item.status === 'open';
  const reducedMotion = usePrefersReducedMotion();
  const press = useSharedValue(1);
  const lift = useSharedValue(0);
  const shadowLift = useSharedValue(0);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }, { translateY: lift.value }],
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#0f172a',
          shadowOpacity: interpolate(shadowLift.value, [0, 1], [0.08, 0.18]),
          shadowRadius: interpolate(shadowLift.value, [0, 1], [10, 18]),
          shadowOffset: {
            width: 0,
            height: interpolate(shadowLift.value, [0, 1], [4, 9]),
          },
        }
      : {
          elevation: interpolate(shadowLift.value, [0, 1], [2, 5]),
        }),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.question}
      onPress={() => onOpen(item.id)}
      onPressIn={() => {
        if (reducedMotion) return;
        press.value = withSpring(0.98, MOTION.tab);
        lift.value = withSpring(-2, MOTION.tab);
        shadowLift.value = withSpring(1, MOTION.tab);
      }}
      onPressOut={() => {
        if (reducedMotion) return;
        press.value = withSpring(1, MOTION.tab);
        lift.value = withSpring(0, MOTION.tab);
        shadowLift.value = withSpring(0, MOTION.tab);
      }}>
      <Animated.View style={shellStyle}>
        <Card
          accentColor={accentColor}
          style={{
            borderColor: surface.sheetBorder,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : palette.sheet,
            height: listMode ? undefined : GRID_CARD_HEIGHT,
            minHeight: listMode ? 96 : GRID_CARD_HEIGHT,
          }}>
          <View style={styles.gridCardBody}>
            <View style={styles.gridCardTop}>
              {open ? (
                <LivePulsePill surface={surface} isDark={isDark} />
              ) : (
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : `${profileLight.sky}10`,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: surface.hairline,
                    },
                  ]}>
                  <Text style={[styles.statusPillText, { color: chrom.textMuted }]}>done</Text>
                </View>
              )}
            </View>
            <Text style={[styles.gridTitle, { color: chrom.textPrimary }]} numberOfLines={listMode ? 2 : 3}>
              {item.question}
            </Text>
            <Text style={[styles.gridHint, { color: chrom.textMuted }]} numberOfLines={1}>
              {item.hint}
            </Text>
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

function StaggeredGridCard({
  item,
  index,
  tabKey,
  surface,
  isDark,
  onOpen,
  listMode,
  slideX,
}: {
  item: DecisionPreview;
  index: number;
  tabKey: TabKey;
  surface: ReturnType<typeof themeSurface>;
  isDark: boolean;
  onOpen: (id: string) => void;
  listMode?: boolean;
  slideX: SharedValue<number>;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const enter = useSharedValue(reducedMotion ? 1 : 0);

  React.useEffect(() => {
    if (reducedMotion) {
      enter.value = 1;
      return;
    }
    enter.value = 0;
    enter.value = withDelay(index * STAGGER_MS, withSpring(1, MOTION.tab));
  }, [enter, index, reducedMotion, tabKey]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }, { translateX: slideX.value }],
  }));

  return (
    <Animated.View style={enterStyle}>
      <ProfileDecisionCard item={item} surface={surface} isDark={isDark} onOpen={onOpen} listMode={listMode} />
    </Animated.View>
  );
}

function SettingsGearButton({
  onPress,
  surface,
  isDark,
  iconColor,
  compact,
}: {
  onPress: () => void;
  surface: ReturnType<typeof themeSurface>;
  isDark: boolean;
  iconColor: string;
  compact?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const press = useSharedValue(1);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={12}
      onPress={onPress}
      onPressIn={() => {
        if (reducedMotion) return;
        press.value = withSpring(0.92, MOTION.tab);
      }}
      onPressOut={() => {
        if (reducedMotion) return;
        press.value = withSpring(1, MOTION.tab);
      }}>
      <Animated.View
        style={[
          compact ? styles.gearCompact : styles.gear,
          shellStyle,
          {
            borderColor: surface.hairline,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)',
          },
        ]}>
        <Ionicons name="settings-outline" size={compact ? 16 : 18} color={iconColor} />
      </Animated.View>
    </Pressable>
  );
}

function PremiumBadge({
  isPremium,
  isDark,
  onPress,
  compact,
}: {
  isPremium: boolean;
  isDark: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const pop = useSharedValue(1);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const handlePress = () => {
    if (!reducedMotion) {
      pop.value = withSequence(
        withSpring(0.94, MOTION.tab),
        withSpring(1, { damping: 14, stiffness: 380, mass: 0.34 }),
      );
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPremium ? 'Premium member' : 'Upgrade to Premium'}
      onPress={handlePress}
      hitSlop={8}>
      <Animated.View style={shellStyle}>
        <LinearGradient
          colors={
            isPremium
              ? isDark
                ? [`${palette.neonMint}ee`, `${palette.neonSky}cc`]
                : [`${profileLight.mint}e8`, `${profileLight.sky}c8`]
              : isDark
                ? [`${palette.neonSky}cc`, `${palette.neonMint}aa`]
                : [`${profileLight.sky}d0`, `${profileLight.mint}b8`]
          }
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.proBubble, compact && styles.proBubbleCompact]}>
          <Text style={[styles.proText, compact && styles.proTextCompact]}>
            {isPremium ? 'premium' : 'pro'}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function ThemeFadeOverlay() {
  const scheme = useColorScheme();
  const reducedMotion = usePrefersReducedMotion();
  const fade = useSharedValue(0);
  const prevScheme = React.useRef(scheme);

  React.useEffect(() => {
    if (prevScheme.current === scheme) return;
    if (!reducedMotion) {
      fade.value = 0.38;
      fade.value = withTiming(0, { duration: THEME_FADE_MS, easing: Easing.out(Easing.cubic) });
    }
    prevScheme.current = scheme;
  }, [fade, reducedMotion, scheme]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));

  const wash = scheme === 'dark' ? '#000000' : '#ffffff';

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.themeFade, { backgroundColor: wash }, overlayStyle]}
    />
  );
}

export default function YouScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const surface = React.useMemo(() => themeSurface(scheme), [scheme]);
  const chrom = React.useMemo(() => resolveYouChromatics(isDark, surface), [isDark, surface]);
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = React.useState<TabKey>('yours');
  const [sheet, setSheet] = React.useState<ProfileSheet>(null);
  const activeIndex = React.useMemo(
    () => Math.max(0, TABS.findIndex((t) => t.key === activeTab)),
    [activeTab],
  );
  const prevTabIndex = React.useRef(activeIndex);
  const isListMode = activeTab === 'saved';

  /** Content width inside Screen side padding — single source of truth for columns + grid math. */
  const contentWidth = Math.max(0, windowWidth - screenContentGutter * 2);
  const columnWidth = isListMode ? contentWidth : (contentWidth - GRID_GAP) / 2;

  const openDecision = React.useCallback((id: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    router.push(`/decision/${encodeURIComponent(id)}`);
  }, []);

  const openSettings = () => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    router.push('/settings');
  };

  const selectTab = (key: TabKey) => {
    if (key !== activeTab && Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    setActiveTab(key);
  };

  const reducedMotion = usePrefersReducedMotion();
  const gridOpacity = useSharedValue(1);
  const gridY = useSharedValue(0);
  const gridX = useSharedValue(0);

  const { balance: pointsBalance, isPremium, activatePremium, councilSessionCost, grantDevPoints } =
    useViewerEntitlements();
  const pointsFromOthers = DEMO_STATS.pointsFromOthers;

  React.useEffect(() => {
    if (reducedMotion) {
      gridOpacity.value = 1;
      gridY.value = 0;
      gridX.value = 0;
      prevTabIndex.current = activeIndex;
      return;
    }
    const dir = activeIndex > prevTabIndex.current ? 1 : activeIndex < prevTabIndex.current ? -1 : 0;
    gridOpacity.value = 0.65;
    gridY.value = 8;
    gridX.value = dir * 22;
    gridOpacity.value = withSpring(1, MOTION.tab);
    gridY.value = withSpring(0, MOTION.tab);
    gridX.value = withSpring(0, MOTION.tab);
    prevTabIndex.current = activeIndex;
  }, [activeIndex, gridOpacity, gridX, gridY, reducedMotion]);

  const gridAnimStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
    transform: [{ translateY: gridY.value }, { translateX: gridX.value }],
  }));

  const closeSheet = React.useCallback(() => setSheet(null), []);

  const openWalletSheet = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    setSheet('wallet');
  }, []);

  const openStatSheet = React.useCallback((key: SocialStatKey) => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    setSheet(key);
  }, []);

  const socialStats = [
    { value: DEMO_STATS.followers, label: 'followers', key: 'followers' as const },
    { value: DEMO_STATS.following, label: 'following', key: 'following' as const },
    { value: DEMO_STATS.likesReceived, label: 'likes received', key: 'likes' as const },
  ] as const;

  const sheetBg = isDark ? palette.nightWash : surface.sheet;
  const sheetGrab = isDark ? profileNeutralStroke(0.38) : profileNeutralStroke(0.22);
  const bottomPad = Math.max(insets.bottom, spacing.sm);

  const walletActivity = React.useMemo(
    () => [
      { id: 'w1', label: 'Thread validated', amount: 120, when: '2 days ago' },
      { id: 'w2', label: 'Expert Council session', amount: -councilSessionCost, when: '4 days ago' },
      { id: 'w3', label: 'Boost from @alexc', amount: 80, when: '1 week ago' },
      { id: 'w4', label: 'Friend invite bonus', amount: 200, when: '2 weeks ago' },
    ],
    [councilSessionCost],
  );

  const handleUpgradePremium = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    if (isPremium) {
      Alert.alert('Premium active', 'Unlimited Expert Council sessions are included in your plan.');
      return;
    }
    Alert.alert(
      'Upgrade to Premium',
      `Unlock unlimited Expert Council sessions (no ${councilSessionCost}-point charge), plus early access to new decision tools. This preview activates Premium locally until billing ships.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Activate Premium',
          onPress: () => {
            void activatePremium();
          },
        },
      ],
    );
  }, [activatePremium, councilSessionCost, isPremium]);

  const tabData = TABS.find((t) => t.key === activeTab)?.getData() ?? [];

  const handleAddPoints = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    if (__DEV__) {
      grantDevPoints();
      Alert.alert('Dev wallet', `Added 1,000 test points. Balance is now enough for more Council runs.`);
      return;
    }
    Alert.alert(
      'Add points',
      'Boosts when your threads get validated, friend invites, and partner promos will show up here. This preview build does not alter your balance.',
      [{ text: 'OK', style: 'default' }],
    );
  }, [grantDevPoints]);
  const emptyCopy =
    activeTab === 'yours'
      ? { title: 'No decisions yet', body: 'Start one from the Decide tab.' }
      : activeTab === 'orbit'
        ? { title: 'Not following anyone', body: 'Follow threads from Explore to see them here.' }
        : { title: 'No saves yet', body: 'Star a decision to stash it for later.' };

  const emptyAction =
    activeTab === 'yours'
      ? { label: 'Start a decision', route: '/(tabs)/decide' as const }
      : activeTab === 'orbit'
        ? { label: 'Explore threads', route: '/(tabs)/explore' as const }
        : null;

  const renderItem: ListRenderItem<DecisionPreview> = React.useCallback(
    ({ item, index }) => (
      <View style={[styles.gridCell, { width: columnWidth }, isListMode && styles.gridCellList]}>
        <StaggeredGridCard
          item={item}
          index={index}
          tabKey={activeTab}
          surface={surface}
          isDark={isDark}
          onOpen={openDecision}
          listMode={isListMode}
          slideX={gridX}
        />
      </View>
    ),
    [activeTab, columnWidth, gridX, isDark, isListMode, openDecision, surface],
  );

  const profileHeader = (
    <>
      <View
        style={[
          styles.profileHeaderPanel,
          !isDark && elevation.rest,
          { borderColor: surface.groupedBorder, backgroundColor: surface.groupedSurface },
        ]}>
        <LinearGradient
          colors={isDark ? [...PROFILE_HERO_GRADIENT_DARK] : [...PROFILE_HERO_GRADIENT_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeaderGradient}
        />
        <View style={styles.profileHeaderInner}>
          <View style={styles.identity}>
            <ProfileAvatar surface={surface} reducedMotion={reducedMotion} />

            <View style={styles.nameBlock}>
              <View style={styles.nameHeaderRow}>
                <Text style={[styles.displayName, { color: chrom.display }]} numberOfLines={1}>
                  Jordan Avery
                </Text>
                <SettingsGearButton
                  onPress={openSettings}
                  surface={surface}
                  isDark={isDark}
                  iconColor={chrom.gearIcon}
                  compact
                />
              </View>
              <View style={styles.handleRow}>
                <Text style={[styles.handle, { color: chrom.textMuted }]}>@jordan</Text>
                <Text style={[styles.handleDot, { color: chrom.textMuted }]}>·</Text>
                <PremiumBadge isPremium={isPremium} isDark={isDark} onPress={handleUpgradePremium} compact />
              </View>
            </View>
          </View>

          <InlineMetricsRow stats={socialStats} surface={surface} isDark={isDark} onPressStat={openStatSheet} />

          <WalletHeroBand
            pointsBalance={pointsBalance}
            isPremium={isPremium}
            chrom={chrom}
            isDark={isDark}
            onAddPoints={handleAddPoints}
            onOpenDetails={openWalletSheet}
            onUpgradePremium={handleUpgradePremium}
          />
        </View>
      </View>

      <View style={styles.profileTabsWrap}>
        <ProfileSegmentedTabs activeTab={activeTab} onSelect={selectTab} isDark={isDark} surface={surface} />
      </View>
    </>
  );

  return (
    <Screen variant="plain" padded scroll={false}>
      <View style={styles.screenRoot}>
        <FlatList
          key={activeTab}
          data={tabData}
          numColumns={isListMode ? 1 : 2}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={profileHeader}
          ListEmptyComponent={
            <Animated.View style={gridAnimStyle}>
              <View style={styles.emptyWrap}>
                <EmptyState
                  title={emptyCopy.title}
                  body={emptyCopy.body}
                  actionLabel={emptyAction?.label}
                  onAction={emptyAction ? () => router.push(emptyAction.route) : undefined}
                />
              </View>
            </Animated.View>
          }
          columnWrapperStyle={isListMode ? undefined : styles.cardColumnWrapper}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.mainList}
          contentContainerStyle={[
            styles.listContent,
            tabData.length === 0 && styles.listContentEmpty,
            { paddingBottom: Math.max(insets.bottom + 88, 96) },
          ]}
        />
        <ThemeFadeOverlay />
      </View>

      <WalletHistorySheet
        visible={sheet === 'wallet'}
        onClose={closeSheet}
        backgroundColor={sheetBg}
        borderTopColor={surface.sheetBorder}
        bottomInset={bottomPad}
        grabColor={sheetGrab}
        primaryTxt={chrom.textPrimary}
        muted={chrom.textMuted}
        accentColor={chrom.mint}
        hairline={surface.hairline}
        pointsBalance={pointsBalance}
        pointsFromOthers={pointsFromOthers}
        isPremium={isPremium}
        councilSessionCost={councilSessionCost}
        activity={walletActivity}
      />

      <ProfileStatSheet
        visible={sheet === 'followers'}
        kind="followers"
        onClose={closeSheet}
        backgroundColor={sheetBg}
        borderTopColor={surface.sheetBorder}
        bottomInset={bottomPad}
        grabColor={sheetGrab}
        primaryTxt={chrom.textPrimary}
        muted={chrom.textMuted}
        accentColor={chrom.mint}
        hairline={surface.hairline}
        total={DEMO_STATS.followers}
        people={DEMO_FOLLOWERS}
        likesBreakdown={DEMO_LIKES_BREAKDOWN}
      />

      <ProfileStatSheet
        visible={sheet === 'following'}
        kind="following"
        onClose={closeSheet}
        backgroundColor={sheetBg}
        borderTopColor={surface.sheetBorder}
        bottomInset={bottomPad}
        grabColor={sheetGrab}
        primaryTxt={chrom.textPrimary}
        muted={chrom.textMuted}
        accentColor={chrom.mint}
        hairline={surface.hairline}
        total={DEMO_STATS.following}
        people={DEMO_FOLLOWING}
        likesBreakdown={DEMO_LIKES_BREAKDOWN}
      />

      <ProfileStatSheet
        visible={sheet === 'likes'}
        kind="likes"
        onClose={closeSheet}
        backgroundColor={sheetBg}
        borderTopColor={surface.sheetBorder}
        bottomInset={bottomPad}
        grabColor={sheetGrab}
        primaryTxt={chrom.textPrimary}
        muted={chrom.textMuted}
        accentColor={chrom.mint}
        hairline={surface.hairline}
        total={DEMO_STATS.likesReceived}
        people={[]}
        likesBreakdown={DEMO_LIKES_BREAKDOWN}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    width: '100%',
  },
  themeFade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  mainList: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  listContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'stretch',
  },
  listContentEmpty: {
    minHeight: 200,
  },
  emptyWrap: {
    width: '100%',
    paddingVertical: spacing.md,
  },
  profileHeaderPanel: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  profileHeaderGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  profileHeaderInner: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    gap: spacing.sm,
  },
  gear: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearCompact: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
  },
  avatarCutout: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  nameBlock: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  handleDot: {
    fontSize: 14,
    fontWeight: '700',
  },
  displayName: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.65,
    flex: 1,
    minWidth: 0,
  },
  proBubble: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  proBubbleCompact: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: palette.heroInk,
    textTransform: 'uppercase',
  },
  proTextCompact: {
    fontSize: 9,
    letterSpacing: 0.45,
  },
  handle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  metricsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  metricsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    marginHorizontal: 4,
  },
  metricHit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 0,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'lowercase',
    letterSpacing: 0.12,
    textAlign: 'center',
  },
  walletHeroBand: {
    width: '100%',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  walletHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  walletHeroBalanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  walletHeroNum: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  walletHeroPts: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    flexShrink: 0,
    paddingBottom: 2,
  },
  walletMembershipLine: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: -0.05,
  },
  walletAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    flexShrink: 0,
  },
  walletAddLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.white,
    letterSpacing: -0.1,
  },
  segmentTrack: {
    position: 'relative',
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: radius.md,
    minHeight: 40,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: profileLight.mint,
        shadowOpacity: 0.14,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  segmentHit: {
    flex: 1,
    zIndex: 1,
  },
  segmentPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 34,
  },
  segmentLabel: {
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  profileTabsWrap: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.neonMint}40`,
    backgroundColor: `${palette.neonMint}09`,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.55,
    textTransform: 'lowercase',
  },
  cardColumnWrapper: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridCell: {
    alignItems: 'stretch',
  },
  gridCellList: {
    marginBottom: GRID_GAP,
  },
  gridCardBody: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'space-between',
    minWidth: 0,
    height: GRID_CARD_HEIGHT - 28,
  },
  gridCardTop: {
    marginBottom: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  gridTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: -0.25,
    flex: 1,
  },
  gridHint: {
    fontSize: 10,
    marginTop: 8,
    fontWeight: '500',
    lineHeight: 14,
  },
});
