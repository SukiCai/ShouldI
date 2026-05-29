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
import { resolveYouChromatics } from '@/constants/appChromatics';
import { palette, screenContentGutter, spacing, themeSurface, typography } from '@/constants/theme';
import { useViewerPointsBalance } from '@/lib/useViewerPointsBalance';

/**
 * Light pastel accents — must match {@link profileLight} in `constants/theme.ts`.
 * Kept as file-local literals so Hermes doesn't hit flaky tab-bundle init ordering on `.sky`/`.pink` reads.
 */
const PROFILE_TAB_LIGHT = {
  sky: '#49cdeb',
  pink: '#ec7ab8',
  mint: '#2dd4bf',
} as const;

const AVATAR = require('@/constants/users/user-char-01.png');

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
  sky: PROFILE_TAB_LIGHT.sky,
  pink: PROFILE_TAB_LIGHT.pink,
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

function ProfileTabStrip({ activeTab, onSelect, isDark, surface }: ProfileTabStripProps) {
  const chrom = resolveYouChromatics(isDark, surface);
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
                    color: active ? chrom.tabActive : chrom.tabInactive,
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
      <View style={[styles.tabUnderlineTrack, { backgroundColor: chrom.tabTrack }]}>
        <Animated.View
          style={[styles.tabUnderlineBar, underlineStyle, { backgroundColor: chrom.tabUnderline }]}
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
  const chrom = resolveYouChromatics(isDark, surface);
  return (
    <View
      style={[
        styles.statChip,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
          borderColor: surface.hairline,
        },
      ]}>
      <Text style={[styles.statValue, { color: chrom.textPrimary }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.statLabel, { color: chrom.textMuted }]} numberOfLines={2}>
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
  const chrom = resolveYouChromatics(isDark, surface);
  const accentColor = isDark ? ACCENT[item.accent][0] : CARD_ACCENT_LIGHT[item.accent];
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
              <LivePulsePill surface={surface} isDark={isDark} />
            ) : (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : `${PROFILE_TAB_LIGHT.sky}10`,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: surface.hairline,
                  },
                ]}>
                <Text style={[styles.statusPillText, { color: chrom.textMuted }]}>done</Text>
              </View>
            )}
            <FontAwesome name="chevron-right" size={11} color={chrom.textMuted} />
          </View>
          <Text
            style={[styles.gridTitle, { color: chrom.textPrimary }, compact && styles.gridTitleCompact]}
            numberOfLines={compact ? 3 : 4}>
            {item.question}
          </Text>
          <Text style={[styles.gridHint, { color: chrom.textMuted }]} numberOfLines={2}>
            {item.hint}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyCards({
  surface,
  message,
  isDark,
}: {
  surface: ReturnType<typeof themeSurface>;
  message: string;
  isDark: boolean;
}) {
  const chrom = resolveYouChromatics(isDark, surface);
  return (
    <View style={[styles.emptyCard, { borderColor: surface.hairline, backgroundColor: surface.statTileBg }]}>
      <Text style={{ fontSize: 28, marginBottom: 8 }}>✦</Text>
      <Text style={[typography.compact, { color: chrom.textMuted, textAlign: 'center', lineHeight: 20 }]}>
        {message}
      </Text>
    </View>
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

  const { balance: pointsBalance } = useViewerPointsBalance();
  const pointsFromOthers = DEMO_STATS.pointsFromOthers;

  const tabData = TABS.find((t) => t.key === activeTab)?.getData() ?? [];

  const handleAddPoints = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    Alert.alert(
      'Add points',
      'Boosts when your threads get validated, friend invites, and partner promos will show up here. This preview build does not alter your balance.',
      [{ text: 'OK', style: 'default' }],
    );
  }, []);
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
              : [`${PROFILE_TAB_LIGHT.sky}33`, `${PROFILE_TAB_LIGHT.pink}14`, '#ffffff']
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
              <FontAwesome name="cog" size={15} color={chrom.gearIcon} />
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
                <Text style={[styles.displayName, { color: chrom.display }]}>Jordan Avery</Text>
                <LinearGradient
                  colors={
                    isDark
                      ? [`${palette.neonSky}cc`, `${palette.neonMint}aa`]
                      : [`${PROFILE_TAB_LIGHT.sky}d0`, `${PROFILE_TAB_LIGHT.mint}b8`]
                  }
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.proBubble}>
                  <Text style={styles.proText}>pro</Text>
                </LinearGradient>
              </View>
              <Text style={[styles.handle, { color: chrom.textMuted }]}>@jordan</Text>
              <Text style={[styles.tagline, { color: chrom.textMuted }]}>
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
            colors={isDark ? [palette.neonMint, palette.neonSky] : [PROFILE_TAB_LIGHT.sky, PROFILE_TAB_LIGHT.mint]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.walletAccent}
          />
          <View
            style={styles.walletBody}
            accessibilityLabel={`Rewards. Balance ${pointsBalance.toLocaleString()} points. ${pointsFromOthers.toLocaleString()} points collected from others. Add points.`}>
            <View style={styles.walletHeader}>
              <Text style={[styles.walletTitle, { color: chrom.textPrimary }]}>rewards</Text>
              <View
                style={[
                  styles.walletRateCapsule,
                  { backgroundColor: chrom.walletRateBg, borderColor: chrom.walletRateBorder },
                ]}>
                <Text style={[styles.walletRateCapsuleTxt, { color: chrom.walletRate }]}>
                  {pointsFromOthers.toLocaleString()} from others
                </Text>
              </View>
            </View>

            <View style={styles.walletMainRow}>
              <View style={styles.walletValueCol}>
                <View style={styles.walletBalanceRow}>
                  <Text style={[styles.walletBalanceNum, { color: chrom.walletUsd }]}>
                    {pointsBalance.toLocaleString()}
                  </Text>
                  <Text style={[styles.walletBalancePtsSuffix, { color: chrom.textMuted }]}>pts</Text>
                </View>
                <Text style={[styles.walletFromOthersLine, { color: chrom.textMuted }]}>
                  collected from votes, validations & boosts driven by others
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add points"
                accessibilityHint="Open ways to earn more points when available"
                onPress={handleAddPoints}
                style={({ pressed }) => [styles.walletCta, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}>
                <LinearGradient
                  colors={isDark ? [`${palette.neonMint}f0`, '#2ad4b4'] : [PROFILE_TAB_LIGHT.sky, PROFILE_TAB_LIGHT.mint]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.walletCtaGrad}>
                  <FontAwesome name="plus-circle" size={12} color={chrom.ctaOnGradient} />
                  <Text style={[styles.walletCtaLabel, { color: chrom.ctaOnGradient }]}>add points</Text>
                </LinearGradient>
              </Pressable>
            </View>

            <Text style={[styles.walletDisclaimer, { color: chrom.walletDisc }]}>demo split · API soon</Text>
          </View>
        </View>
      </View>

      <View style={styles.profileTabsWrap}>
        <ProfileTabStrip activeTab={activeTab} onSelect={selectTab} isDark={isDark} surface={surface} />
      </View>
    </>
  );

  const listFooter = (
    <>
      <View style={[styles.accountStrip, { borderTopColor: surface.hairline }]}>
        <Text style={[styles.accountHint, { color: chrom.textMuted }]}>account</Text>
        <View style={styles.accountLinks}>
          <Link href="/sign-in" asChild>
            <Pressable hitSlop={8}>
              <Text style={[styles.linkText, { color: chrom.linkSignIn }]}>sign in</Text>
            </Pressable>
          </Link>
          <Text style={{ color: chrom.textMuted, opacity: 0.5 }}>·</Text>
          <Link href="/sign-up" asChild>
            <Pressable hitSlop={8}>
              <Text style={[styles.linkText, { color: chrom.linkJoin }]}>join</Text>
            </Pressable>
          </Link>
        </View>
      </View>
      {__DEV__ ? (
        <Link href="/modal">
          <Text style={[typography.caption, styles.devLink, { color: chrom.textMuted }]}>diagnostics</Text>
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
        ListEmptyComponent={<EmptyCards surface={surface} message={emptyCopy} isDark={isDark} />}
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
    width: 38,
    height: 38,
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
  },
  walletRateCapsuleTxt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.12,
    textTransform: 'lowercase',
  },
  walletMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  walletValueCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingBottom: 0,
  },
  walletBalanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  walletBalanceNum: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.85,
    fontVariant: ['tabular-nums'],
  },
  walletBalancePtsSuffix: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  walletFromOthersLine: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.06,
    lineHeight: 15,
    maxWidth: 220,
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
