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
    <LinearGradient colors={['#070b18', '#0f1d3f', '#122a52']} locations={[0, 0.5, 1]} style={styles.root}>
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

      <LinearGradient
        colors={['transparent', 'rgba(67, 194, 155, 0.08)', 'rgba(57, 109, 255, 0.12)']}
        style={styles.floorGlow}
        pointerEvents="none"
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderColor: 'rgba(255,255,255,0.22)',
    top: -10,
    alignSelf: 'center',
  },
  logo: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -2,
    color: 'rgba(255,255,255,0.97)',
    textAlign: 'center',
    zIndex: 1,
  },
  logoI: {
    color: palette.mint,
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
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    zIndex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  dotMid: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.accent,
    shadowColor: palette.accent,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 4,
  },
  tagline: {
    ...typography.compact,
    color: 'rgba(253,254,254,0.78)',
    textAlign: 'center',
    letterSpacing: 0.18,
    lineHeight: 22,
    paddingHorizontal: 16,
    minHeight: 48,
    fontWeight: '500',
  },
  monoHint: {
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 14,
  },
  detail: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.54)',
    textAlign: 'center',
    letterSpacing: 0.35,
    lineHeight: 18,
    maxWidth: 260,
    marginTop: -10,
    fontWeight: '500',
  },
});
