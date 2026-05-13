import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { palette, typography } from '@/constants/theme';

function rgba255(r: number, g: number, b: number, a: number): string {
  return `rgba(${r},${g},${b},${a})`;
}

type ExploreMomentHeaderProps = {
  caseCount: number;
  /** Minimal keeps focus on cards; dramatic is the large cinematic hero. */
  variant?: 'minimal' | 'dramatic';
};

export function ExploreMomentHeader({ caseCount, variant = 'minimal' }: ExploreMomentHeaderProps) {
  if (variant === 'dramatic') {
    return <DramaticMomentHeader caseCount={caseCount} />;
  }
  return <MinimalExploreBar caseCount={caseCount} />;
}

function MinimalExploreBar({ caseCount }: { caseCount: number }) {
  const breathe = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const liveDotOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const countLabel =
    caseCount === 1 ? '1 live dilemma' : `${caseCount.toLocaleString()} live dilemmas`;

  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={`ShouldI explore. ${countLabel}. Swipe to vote.`}>
      <View style={minimalStyles.pad}>
        <View style={minimalStyles.bar}>
          <View style={minimalStyles.left}>
            <Text style={minimalStyles.logo}>
              Should<Text style={minimalStyles.logoAccent}>I</Text>
            </Text>
            <View style={minimalStyles.sep} />
            <Text style={minimalStyles.zone}>Explore</Text>
          </View>

          <View style={minimalStyles.livePill} accessibilityLabel={`${caseCount.toLocaleString()} dilemmas live`}>
            <Animated.View style={[minimalStyles.liveDot, { opacity: liveDotOpacity }]} />
            <Text style={minimalStyles.liveCount}>{caseCount.toLocaleString()}</Text>
          </View>
        </View>
        <LinearGradient
          colors={['rgba(45,107,255,0.65)', palette.mint, 'rgba(45,107,255,0.5)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={minimalStyles.accentHair}
        />
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

  const haloOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.38, 0.85],
  });
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
      <LinearGradient colors={['#070b18', '#0f1d3f', '#132448']} locations={[0, 0.55, 1]} style={dramaticStyles.baseGlow} />

      <LinearGradient
        colors={['transparent', 'rgba(45, 107, 255, 0.35)', 'rgba(67, 194, 155, 0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={dramaticStyles.radialBloom}
      />

      <Animated.View style={[dramaticStyles.haloDisk, { opacity: haloOpacity }]} pointerEvents="none" />

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
            colors={['#396dff', '#5b8dff', palette.mint]}
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

      <LinearGradient colors={['rgba(253,254,255,0.14)', 'rgba(253,254,255,0)']} style={dramaticStyles.glassSweep} />

      <View style={dramaticStyles.floorLine} />
      <Text style={dramaticStyles.microProof} accessibilityLabel={countLabel}>
        {`${caseCount.toLocaleString()} arcs in orbit`}
      </Text>
    </View>
  );
}

const minimalStyles = StyleSheet.create({
  pad: {
    gap: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
    minHeight: 40,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 8,
  },
  logo: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 3,
    color: palette.slate800,
    textTransform: 'uppercase',
  },
  logoAccent: {
    color: palette.accent,
  },
  sep: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: 'rgba(92,111,146,0.35)',
    borderRadius: StyleSheet.hairlineWidth,
  },
  zone: {
    ...typography.caption,
    color: palette.slate500,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ecf2ff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#c8dafb',
    flexShrink: 0,
    shadowColor: palette.accent,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.mint,
  },
  liveCount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: palette.slate900,
    fontVariant: ['tabular-nums'],
  },
  accentHair: {
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    opacity: 0.85,
  },
});

const dramaticStyles = StyleSheet.create({
  shell: {
    borderRadius: 26,
    overflow: 'hidden',
    paddingBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  baseGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
  },
  radialBloom: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    opacity: 0.94,
  },
  haloDisk: {
    position: 'absolute',
    top: '-40%',
    right: '-18%',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(93,143,255,0.32)',
    transform: [{ scale: 1.4 }],
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
    color: rgba255(255, 255, 255, 0.55),
    textTransform: 'uppercase',
  },
  brandAccent: {
    color: palette.mint,
  },
  railMuted: {
    ...typography.caption,
    color: rgba255(255, 255, 255, 0.45),
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  headline: {
    color: '#fdfefe',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 2,
    ...(Platform.OS === 'web'
      ? {}
      : {
          textShadowColor: 'rgba(0,12,44,0.55)',
          textShadowOffset: { width: 0, height: 3 },
          textShadowRadius: 18,
        }),
  },
  lede: {
    ...typography.compact,
    color: rgba255(255, 255, 255, 0.78),
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
    shadowColor: palette.accent,
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
  glassSweep: {
    height: StyleSheet.hairlineWidth + 44,
    marginHorizontal: -1,
    marginTop: -6,
    opacity: 0.35,
    pointerEvents: 'none',
  },
  floorLine: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 22,
    backgroundColor: 'rgba(255,255,255,0.09)',
    marginTop: -32,
    marginBottom: 8,
  },
  microProof: {
    ...typography.caption,
    textAlign: 'center',
    color: rgba255(255, 255, 255, 0.46),
    paddingHorizontal: 16,
    marginTop: -2,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 14,
  },
});
