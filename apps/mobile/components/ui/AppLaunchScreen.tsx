import * as React from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { OledFluorSpeckles } from '@/components/ui/OledSignUpBackdrop';
import { palette, typography } from '@/constants/theme';

const TAGLINES = [
  'Your crossroads. Their votes.',
  'Swipe the feed. Unlock the herd.',
  'Decisions, decoded.',
];

type AppLaunchScreenProps = {
  detail?: string;
};

export function AppLaunchScreen({ detail }: AppLaunchScreenProps) {
  const shimmer = React.useRef(new Animated.Value(0)).current;
  const ring2 = React.useRef(new Animated.Value(0)).current;
  const taglineAnim = React.useRef(new Animated.Value(1)).current;
  const [tagIdx, setTagIdx] = React.useState(() => Math.floor(Math.random() * TAGLINES.length));

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [shimmer]);

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ring2, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [ring2]);

  React.useEffect(() => {
    const id = setInterval(() => setTagIdx((i) => (i + 1) % TAGLINES.length), 3400);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    taglineAnim.setValue(0);
    Animated.timing(taglineAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [tagIdx, taglineAnim]);

  const ring1Scale = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });
  const ring1Opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.48] });
  const ring2Scale = ring2.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1.22] });
  const ring2Opacity = ring2.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.28] });
  const iGlow = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const lineOpacity = taglineAnim;
  const lineY = taglineAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <OledFluorSpeckles />
      </View>

      <View style={styles.content} accessibilityLabel="ShouldI loading">
        <View style={styles.markBlock}>
          {/* Outer diffuse ring — pink/sky */}
          <Animated.View
            style={[
              styles.ringOuter,
              { opacity: ring2Opacity, transform: [{ scale: ring2Scale }] },
            ]}
          />
          {/* Inner tight ring — mint */}
          <Animated.View
            style={[
              styles.ringInner,
              { opacity: ring1Opacity, transform: [{ scale: ring1Scale }] },
            ]}
          />

          {/* Wordmark */}
          <View style={styles.wordmarkRow}>
            <Text style={styles.logoShould}>Should</Text>
            <Animated.Text
              style={[
                styles.logoI,
                Platform.OS === 'ios' && {
                  textShadowColor: palette.neonMint,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 22],
                  }) as unknown as number,
                  opacity: iGlow,
                },
              ]}>
              I
            </Animated.Text>
          </View>

          {/* Neon dot trio */}
          <View style={styles.dotRow}>
            <View style={[styles.dot, { backgroundColor: `${palette.neonSky}bb` }]} />
            <View style={[styles.dotMid, { backgroundColor: palette.neonMint }]} />
            <View style={[styles.dot, { backgroundColor: `${palette.neonPink}bb` }]} />
          </View>
        </View>

        {/* Rotating tagline */}
        <Animated.Text
          style={[styles.tagline, { opacity: lineOpacity, transform: [{ translateY: lineY }] }]}>
          {TAGLINES[tagIdx]}
        </Animated.Text>

        {detail?.trim() ? (
          <Text style={styles.detail}>{detail.trim()}</Text>
        ) : (
          <Text style={styles.monoHint}>Loading experience…</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
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
    width: 220,
    minHeight: 130,
    position: 'relative',
  },
  ringOuter: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 1.5,
    borderColor: `${palette.neonPink}`,
    alignSelf: 'center',
    top: -24,
  },
  ringInner: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: StyleSheet.hairlineWidth * 3,
    borderColor: palette.neonMint,
    alignSelf: 'center',
    top: 0,
    ...Platform.select({
      ios: {
        shadowColor: palette.neonMint,
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      },
      android: {},
      default: {},
    }),
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    zIndex: 1,
  },
  logoShould: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -2,
    color: '#ffffff',
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
      },
      default: {},
    }),
  },
  logoI: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -2,
    color: palette.neonMint,
    ...Platform.select({
      ios: {
        fontStyle: 'italic',
      },
      default: {},
    }),
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.neonMint}2a`,
    backgroundColor: 'rgba(255,255,255,0.06)',
    zIndex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotMid: {
    width: 10,
    height: 10,
    borderRadius: 5,
    ...Platform.select({
      ios: {
        shadowColor: palette.neonMint,
        shadowOpacity: 0.8,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  tagline: {
    ...typography.compact,
    color: 'rgba(247,247,247,0.55)',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 22,
    paddingHorizontal: 16,
    minHeight: 48,
    fontWeight: '500',
  },
  monoHint: {
    color: 'rgba(247,247,247,0.32)',
    textAlign: 'center',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 14,
  },
  detail: {
    ...typography.caption,
    color: 'rgba(247,247,247,0.45)',
    textAlign: 'center',
    letterSpacing: 0.35,
    lineHeight: 18,
    maxWidth: 260,
    marginTop: -10,
    fontWeight: '500',
  },
});
