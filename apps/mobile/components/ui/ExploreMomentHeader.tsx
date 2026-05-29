import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ShouldILogoMark } from '@/components/branding/ShouldILogo';
import { useColorScheme } from '@/components/useColorScheme';
import { OledFluorSpeckles } from '@/components/ui/OledSignUpBackdrop';
import { palette, profileLight, profileTypography, typography } from '@/constants/theme';

function rgba255(r: number, g: number, b: number, a: number): string {
  return `rgba(${r},${g},${b},${a})`;
}

type ExploreMomentHeaderProps = {
  caseCount: number;
  /** With `viewerPointsBalance`, swaps the dilemma-count pill for the viewer's total points balance. */
  viewerPointsBalance?: number;
  /** False until persisted balance finishes loading — avoids false “earn” bursts. */
  pointsHydrated?: boolean;
  /** Minimal keeps focus on cards; dramatic is the large cinematic hero. */
  variant?: 'minimal' | 'dramatic';
  footerLink?: { label: string; accessibilityHint?: string; onPress: () => void };
};

export function ExploreMomentHeader({
  caseCount,
  viewerPointsBalance,
  pointsHydrated = true,
  variant = 'minimal',
  footerLink,
}: ExploreMomentHeaderProps) {
  if (variant === 'dramatic') {
    return <DramaticMomentHeader caseCount={caseCount} />;
  }
  return (
    <MinimalExploreBar
      caseCount={caseCount}
      footerLink={footerLink}
      viewerPointsBalance={viewerPointsBalance}
      pointsHydrated={pointsHydrated}
    />
  );
}

function MinimalExploreBar({
  caseCount,
  footerLink,
  viewerPointsBalance,
  pointsHydrated = true,
}: {
  caseCount: number;
  footerLink?: { label: string; accessibilityHint?: string; onPress: () => void };
  viewerPointsBalance?: number;
  pointsHydrated?: boolean;
}) {
  const usePointsLedger = typeof viewerPointsBalance === 'number';

  const breathe = React.useRef(new Animated.Value(0)).current;
  const balancePulse = React.useRef(new Animated.Value(1)).current;
  const haloScale = React.useRef(new Animated.Value(0.84)).current;
  const haloOpacity = React.useRef(new Animated.Value(0)).current;
  const flashScale = React.useRef(new Animated.Value(0.94)).current;
  const flashOpacity = React.useRef(new Animated.Value(0)).current;
  const plusOpacity = React.useRef(new Animated.Value(0)).current;
  const plusLift = React.useRef(new Animated.Value(0)).current;
  const plusScale = React.useRef(new Animated.Value(0.72)).current;

  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [earnBurstDelta, setEarnBurstDelta] = React.useState<number | null>(null);
  const prevBalanceRef = React.useRef<number | null>(null);
  const runningPlusBurstRef = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fn = AccessibilityInfo.isReduceMotionEnabled;
        if (typeof fn === 'function') {
          const v = await fn();
          if (!cancelled) setReduceMotion(v);
        }
      } catch {
        /* noop */
      }
    })();
    let sub: { remove: () => void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    } catch {
      /* noop */
    }
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  React.useEffect(() => {
    if (usePointsLedger || reduceMotion) {
      breathe.stopAnimation();
      breathe.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduceMotion, usePointsLedger]);

  const liveDotOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  const countLabel =
    caseCount === 1 ? '1 live dilemma' : `${caseCount.toLocaleString()} live dilemmas`;

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  /** Profile tab strip uses sky, not neon mint — calmer on light canvas. */
  const accentOnChrome = isDark ? palette.neonMint : profileLight.sky;
  const pointsHaloBg = isDark ? 'rgba(61,255,184,0.24)' : 'rgba(73,205,235,0.22)';
  const liveDotBg = isDark ? palette.livePulse : profileLight.sky;
  const liveDotBorder = isDark ? 'rgba(16,185,129,0.4)' : `${profileLight.sky}80`;

  React.useEffect(() => {
    if (!usePointsLedger || viewerPointsBalance == null) return;
    if (!pointsHydrated) {
      prevBalanceRef.current = viewerPointsBalance;
      return;
    }
    if (prevBalanceRef.current === null) {
      prevBalanceRef.current = viewerPointsBalance;
      return;
    }
    const delta = viewerPointsBalance - prevBalanceRef.current;
    prevBalanceRef.current = viewerPointsBalance;
    if (delta <= 0) return;

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      AccessibilityInfo.announceForAccessibility(
        `Earned ${delta} points. New total balance ${viewerPointsBalance}.`,
      );
    }

    setEarnBurstDelta(delta);
    balancePulse.stopAnimation();
    haloScale.stopAnimation();
    haloOpacity.stopAnimation();
    flashScale.stopAnimation();
    flashOpacity.stopAnimation();
    balancePulse.setValue(1);
    haloScale.setValue(0.84);
    haloOpacity.setValue(0);
    flashScale.setValue(0.94);
    flashOpacity.setValue(0);

    if (reduceMotion) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(balancePulse, {
            toValue: 1.12,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(balancePulse, {
            toValue: 1,
            damping: 12,
            stiffness: 220,
            mass: 0.55,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(flashOpacity, {
            toValue: 0.55,
            duration: 100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flashOpacity, {
            toValue: 0,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
      return;
    }

    haloOpacity.setValue(0.42);
    flashOpacity.setValue(0.92);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(balancePulse, {
          toValue: 1.24,
          duration: 170,
          easing: Easing.out(Easing.back(1.25)),
          useNativeDriver: true,
        }),
        Animated.timing(balancePulse, {
          toValue: 0.94,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(balancePulse, {
          toValue: 1,
          damping: 12,
          stiffness: 220,
          mass: 0.55,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(haloScale, {
          toValue: 1.82,
          duration: 580,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(haloOpacity, {
          toValue: 0,
          duration: 580,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flashScale, {
            toValue: 1.06,
            duration: 130,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(flashScale, {
            toValue: 1.22,
            duration: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(flashOpacity, {
            toValue: 0.96,
            duration: 120,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flashOpacity, {
            toValue: 0,
            duration: 360,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [
    viewerPointsBalance,
    pointsHydrated,
    usePointsLedger,
    balancePulse,
    haloScale,
    haloOpacity,
    flashScale,
    flashOpacity,
    reduceMotion,
  ]);

  React.useEffect(() => {
    runningPlusBurstRef.current?.stop?.();
    plusOpacity.stopAnimation();
    plusLift.stopAnimation();
    plusScale.stopAnimation();

    if (earnBurstDelta == null) return undefined;

    if (reduceMotion) {
      plusLift.setValue(6);
      plusOpacity.setValue(1);
      plusScale.setValue(1);
      const t = setTimeout(() => {
        plusOpacity.setValue(0);
        setEarnBurstDelta(null);
      }, 620);
      return () => clearTimeout(t);
    }

    plusOpacity.setValue(0);
    plusLift.setValue(-2);
    plusScale.setValue(0.72);

    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(plusOpacity, {
          toValue: 1,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(plusLift, {
          toValue: 10,
          duration: 260,
          easing: Easing.out(Easing.back(1.18)),
          useNativeDriver: true,
        }),
        Animated.spring(plusScale, {
          toValue: 1.08,
          damping: 10,
          stiffness: 240,
          mass: 0.65,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(340),
      Animated.parallel([
        Animated.timing(plusOpacity, {
          toValue: 0,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(plusLift, {
          toValue: 24,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(plusScale, {
          toValue: 0.92,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    runningPlusBurstRef.current = seq;
    seq.start(({ finished }) => {
      if (finished) setEarnBurstDelta(null);
    });

    return () => {
      runningPlusBurstRef.current?.stop?.();
    };
  }, [earnBurstDelta, plusLift, plusOpacity, plusScale, reduceMotion]);

  const ledgerLabel =
    usePointsLedger && viewerPointsBalance != null
      ? ` Your total points balance is ${pointsHydrated ? viewerPointsBalance.toLocaleString() : 'loading'}.`
      : '';

  const headerA11yLabel = usePointsLedger
    ? `Explore.${ledgerLabel}`.trim()
    : `Explore · ${countLabel}. Swipe up for the next card.${ledgerLabel}`;

  return (
    <View accessibilityRole="header" accessibilityLabel={headerA11yLabel}>
      <View style={minimalStyles.row}>
        <View style={minimalStyles.leftCluster}>
          <View
            style={[
              minimalStyles.logoMarkWrap,
              isDark ? minimalStyles.logoMarkWrapDark : minimalStyles.logoMarkWrapLight,
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <ShouldILogoMark size={26} />
          </View>

          <Text style={[minimalStyles.title, { color: isDark ? palette.textOnCanvas : profileTypography.ink }]}>
            Explore
          </Text>

          {usePointsLedger && viewerPointsBalance != null ? (
            <View style={minimalStyles.pointsLedgerOuter}>
              <Animated.View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  minimalStyles.pointsHalo,
                  {
                    backgroundColor: pointsHaloBg,
                    opacity: haloOpacity,
                    transform: [{ scale: haloScale }],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  minimalStyles.pointsFlash,
                  {
                    opacity: flashOpacity,
                    transform: [{ scale: flashScale }],
                  },
                ]}
              />
              {earnBurstDelta != null ? (
                <Animated.View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    minimalStyles.earnBurstBadge,
                    {
                      opacity: plusOpacity,
                      transform: [{ translateY: plusLift }, { scale: plusScale }],
                    },
                  ]}>
                  <Ionicons name="sparkles" size={13} color={palette.sheet} />
                  <Text style={minimalStyles.earnBurstText}>+{earnBurstDelta} pts</Text>
                </Animated.View>
              ) : null}
              <Animated.View style={{ transform: [{ scale: balancePulse }] }}>
                <View
                  style={[minimalStyles.pointsLedgerPill, { borderColor: `${accentOnChrome}52` }]}
                  accessibilityLabel={
                    pointsHydrated
                      ? `Your total points balance, ${viewerPointsBalance}`
                      : 'Points balance loading'
                  }>
                  <Ionicons
                    name="sparkles"
                    size={14}
                    color={palette.neonPink}
                    style={minimalStyles.pointsGlyph}
                  />
                  <View style={minimalStyles.pointsValueWrap}>
                    <Text style={minimalStyles.liveCount}>
                      {pointsHydrated ? viewerPointsBalance.toLocaleString() : '…'}
                    </Text>
                    <Text style={minimalStyles.ptsSuffix}>pts</Text>
                  </View>
                </View>
              </Animated.View>
            </View>
          ) : (
            <View
              style={[minimalStyles.livePill, { borderColor: `${accentOnChrome}55` }]}
              accessibilityLabel={`${caseCount.toLocaleString()} dilemmas live`}>
              {!reduceMotion ? (
                <Animated.View
                  style={[
                    minimalStyles.liveDot,
                    {
                      opacity: liveDotOpacity,
                      backgroundColor: liveDotBg,
                      borderColor: liveDotBorder,
                    },
                  ]}
                />
              ) : (
                <View
                  style={[
                    minimalStyles.liveDot,
                    minimalStyles.liveDotRm,
                    { backgroundColor: liveDotBg, borderColor: liveDotBorder },
                  ]}
                />
              )}
              <Text style={minimalStyles.liveCount}>{caseCount.toLocaleString()}</Text>
            </View>
          )}
        </View>
        {footerLink ? (
          <Pressable
            accessibilityRole="link"
            accessibilityHint={footerLink.accessibilityHint}
            accessibilityLabel="Plot Deck"
            onPress={footerLink.onPress}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={({ pressed }) => [minimalStyles.plotLinkWrap, pressed && minimalStyles.plotLinkPressed]}>
            <Text style={[minimalStyles.plotLinkText, { color: accentOnChrome }]}>{footerLink.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Full hero — optional for future use (`variant="dramatic"`). */
function DramaticMomentHeader({ caseCount }: { caseCount: number }) {
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const wave = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    wave.start();
    return () => wave.stop();
  }, [shimmer]);

  const orbScale = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const countLabel =
    caseCount === 1 ? '1 dilemma live now' : `${caseCount.toLocaleString()} dilemmas live now`;

  return (
    <View
      style={dramaticStyles.shell}
      accessibilityRole="header"
      accessible
      accessibilityLabel={`ShouldI explore. ${countLabel}. Swipe reels to vote.`}>
      <View style={dramaticStyles.oledBackdrop}>
        <OledFluorSpeckles />
      </View>

      <View style={dramaticStyles.inner}>
        <View style={dramaticStyles.copyCol}>
          <View style={dramaticStyles.brandRail}>
            <Text style={dramaticStyles.brand}>
              Should<Text style={dramaticStyles.brandAccent}>I</Text>
            </Text>
            <Text style={dramaticStyles.railMuted}>Explore</Text>
          </View>
          <Text style={dramaticStyles.headline}>Crossroads,{'\n'}on tap.</Text>
          <Text style={dramaticStyles.lede}>Vote blind. Watch the herd appear. Rip through reels until your own dilemma calls.</Text>
        </View>

        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ transform: [{ scale: orbScale }] }}>
          <LinearGradient
            colors={[palette.neonPink, palette.neonSky, palette.neonMint]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={dramaticStyles.statOrb}>
            <Text style={dramaticStyles.statGlyph}>◇</Text>
            <Text
              style={dramaticStyles.statNumber}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}>
              {caseCount}
            </Text>
            <Text style={dramaticStyles.statCaps}>LIVE</Text>
          </LinearGradient>
        </Animated.View>
      </View>

      <View style={dramaticStyles.floorLine} />
      <Text style={dramaticStyles.microProof} accessibilityLabel={countLabel}>
        {`${caseCount.toLocaleString()} arcs in orbit`}
      </Text>
    </View>
  );
}

const minimalStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 30,
    paddingVertical: 2,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  logoMarkWrap: {
    flexShrink: 0,
    borderRadius: 8,
    overflow: 'visible',
  },
  logoMarkWrapDark: {
    ...Platform.select({
      ios: {
        shadowColor: palette.neonSky,
        shadowOpacity: 0.45,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  logoMarkWrapLight: {
    ...Platform.select({
      ios: {
        shadowColor: '#505050',
        shadowOpacity: 0.14,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  pointsLedgerOuter: {
    position: 'relative',
    flexShrink: 0,
    alignSelf: 'center',
    marginLeft: 2,
  },
  pointsHalo: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 999,
  },
  pointsFlash: {
    position: 'absolute',
    top: -1,
    right: -1,
    bottom: -1,
    left: -1,
    borderRadius: 999,
    backgroundColor: palette.neonPink,
  },
  pointsLedgerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minHeight: 26,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: palette.sheet,
    flexShrink: 0,
  },
  pointsGlyph: {
    alignSelf: 'center',
  },
  pointsValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  ptsSuffix: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.02,
    color: profileTypography.subdued,
    textTransform: 'lowercase',
  },
  earnBurstBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '100%',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.neonPink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
    ...Platform.select({
      ios: {
        shadowColor: palette.neonPink,
        shadowOpacity: 0.38,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  earnBurstText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
    color: palette.sheet,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: palette.sheet,
    flexShrink: 0,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  liveDotRm: {
    opacity: 0.85,
  },
  liveCount: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.35,
    color: profileTypography.ink,
    fontVariant: ['tabular-nums'],
  },
  plotLinkWrap: {
    flexShrink: 0,
    paddingVertical: 2,
    paddingLeft: 4,
    marginLeft: 4,
    borderRadius: 6,
    maxWidth: '44%',
    alignSelf: 'center',
  },
  plotLinkPressed: {
    opacity: 0.65,
  },
  plotLinkText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.15,
    textAlign: 'right',
  },
});

const dramaticStyles = StyleSheet.create({
  shell: {
    borderRadius: 26,
    overflow: 'hidden',
    paddingBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.chromeHairline,
    position: 'relative',
    backgroundColor: palette.mist,
  },
  oledBackdrop: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: palette.mist,
    pointerEvents: 'none',
    zIndex: 0,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 4,
    minHeight: 132,
    zIndex: 1,
    position: 'relative',
  },
  copyCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
    gap: 6,
  },
  brandRail: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  brand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3.2,
    color: palette.textMutedOnCanvas,
    textTransform: 'uppercase',
  },
  brandAccent: {
    color: palette.neonPink,
  },
  railMuted: {
    ...typography.caption,
    color: palette.textMutedOnCanvas,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  headline: {
    color: palette.textOnCanvas,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 2,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0,0,0,0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 10,
      },
      default: {},
    }),
  },
  lede: {
    ...typography.compact,
    color: palette.textMutedOnCanvas,
    lineHeight: 20,
    marginTop: 2,
    letterSpacing: 0.15,
    maxWidth: 280,
  },
  statOrb: {
    width: 88,
    height: 108,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: palette.neonPink,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  statGlyph: {
    color: rgba255(255, 255, 255, 0.7),
    fontSize: 12,
    marginBottom: 2,
    fontWeight: '700',
  },
  statNumber: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: '#fdfefe',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  statCaps: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    color: rgba255(255, 255, 255, 0.92),
    marginTop: 2,
  },
  floorLine: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 22,
    backgroundColor: palette.chromeHairline,
    marginTop: -32,
    marginBottom: 8,
    zIndex: 1,
  },
  microProof: {
    ...typography.caption,
    textAlign: 'center',
    color: palette.textMutedOnCanvas,
    paddingHorizontal: 16,
    marginTop: -2,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 14,
    zIndex: 1,
    position: 'relative',
  },
});
