import * as React from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/** Canonical motion tokens — single source for sheets, cards, and press feedback. */
export const MOTION = {
  sheet: { friction: 8, tension: 72 },
  card: { friction: 7, tension: 80 },
  tab: { damping: 24, stiffness: 340, mass: 0.38 },
  press: { scale: 0.985 },
  backdropMs: 220,
  sheetSlideOffset: 420,
  sheetBottomBleed: 56,
} as const;

/** @deprecated Use MOTION.sheet — kept for existing imports during migration. */
export const JUMP_UP_SPRING = MOTION.sheet;
export const JUMP_UP_BACKDROP_MS = MOTION.backdropMs;
export const SHEET_SLIDE_OFFSET = MOTION.sheetSlideOffset;
export const SHEET_BOTTOM_BLEED = MOTION.sheetBottomBleed;

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

export function useJumpUpMotion(open: boolean) {
  const reducedMotion = usePrefersReducedMotion();
  const translateY = React.useRef(new Animated.Value(MOTION.sheetSlideOffset)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!open) return;
    if (reducedMotion) {
      translateY.setValue(0);
      backdropOpacity.setValue(1);
      return;
    }
    translateY.setValue(MOTION.sheetSlideOffset);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: MOTION.backdropMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        ...MOTION.sheet,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, open, reducedMotion, translateY]);

  return { translateY, backdropOpacity };
}
