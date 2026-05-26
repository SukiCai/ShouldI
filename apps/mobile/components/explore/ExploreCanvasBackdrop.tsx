/**
 * Explore canvas — Gen-Z “living mesh”: stacked neon-soft gradients, buoyant glow orbs,
 * and a feather-light breathe layer (paused when Reduce Motion is on).
 */
import * as React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  StyleProp,
  ViewStyle,
  View,
} from 'react-native';

import { OledFluorSpeckles } from '@/components/ui/OledSignUpBackdrop';
import { PROFILE_HERO_GRADIENT_LIGHT, palette } from '@/constants/theme';

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  orbBase: {
    position: 'absolute',
  },
  meshAnimated: {
    ...StyleSheet.absoluteFillObject,
  },
  lightOrbs: {
    opacity: Platform.OS === 'ios' ? 0.55 : 0.46,
  },
  lightSpeckles: {
    opacity: Platform.OS === 'ios' ? 0.26 : 0.2,
  },
  darkSpeckles: {
    opacity: Platform.OS === 'ios' ? 0.48 : 0.4,
  },
});

type GlowOrbProps = {
  size: number;
  bg: string;
  blur: string;
  style: StyleProp<ViewStyle>;
};

function GlowOrb({ size, bg, blur, style }: GlowOrbProps) {
  return (
    <View
      style={[
        styles.orbBase,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          ...(Platform.OS === 'ios'
            ? {
                shadowColor: blur,
                shadowOpacity: 0.48,
                shadowRadius: size / 2.9,
              }
            : { elevation: 0 }),
        },
        style,
      ]}
    />
  );
}

/** Bolder bokeh — corners + swipe lane feel energetic but stay behind cards */
function ExploreLightGlowOrbs() {
  return (
    <>
      <GlowOrb size={58} bg={`${palette.bokehSky}48`} blur={palette.neonSky} style={{ left: '2%', top: '8%' }} />
      <GlowOrb size={54} bg={`${palette.bokehPink}40`} blur={palette.neonPink} style={{ right: '4%', top: '14%' }} />
      <GlowOrb size={72} bg={`${palette.neonCitron}2e`} blur={palette.neonCitron} style={{ left: '-2%', bottom: '18%' }} />
      <GlowOrb size={50} bg={`${palette.bokehViolet}3c`} blur={palette.neonPink} style={{ right: '0%', bottom: '10%' }} />
      <GlowOrb size={46} bg={`${palette.bokehMint}3a`} blur={palette.neonMint} style={{ right: '22%', top: '38%' }} />
      <GlowOrb size={34} bg={`${palette.playful}30`} blur={palette.playful} style={{ left: '28%', bottom: '35%' }} />
    </>
  );
}

function useBackdropBreath(enabled: boolean) {
  const n = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | undefined;
    let reduceSub: { remove?: () => void } | undefined;

    const arm = (): void => {
      loop?.stop();
      loop = undefined;
      if (!enabled || cancelled) return;
      const next = Animated.loop(
        Animated.sequence([
          Animated.timing(n, {
            toValue: 1,
            duration: 2800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(n, {
            toValue: 0,
            duration: 2800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loop = next;
      next.start();
    };

    const disarmStatic = (): void => {
      loop?.stop();
      loop = undefined;
      n.stopAnimation();
      n.setValue(0.74);
    };

    const bootstrap = (): void => {
      if (!enabled || cancelled) {
        n.setValue(1);
        return;
      }
      void AccessibilityInfo.isReduceMotionEnabled()
        .then((rm) => {
          if (cancelled || !enabled) return;
          if (rm) disarmStatic();
          else arm();
        })
        .catch(() => {
          if (!cancelled && enabled) arm();
        });
    };

    bootstrap();

    try {
      reduceSub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (rm: boolean) => {
        if (cancelled || !enabled) return;
        if (rm) disarmStatic();
        else arm();
      });
    } catch {
      /* noop */
    }

    return () => {
      cancelled = true;
      loop?.stop();
      reduceSub?.remove?.();
      n.stopAnimation();
    };
  }, [enabled, n]);

  return n;
}

export function ExploreCanvasBackdrop({ isDark }: { isDark: boolean }) {
  const lightBreath = useBackdropBreath(!isDark);
  const auroraBreath = useBackdropBreath(isDark);

  const lightMeshOpacity = lightBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1],
  });

  const darkAuroraOpacity = auroraBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.92],
  });

  const orbFloat = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isDark) return undefined;
    let cancelled = false;
    let bob: Animated.CompositeAnimation | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (cancelled || rm) return;
      bob = Animated.loop(
        Animated.sequence([
          Animated.timing(orbFloat, {
            toValue: 1,
            duration: 5200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(orbFloat, {
            toValue: 0,
            duration: 5200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      bob.start();
    });

    return () => {
      cancelled = true;
      bob?.stop();
      orbFloat.stopAnimation();
    };
  }, [isDark, orbFloat]);

  const orbLift = orbFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });

  if (isDark) {
    return (
      <>
        <LinearGradient
          pointerEvents="none"
          colors={[palette.nightHorizon, palette.nightSlate, palette.mist]}
          locations={[0, 0.32, 1]}
          start={{ x: 0.35, y: 0 }}
          end={{ x: 0.55, y: 1 }}
          style={styles.fill}
        />
        <Animated.View pointerEvents="none" style={[styles.meshAnimated, { opacity: darkAuroraOpacity }]}>
          <LinearGradient
            pointerEvents="none"
            colors={[
              `${palette.neonMint}00`,
              `${palette.neonMint}18`,
              `${palette.neonSky}14`,
              `${palette.neonPink}10`,
              `${palette.neonMint}00`,
            ]}
            locations={[0, 0.28, 0.52, 0.74, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.06)', `${palette.heroInk}00`]}
          locations={[0, 0.45]}
          start={{ x: 0.9, y: 0 }}
          end={{ x: 0.1, y: 0.85 }}
          style={[styles.fill, { opacity: 0.85 }]}
        />
        <View pointerEvents="none" style={[styles.fill, styles.darkSpeckles]}>
          <OledFluorSpeckles />
        </View>
      </>
    );
  }

  return (
    <>
      <View pointerEvents="none" style={[styles.fill, { backgroundColor: palette.white }]} />
      <LinearGradient
        pointerEvents="none"
        colors={[...PROFILE_HERO_GRADIENT_LIGHT]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 0.95, y: 0.55 }}
        style={[styles.fill, { opacity: 0.95 }]}
      />
      {/* Neon mesh — duotone drift */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          `${palette.neonPink}00`,
          `${palette.neonPink}16`,
          `${palette.neonSky}14`,
          `${palette.neonPink}06`,
          `${palette.white}00`,
        ]}
        locations={[0, 0.22, 0.48, 0.72, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={[styles.fill, { opacity: 0.92 }]}
      />
      <Animated.View pointerEvents="none" style={[styles.meshAnimated, { opacity: lightMeshOpacity }]}>
        <LinearGradient
          pointerEvents="none"
          colors={[`${palette.bokehViolet}00`, `${palette.neonMint}12`, `${palette.accentBloom}18`, `${palette.white}00`]}
          locations={[0.05, 0.42, 0.68, 1]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.15, y: 0.92 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={['#fffcfb', palette.accentSoft, '#dde6fb']}
        locations={[0, 0.36, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={[styles.fill, { opacity: 0.88 }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, styles.lightOrbs, { transform: [{ translateY: orbLift }] }]}>
        <ExploreLightGlowOrbs />
      </Animated.View>
      <View pointerEvents="none" style={[styles.fill, styles.lightSpeckles]}>
        <OledFluorSpeckles />
      </View>
    </>
  );
}
