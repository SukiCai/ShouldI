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
  /** Minimal keeps focus on cards; dramatic is the large cinematic hero. */
  variant?: 'minimal' | 'dramatic';
  footerLink?: { label: string; accessibilityHint?: string; onPress: () => void };
};

export function ExploreMomentHeader({ caseCount, variant = 'minimal', footerLink }: ExploreMomentHeaderProps) {
  if (variant === 'dramatic') {
    return <DramaticMomentHeader caseCount={caseCount} />;
  }
  return <MinimalExploreBar caseCount={caseCount} footerLink={footerLink} />;
}

function MinimalExploreBar({
  caseCount,
  footerLink,
}: {
  caseCount: number;
  footerLink?: { label: string; accessibilityHint?: string; onPress: () => void };
}) {
  const breathe = React.useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = React.useState(false);

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
    if (reduceMotion) {
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
  }, [breathe, reduceMotion]);

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
  const liveDotBg = isDark ? palette.livePulse : profileLight.sky;
  const liveDotBorder = isDark ? 'rgba(16,185,129,0.4)' : `${profileLight.sky}80`;

  return (
    <View accessibilityRole="header" accessibilityLabel={`Explore · ${countLabel}. Swipe up for the next card.`}>
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
          <View
            style={[minimalStyles.livePill, { borderColor: `${accentOnChrome}55` }]}
            accessibilityLabel={`${caseCount.toLocaleString()} dilemmas live`}>
            {!reduceMotion ? (
              <Animated.View
                style={[
                  minimalStyles.liveDot,
                  { opacity: liveDotOpacity, backgroundColor: liveDotBg, borderColor: liveDotBorder },
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
