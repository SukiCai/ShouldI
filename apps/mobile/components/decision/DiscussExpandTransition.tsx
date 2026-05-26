import * as React from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Matches reel card rounding for a cohesive “same surface growing” feel. */
const CARD_CORNER = 26;
const SCALE_MIN = 0.932;
/** Subtle upward settle — reads less “floating scale” than transform-only. */
const Y_ENTER = 12;
const EXPAND_MS = 400;
/** Brief scrim frames the gesture; fades as the sheet settles. */
const SCRIM_ALPHA = 0.1;

type DiscussExpandTransitionProps = {
  children: React.ReactNode;
};

/**
 * Editorial “surface expands into place” entrance for Discuss.
 * Uses a cubic ease-out curve (smooth, not springy), light scrim lift, gentle vertical settle.
 */
export function DiscussExpandTransition({ children }: DiscussExpandTransitionProps) {
  const t = useSharedValue(0);

  React.useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          t.value = 1;
          return;
        }
        t.value = withTiming(1, {
          duration: EXPAND_MS,
          easing: Easing.bezier(0.22, 0.94, 0.36, 1),
        });
      })
      .catch(() => {
        if (cancelled) return;
        t.value = withTiming(1, {
          duration: EXPAND_MS,
          easing: Easing.out(Easing.cubic),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const scrim = useAnimatedStyle(() => {
    const p = t.value;
    return {
      opacity: (1 - p) * SCRIM_ALPHA,
    };
  });

  const shell = useAnimatedStyle(() => {
    const p = t.value;
    const scale = SCALE_MIN + (1 - SCALE_MIN) * p;
    return {
      flex: 1,
      overflow: 'hidden' as const,
      transform: [{ translateY: (1 - p) * Y_ENTER }, { scale }],
      borderRadius: CARD_CORNER * (1 - p),
      opacity: 0.962 + 0.038 * p,
    };
  });

  return (
    <View style={styles.root}>
      <Animated.View pointerEvents="none" style={[styles.scrim, scrim]} />
      <Animated.View style={[styles.flex, styles.surfaceAbove, shell]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  surfaceAbove: {
    zIndex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#383838',
    zIndex: 0,
  },
});
