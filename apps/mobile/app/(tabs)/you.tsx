import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Link, router } from 'expo-router';
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
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import Screen from '@/components/ui/Screen';
import { palette, screenContentGutter, spacing, themeSurface, typography } from '@/constants/theme';

const AVATAR = require('@/constants/users/user-char-01.png');

/** Demo social metrics until profile API exists */
const DEMO_STATS = {
  followers: 128,
  /** Accounts this user follows */
  following: 64,
  /** Likes received on their activity */
  likesReceived: 942,
  /** Lifetime points from votes, decisions, and milestones */
  pointsEarned: 2450,
} as const;

/** Cash-out / redemption rate shown in UI: this many points = US $1 */
const POINTS_PER_USD = 10;

function pointsToUsdCash(points: number): number {
  return points / POINTS_PER_USD;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

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

type TabKey = 'yours' | 'orbit' | 'saved';

const TABS: { key: TabKey; label: string; getData: () => DecisionPreview[] }[] = [
  { key: 'yours', label: 'Dropped', getData: () => YOUR_DECISIONS },
  { key: 'orbit', label: 'Orbit', getData: () => FOLLOWING },
  { key: 'saved', label: 'Saved', getData: () => STARRED },
];

const GRID_GAP = 12;
const STAT_GAP = 8;

const TAB_SPRING = { damping: 24, stiffness: 340, mass: 0.38 };

/** Compact “on-air” cue — dot opacity only, no halo glow */
function LivePulsePill() {
  const pulse = useSharedValue(1);

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
    <View style={styles.livePill}>
      <Animated.View style={[styles.liveDot, { backgroundColor: palette.neonMint }, dotStyle]} />
      <Text style={styles.livePillText}>live</Text>
    </View>
  );
}

type ProfileTabStripProps = {
  activeTab: TabKey;
  onSelect: (key: TabKey) => void;
  surface: ReturnType<typeof themeSurface>;
};

function ProfileTabStrip({ activeTab, onSelect, surface }: ProfileTabStripProps) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const lineX = useSharedValue(0);
  const lineW = useSharedValue(0);

  const moveUnderline = (key: TabKey, width: number, animated: boolean) => {
    if (width < 1) return;
    const seg = width / 3;
    const w = Math.max(32, Math.min(seg - 16, seg * 0.52));
    const idx = TABS.findIndex((t) => t.key === key);
    const x = idx * seg + (seg - w) / 2;
    lineW.value = w;
    if (animated) {
      lineX.value = withSpring(x, TAB_SPRING);
    } else {
      lineX.value = x;
    }
  };

  React.useEffect(() => {
    moveUnderline(activeTab, trackWidth, true);
  }, [activeTab, trackWidth]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setTrackWidth(w);
    moveUnderline(activeTab, w, false);
  };

  const underlineStyle = useAnimatedStyle(() => ({
    width: lineW.value,
    transform: [{ translateX: lineX.value }],
  }));

  return (
    <View style={styles.tabBarWrap} onLayout={onTrackLayout}>
      <View style={styles.tabBarRow}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(t.key)}
              style={({ pressed }) => [styles.tabBarHit, pressed && !active && { opacity: 0.85 }]}>
              <Text
                numberOfLines={1}
                style={[
                  styles.tabBarLabel,
                  {
                    color: active ? surface.textPrimary : surface.textMuted,
                    fontWeight: active ? '700' : '500',
                    letterSpacing: active ? -0.2 : 0.15,
                  },
                ]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.tabUnderlineTrack, { backgroundColor: surface.hairline }]}>
        <Animated.View
          style={[styles.tabUnderlineBar, underlineStyle, { backgroundColor: palette.neonMint }]}
        />
      </View>
    </View>
  );
}

function StatChipFixed({
  value,
  label,
  surface,
  isDark,
}: {
  value: number;
  label: string;
  surface: ReturnType<typeof themeSurface>;
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.statChip,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
          borderColor: surface.hairline,
        },
      ]}>
      <Text style={[styles.statValue, { color: surface.textPrimary }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.statLabel, { color: surface.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function ProfileDecisionCard({
  item,
  surface,
  isDark,
  onOpen,
  compact,
}: {
  item: DecisionPreview;
  surface: ReturnType<typeof themeSurface>;
  isDark: boolean;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  const accentColor = ACCENT[item.accent][0];
  const open = item.status === 'open';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.question}
      onPress={() => onOpen(item.id)}
      style={({ pressed }) => [
        styles.gridCard,
        {
          borderColor: surface.sheetBorder,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : palette.sheet,
        },
        pressed && { opacity: 0.92 },
      ]}>
      <View style={styles.gridCardRow}>
        <View style={[styles.gridCardAccent, { backgroundColor: accentColor }]} />
        <View style={[styles.gridCardBody, compact && styles.gridCardBodyCompact]}>
          <View style={styles.gridCardTop}>
            {open ? (
              <LivePulsePill />
            ) : (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: surface.hairline,
                  },
                ]}>
                <Text style={[styles.statusPillText, { color: surface.textMuted }]}>done</Text>
              </View>
            )}
            <FontAwesome name="chevron-right" size={11} color={surface.textMuted} />
          </View>
          <Text
            style={[styles.gridTitle, { color: surface.textPrimary }, compact && styles.gridTitleCompact]}
            numberOfLines={compact ? 3 : 4}>
            {item.question}
          </Text>
          <Text style={[styles.gridHint, { color: surface.textMuted }]} numberOfLines={2}>
            {item.hint}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyCards({ surface, message }: { surface: ReturnType<typeof themeSurface>; message: string }) {
  return (
    <View style={[styles.emptyCard, { borderColor: surface.hairline, backgroundColor: surface.statTileBg }]}>
      <Text style={{ fontSize: 28, marginBottom: 8 }}>✦</Text>
      <Text style={[typography.compact, { color: surface.textMuted, textAlign: 'center', lineHeight: 20 }]}>{message}</Text>
    </View>
  );
}

export default function YouScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = React.useState<TabKey>('yours');

  /** Content width inside Screen side padding — single source of truth for columns + grid math. */
  const contentWidth = Math.max(0, windowWidth - screenContentGutter * 2);
  const columnWidth = (contentWidth - GRID_GAP) / 2;

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
      void Haptics.selectionAsync().catch(() => undefined);
    }
    setActiveTab(key);
  };

  const socialStats = [
    { value: DEMO_STATS.followers, label: 'followers' },
    { value: DEMO_STATS.following, label: 'following' },
    { value: DEMO_STATS.likesReceived, label: 'likes received' },
  ] as const;

  const pointsBalance = DEMO_STATS.pointsEarned;
  const cashLabel = formatUsd(pointsToUsdCash(pointsBalance));

  const tabData = TABS.find((t) => t.key === activeTab)?.getData() ?? [];

  const handleCashOut = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    Alert.alert(
      'Cash out',
      `Redeem about ${cashLabel} (${pointsBalance.toLocaleString()} pts)? Payouts and wallet linking will open here soon.`,
      [{ text: 'OK', style: 'default' }],
    );
  }, [cashLabel, pointsBalance]);
  const emptyCopy =
    activeTab === 'yours'
      ? 'Nothing dropped yet — start a decision from the Decide tab.'
      : activeTab === 'orbit'
        ? 'Follow threads from Explore to see them here.'
        : 'Star a decision to stash it for later.';

  const renderItem: ListRenderItem<DecisionPreview> = React.useCallback(
    ({ item }) => (
      <View style={[styles.gridCell, { width: columnWidth }]}>
        <ProfileDecisionCard item={item} surface={surface} isDark={isDark} onOpen={openDecision} compact />
      </View>
    ),
    [columnWidth, surface, isDark, openDecision],
  );

  const listHeader = (
    <>
      <View style={[styles.heroPanel, { borderColor: surface.hairline }]}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(61,255,184,0.14)', 'rgba(84,220,255,0.07)', 'rgba(15,23,42,0.02)']
              : ['rgba(61,255,184,0.22)', 'rgba(255,77,148,0.06)', '#ffffff']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroInner}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={12}
              onPress={openSettings}
              style={({ pressed }) => [
                styles.gear,
                {
                  borderColor: surface.hairline,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.75)',
                },
                pressed && { opacity: 0.9 },
              ]}>
              <FontAwesome name="cog" size={18} color={surface.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.identity}>
            <LinearGradient
              colors={[`${palette.neonMint}`, `${palette.neonSky}`, `${palette.neonPink}`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}>
              <View style={[styles.avatarCutout, { backgroundColor: surface.canvas }]}>
                <Image source={AVATAR} style={styles.avatarImg} resizeMode="cover" accessibilityIgnoresInvertColors />
              </View>
            </LinearGradient>

            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text style={[styles.displayName, { color: surface.textPrimary }]}>Jordan Avery</Text>
                <LinearGradient
                  colors={[`${palette.neonSky}cc`, `${palette.neonMint}aa`]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.proBubble}>
                  <Text style={styles.proText}>pro</Text>
                </LinearGradient>
              </View>
              <Text style={[styles.handle, { color: surface.textMuted }]}>@jordan</Text>
              <Text style={[styles.tagline, { color: surface.textMuted }]}>
                your fit check for big choices ✦ low pressure, high signal
              </Text>
            </View>
          </View>

          <View style={styles.statGridInHero}>
            <View style={styles.statRow}>
              {socialStats.map((s) => (
                <View key={s.label} style={styles.statCell}>
                  <StatChipFixed value={s.value} label={s.label} surface={surface} isDark={isDark} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.pointsCashOuter}>
        <View
          style={[
            styles.walletCard,
            {
              borderColor: surface.hairline,
              backgroundColor: isDark ? 'rgba(255,255,255,0.055)' : palette.sheet,
            },
          ]}>
          <LinearGradient
            colors={[palette.neonMint, palette.neonSky]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.walletAccent}
          />
          <View
            style={styles.walletBody}
            accessibilityLabel={`Rewards balance ${cashLabel}, ${pointsBalance.toLocaleString()} points. ${POINTS_PER_USD} points per dollar.`}>
            <View style={styles.walletHeader}>
              <Text style={[styles.walletTitle, { color: surface.textPrimary }]}>rewards</Text>
              <View
                style={[
                  styles.walletRateCapsule,
                  { backgroundColor: isDark ? 'rgba(61,255,184,0.07)' : 'rgba(61,255,184,0.09)' },
                ]}>
                <Text style={[styles.walletRateCapsuleTxt, { color: palette.neonMint }]}>
                  {POINTS_PER_USD} pts → $1
                </Text>
              </View>
            </View>

            <View style={styles.walletMainRow}>
              <View style={styles.walletValueCol}>
                <Text style={styles.walletUsd}>{cashLabel}</Text>
                <Text style={[styles.walletPts, { color: surface.textMuted }]}>
                  {pointsBalance.toLocaleString()} pts
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cash out rewards"
                accessibilityHint="Starts cash-out when payouts are available"
                onPress={handleCashOut}
                style={({ pressed }) => [styles.walletCta, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}>
                <LinearGradient
                  colors={[`${palette.neonMint}f0`, '#2ad4b4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.walletCtaGrad}>
                  <Text style={styles.walletCtaLabel}>cash out</Text>
                  <FontAwesome name="arrow-right" size={11} color={palette.heroInk} />
                </LinearGradient>
              </Pressable>
            </View>

            <Text style={[styles.walletDisclaimer, { color: surface.textMuted }]}>est. only</Text>
          </View>
        </View>
      </View>

      <View style={styles.profileTabsWrap}>
        <ProfileTabStrip activeTab={activeTab} onSelect={selectTab} surface={surface} />
      </View>
    </>
  );

  const listFooter = (
    <>
      <View style={[styles.accountStrip, { borderTopColor: surface.hairline }]}>
        <Text style={[styles.accountHint, { color: surface.textMuted }]}>account</Text>
        <View style={styles.accountLinks}>
          <Link href="/sign-in" asChild>
            <Pressable hitSlop={8}>
              <Text style={[styles.linkText, { color: palette.neonSky }]}>sign in</Text>
            </Pressable>
          </Link>
          <Text style={{ color: surface.textMuted, opacity: 0.5 }}>·</Text>
          <Link href="/sign-up" asChild>
            <Pressable hitSlop={8}>
              <Text style={[styles.linkText, { color: palette.neonMint }]}>join</Text>
            </Pressable>
          </Link>
        </View>
      </View>
      {__DEV__ ? (
        <Link href="/modal">
          <Text style={[typography.caption, styles.devLink, { color: surface.textMuted }]}>diagnostics</Text>
        </Link>
      ) : null}
    </>
  );

  return (
    <Screen padded scroll={false}>
      <FlatList
        data={tabData}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={<EmptyCards surface={surface} message={emptyCopy} />}
        columnWrapperStyle={styles.cardColumnWrapper}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.mainList}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 88, 100) },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  heroPanel: {
    position: 'relative',
    width: '100%',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  heroInner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  gear: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 999,
  },
  avatarCutout: {
    width: 92,
    height: 92,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 92,
    height: 92,
  },
  nameBlock: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  displayName: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  proBubble: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  proText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: palette.heroInk,
    textTransform: 'uppercase',
  },
  handle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  tagline: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  statGridInHero: {
    width: '100%',
    marginTop: spacing.md,
  },
  pointsCashOuter: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.045,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  walletAccent: {
    width: 3,
    alignSelf: 'stretch',
    minHeight: 1,
  },
  walletBody: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 11,
    paddingRight: 12,
    paddingVertical: 11,
    gap: 7,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  walletTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.05,
    textTransform: 'lowercase',
    opacity: 0.95,
  },
  walletRateCapsule: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.neonMint}30`,
  },
  walletRateCapsuleTxt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.12,
    textTransform: 'lowercase',
  },
  walletMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  walletValueCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
    paddingBottom: 0,
  },
  walletUsd: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.85,
    fontVariant: ['tabular-nums'],
    color: palette.neonMint,
  },
  walletPts: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.06,
  },
  walletCta: {
    borderRadius: 999,
    overflow: 'hidden',
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: palette.neonMint,
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  walletCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  walletCtaLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.12,
    color: palette.heroInk,
    textTransform: 'lowercase',
  },
  walletDisclaimer: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.06,
    opacity: 0.5,
    textTransform: 'lowercase',
  },
  statRow: {
    width: '100%',
    flexDirection: 'row',
    gap: STAT_GAP,
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  statCell: {
    flex: 1,
    minWidth: 0,
  },
  statChip: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 62,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.48,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'lowercase',
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  tabBarWrap: {
    width: '100%',
  },
  profileTabsWrap: {
    width: '100%',
    marginBottom: spacing.md,
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  tabBarHit: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tabBarLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  tabUnderlineTrack: {
    position: 'relative',
    width: '100%',
    height: StyleSheet.hairlineWidth * 2,
    borderRadius: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tabUnderlineBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: 2,
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
    color: palette.neonMint,
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
  gridCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  gridCardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 118,
  },
  gridCardAccent: {
    width: 4,
  },
  gridCardBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  gridCardBodyCompact: {
    paddingBottom: 10,
  },
  gridCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  gridTitleCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  gridHint: {
    fontSize: 10,
    marginTop: 8,
    fontWeight: '500',
    lineHeight: 14,
  },
  emptyCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    marginBottom: spacing.md,
  },
  accountStrip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  accountHint: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'lowercase',
  },
  accountLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    textTransform: 'lowercase',
  },
  devLink: {
    textAlign: 'center',
    marginBottom: 72,
    textDecorationLine: 'underline',
    textTransform: 'lowercase',
  },
});
