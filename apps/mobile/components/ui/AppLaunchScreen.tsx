import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { palette, typography } from '@/constants/theme';

const TAGLINES = [
  'Your crossroads. Their votes.',
  'Swipe the feed. Unlock the herd.',
  'Decisions, decoded.',
];

type AppLaunchScreenProps = {
  /** Shown under the rotating taglines (e.g. while fetching Explore). */
  detail?: string;
};

export function AppLaunchScreen({ detail }: AppLaunchScreenProps) {
  const shimmer = React.useRef(new Animated.Value(0)).current;
  const taglineAnim = React.useRef(new Animated.Value(1)).current;
  const [tagIdx, setTagIdx] = React.useState(() => Math.floor(Math.random() * TAGLINES.length));

  React.useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [shimmer]);

  React.useEffect(() => {
    const id = setInterval(() => {
      setTagIdx((i) => (i + 1) % TAGLINES.length);
    }, 3400);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    taglineAnim.setValue(0);
    Animated.timing(taglineAnim, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tagIdx, taglineAnim]);

  const ringScale = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const ringOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 0.55],
  });
  const lineOpacity = taglineAnim;
  const lineY = taglineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  const detailLine = detail?.trim();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#fffefb', palette.accentSoft, '#e9fbf4']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.35, y: 0 }}
        end={{ x: 0.65, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <HeroBubbles />
      <LinearGradient
        colors={['transparent', `${palette.bokehMint}26`, `${palette.bokehSky}18`]}
        style={styles.floorGlow}
        pointerEvents="none"
      />
      <View style={styles.content} accessibilityLabel="ShouldI loading">
        <View style={styles.markBlock}>
          <Animated.View style={[styles.pulseRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />

          <Text style={styles.logo}>
            Should<Text style={styles.logoI}>I</Text>
          </Text>

          <View style={styles.dotRow}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotMid]} />
            <View style={styles.dot} />
          </View>
        </View>

        <Animated.Text style={[styles.tagline, { opacity: lineOpacity, transform: [{ translateY: lineY }] }]}>
          {TAGLINES[tagIdx]}
        </Animated.Text>

        {detailLine ? (
          <Text style={styles.detail}>{detailLine}</Text>
        ) : (
          <Text style={[typography.caption, styles.monoHint]}>Loading experience…</Text>
        )}
      </View>
    </View>
  );
}

function HeroBubbles() {
  return (
    <View style={heroBubbleStyles.wrap} pointerEvents="none">
      <View style={[heroBubbleStyles.dot, heroBubbleStyles.pink]} />
      <View style={[heroBubbleStyles.dot, heroBubbleStyles.violet]} />
      <View style={[heroBubbleStyles.dot, heroBubbleStyles.sky]} />
      <View style={[heroBubbleStyles.dot, heroBubbleStyles.mint]} />
    </View>
  );
}

const heroBubbleStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 1,
  },
  dot: {
    position: 'absolute',
    borderRadius: 999,
  },
  pink: {
    width: 120,
    height: 120,
    top: '12%',
    right: '-6%',
    backgroundColor: `${palette.bokehPink}52`,
    transform: [{ scale: 1.1 }],
  },
  violet: {
    width: 96,
    height: 96,
    top: '22%',
    left: '-10%',
    backgroundColor: `${palette.bokehViolet}42`,
  },
  sky: {
    width: 88,
    height: 88,
    bottom: '34%',
    right: '4%',
    backgroundColor: `${palette.bokehSky}3a`,
  },
  mint: {
    width: 72,
    height: 72,
    bottom: '26%',
    left: '12%',
    backgroundColor: `${palette.bokehMint}36`,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.mist,
  },
  floorGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    opacity: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    maxWidth: 320,
    gap: 28,
    zIndex: 2,
  },
  markBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    minHeight: 120,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: `${palette.neonMint}44`,
    top: -10,
    alignSelf: 'center',
  },
  logo: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -2,
    color: palette.heroInk,
    textAlign: 'center',
    zIndex: 1,
  },
  logoI: {
    color: palette.neonMint,
    fontWeight: '800',
    fontStyle: Platform.OS === 'ios' ? 'italic' : undefined,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 5,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.heroInk}12`,
    backgroundColor: 'rgba(255,255,255,0.74)',
    zIndex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.slate200,
  },
  dotMid: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: `${palette.bokehPink}c8`,
    shadowColor: palette.bokehPink,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 4,
  },
  tagline: {
    ...typography.compact,
    color: palette.slate800,
    textAlign: 'center',
    letterSpacing: 0.18,
    lineHeight: 22,
    paddingHorizontal: 16,
    minHeight: 48,
    fontWeight: '500',
  },
  monoHint: {
    color: palette.slate500,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 14,
  },
  detail: {
    ...typography.caption,
    color: palette.slate500,
    textAlign: 'center',
    letterSpacing: 0.35,
    lineHeight: 18,
    maxWidth: 260,
    marginTop: -10,
    fontWeight: '500',
  },
});
