import type { DecisionCategory } from '@shouldi/contracts';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import {
  AccessibilityInfo,
  type LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing as REasing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  REEL_CARD_LIQUID_BLOBS,
  REEL_SURFACE_FLARE,
  REEL_SURFACE_GRADIENTS,
  REEL_SURFACE_MAIN_LOCATIONS,
  type LiquidBlobSpec,
} from '@/constants/reelSurfaceGradients';

const PHASE_MS = 22_600;

function useReducedMotion(): boolean {
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

  return reduceMotion;
}

function LiquidOrb({
  spec,
  harmonic,
  backdropW,
  backdropH,
  phase,
  motionEnabled,
}: {
  spec: LiquidBlobSpec;
  harmonic: number;
  backdropW: number;
  backdropH: number;
  phase: SharedValue<number>;
  motionEnabled: boolean;
}) {
  const minSide = Math.min(backdropW, backdropH);
  const gain = spec.motionGain ?? 1;
  const ph0 = spec.phaseOffset ?? harmonic;
  const d = Math.max(64, minSide * spec.relDiameter);
  const cx = spec.ax * backdropW;
  const cy = spec.ay * backdropH;

  const animated = useAnimatedStyle(() => {
    if (!motionEnabled) {
      return {
        opacity: 0.42,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      };
    }

    const p = phase.value * Math.PI * 2;
    const tx =
      gain * Math.sin(p * (0.51 + harmonic * 0.05) + ph0) * (0.086 * minSide + 13);
    const ty =
      gain * Math.cos(p * (0.47 + harmonic * 0.07) + ph0 * 0.85) * (0.097 * minSide + 13);
    const sc = 1 + Math.sin(p * (0.89 + harmonic * 0.05) + ph0 * 0.38) * (0.1 + harmonic * 0.012);
    const op = 0.34 + Math.sin(p * (0.61 + harmonic * 0.04) + ph0 * 1.1) * 0.092;
    return {
      opacity: Math.min(0.54, Math.max(0.2, op)),
      transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
    };
  }, [motionEnabled, minSide, gain, ph0, harmonic]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: cx,
          top: cy,
          width: d,
          height: d,
          marginLeft: -d / 2,
          marginTop: -d / 2,
          borderRadius: d / 2,
          backgroundColor: spec.color,
        },
        animated,
      ]}
    />
  );
}

export function ReelCardLiquidBackdrop({
  category,
}: Readonly<{
  category: DecisionCategory;
}>) {
  const reduceMotion = useReducedMotion();
  const [{ w, h }, setDims] = React.useState({ w: 0, h: 0 });

  const phase = useSharedValue(0);
  const tint = REEL_SURFACE_GRADIENTS[category];
  const flare = REEL_SURFACE_FLARE[category];
  const blobs = REEL_CARD_LIQUID_BLOBS[category];

  React.useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }
    if (w <= 0) return;
    cancelAnimation(phase);
    phase.value = 0;
    phase.value = withRepeat(withTiming(1, { duration: PHASE_MS, easing: REasing.linear }), -1, false);
    return () => cancelAnimation(phase);
  }, [reduceMotion, w, phase]);

  const breathe = useAnimatedStyle(() => {
    const p = phase.value * Math.PI * 2;
    const scale = 1 + 0.026 * Math.sin(p * 0.32);
    return { transform: [{ scale }] };
  });

  const onLayout = React.useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const width = nativeEvent.layout.width;
    const height = nativeEvent.layout.height;
    if (width <= 6 || height <= 6) return;
    setDims((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const motionEnabled = !reduceMotion && w > 0;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}>
      {w <= 0 ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, reduceMotion ? undefined : breathe]}>
          <LinearGradient
            pointerEvents="none"
            colors={[...tint]}
            locations={[...REEL_SURFACE_MAIN_LOCATIONS]}
            start={{ x: 0.02, y: 0 }}
            end={{ x: 1, y: 0.98 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[...flare]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.92, y: 0.88 }}
            style={StyleSheet.absoluteFill}
          />
          {blobs.map((spec, harmonic) => (
            <LiquidOrb
              key={`${category}-blob-${harmonic}`}
              spec={spec}
              harmonic={harmonic}
              backdropW={w}
              backdropH={h}
              phase={phase}
              motionEnabled={motionEnabled}
            />
          ))}
        </Animated.View>
      )}
    </View>
  );
}
