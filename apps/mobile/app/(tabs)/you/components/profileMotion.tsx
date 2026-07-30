import * as Haptics from 'expo-haptics';
import * as React from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { MOTION, usePrefersReducedMotion } from '@/constants/motion';

type HapticKind = 'light' | 'selection' | 'none';

type ProfileSpringPressProps = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: HapticKind;
};

export function profileHaptic(kind: HapticKind = 'light') {
  if (kind === 'none' || Platform.OS === 'web') return;
  if (kind === 'selection') {
    void Haptics.selectionAsync().catch(() => undefined);
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Spring scale press — Quiet Intelligence tactile feedback. */
export function ProfileSpringPress({
  children,
  style,
  haptic = 'light',
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: ProfileSpringPressProps) {
  const reducedMotion = usePrefersReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      {...rest}
      onPress={(event) => {
        if (haptic !== 'none') profileHaptic(haptic);
        onPress?.(event);
      }}
      onPressIn={(event) => {
        if (!reducedMotion) {
          scale.value = withSpring(MOTION.press.scale, MOTION.tab);
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reducedMotion) {
          scale.value = withSpring(1, MOTION.tab);
        }
        onPressOut?.(event);
      }}
      style={styles.pressableShell}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = {
  pressableShell: {
    alignSelf: 'stretch' as const,
  },
};

type ProfileSectionEntranceProps = {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const REVEAL_DELAY_STEP_MS = 55;
const REVEAL_DURATION_MS = 380;

/** Staggered section entrance on profile load. */
export function ProfileSectionEntrance({ index, children, style }: ProfileSectionEntranceProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * REVEAL_DELAY_STEP_MS)
        .duration(REVEAL_DURATION_MS)
        .springify()
        .damping(22)
        .stiffness(280)}
      style={style}>
      {children}
    </Animated.View>
  );
}

type AnimatedProgressBarProps = {
  progress: number;
  trackColor: string;
  fillColor: string;
  height?: number;
};

/** Smooth fill for unlock / progress meters. */
export function AnimatedProgressBar({
  progress,
  trackColor,
  fillColor,
  height = 4,
}: AnimatedProgressBarProps) {
  const reducedMotion = usePrefersReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const [trackWidth, setTrackWidth] = React.useState(0);
  const animatedProgress = useSharedValue(reducedMotion ? clamped : 0);

  React.useEffect(() => {
    if (reducedMotion) {
      animatedProgress.value = clamped;
      return;
    }
    animatedProgress.value = withSpring(clamped, MOTION.tab);
  }, [animatedProgress, clamped, reducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    width: trackWidth * animatedProgress.value,
  }));

  return (
    <Animated.View
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor,
        overflow: 'hidden',
      }}>
      <Animated.View
        style={[
          {
            height,
            borderRadius: height / 2,
            backgroundColor: fillColor,
          },
          fillStyle,
        ]}
      />
    </Animated.View>
  );
}
