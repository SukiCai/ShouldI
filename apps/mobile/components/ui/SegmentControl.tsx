import * as React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import type { TextStyle } from 'react-native';

import { MOTION, usePrefersReducedMotion } from '@/constants/motion';
import { selection } from '@/lib/haptics';
import { palette, radius, semantic, typography, type themeSurface } from '@/constants/theme';

const TRACK_PAD = 4;
const SEGMENT_GAP = 4;
const SLIDE_SPRING = MOTION.segmentSlide;
const POP_SPRING = MOTION.segmentPop;

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Per-segment indicator fill; falls back to `indicatorColor` prop. */
  indicatorColor?: string;
  renderLabel?: (state: {
    selected: boolean;
    activeTextColor: string;
    inactiveTextColor: string;
  }) => React.ReactNode;
};

export type SegmentControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  surface: ReturnType<typeof themeSurface>;
  style?: StyleProp<ViewStyle>;
  size?: 'default' | 'compact';
  /** Default indicator fill when options omit `indicatorColor`. */
  indicatorColor?: string;
  /** Allow tapping the active segment again (e.g. toggle off). */
  allowReselect?: boolean;
  disabled?: boolean;
};

const AnimatedText = Animated.createAnimatedComponent(Text);

function resolveIndex<T extends string>(options: readonly SegmentOption<T>[], value: T | null): number {
  if (value === null) return -1;
  const index = options.findIndex((option) => option.value === value);
  return index >= 0 ? index : -1;
}

function indicatorColorsFor<T extends string>(
  options: readonly SegmentOption<T>[],
  fallback: string,
): string[] {
  return options.map((option) => option.indicatorColor ?? fallback);
}

/** Bouncy sliding-pill segmented control — 2+ mutually exclusive options. */
export default function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  surface,
  style,
  size = 'default',
  indicatorColor = semantic.actionPrimary,
  allowReselect = false,
  disabled = false,
}: SegmentControlProps<T>) {
  const reducedMotion = usePrefersReducedMotion();
  const count = options.length;
  const activeIndex = useSharedValue(resolveIndex(options, value));
  const segmentWidth = useSharedValue(0);
  const indicatorPop = useSharedValue(1);
  const indicatorVisible = useSharedValue(value === null ? 0 : 1);
  const mutedColor = surface.textMuted;
  const sheetColor = palette.sheet;
  const indicatorPalette = React.useMemo(
    () => indicatorColorsFor(options, indicatorColor),
    [indicatorColor, options],
  );

  React.useEffect(() => {
    const next = resolveIndex(options, value);
    if (reducedMotion) {
      activeIndex.value = next >= 0 ? next : 0;
      indicatorPop.value = 1;
      indicatorVisible.value = next >= 0 ? 1 : 0;
      return;
    }
    if (next >= 0) {
      activeIndex.value = withSpring(next, SLIDE_SPRING);
      indicatorVisible.value = withSpring(1, SLIDE_SPRING);
      indicatorPop.value = 1;
      indicatorPop.value = withSequence(
        withSpring(1.1, POP_SPRING),
        withSpring(1, SLIDE_SPRING),
      );
      return;
    }
    indicatorVisible.value = withSpring(0, SLIDE_SPRING);
  }, [activeIndex, indicatorPop, indicatorVisible, options, reducedMotion, value]);

  const onTrackLayout = React.useCallback(
    (width: number) => {
      if (count <= 0) {
        segmentWidth.value = 0;
        return;
      }
      segmentWidth.value = (width - TRACK_PAD * 2 - SEGMENT_GAP * (count - 1)) / count;
    },
    [count, segmentWidth],
  );

  const colorInputRange = React.useMemo(
    () => Array.from({ length: count }, (_, index) => index),
    [count],
  );

  const indicatorStyle = useAnimatedStyle(() => {
    const width = segmentWidth.value;
    if (width <= 0 || count <= 0) {
      return {
        opacity: 0,
        width: 0,
        backgroundColor: indicatorColor,
        transform: [{ translateX: TRACK_PAD }, { scale: 1 }],
      };
    }
    const index = Math.max(0, Math.min(count - 1, activeIndex.value));
    const travel = index * (width + SEGMENT_GAP);
    const backgroundColor =
      count === 1
        ? indicatorPalette[0]
        : interpolateColor(index, colorInputRange, indicatorPalette);
    return {
      opacity: indicatorVisible.value,
      width,
      backgroundColor,
      transform: [{ translateX: TRACK_PAD + travel }, { scale: indicatorPop.value }],
    };
  });

  const minHeight = size === 'compact' ? 36 : 40;

  return (
    <View style={[styles.segmentShell, style]}>
      <View
        style={[
          styles.segmentTrack,
          { backgroundColor: surface.groupedSurface, borderColor: surface.hairline },
        ]}
        onLayout={(event) => onTrackLayout(event.nativeEvent.layout.width)}>
        <Animated.View pointerEvents="none" style={[styles.segmentIndicator, indicatorStyle]} />
        {options.map((option, index) => (
          <SegmentButton
            key={option.value}
            option={option}
            index={index}
            selected={option.value === value}
            disabled={disabled || option.disabled}
            minHeight={minHeight}
            activeIndex={activeIndex}
            mutedColor={mutedColor}
            sheetColor={sheetColor}
            reducedMotion={reducedMotion}
            labelStyle={size === 'compact' ? styles.segmentChipLabelCompact : styles.segmentChipLabel}
            onPress={() => {
              if (disabled || option.disabled) return;
              if (option.value === value && !allowReselect) return;
              selection();
              onChange(option.value);
            }}
          />
        ))}
      </View>
    </View>
  );
}

type SegmentButtonProps<T extends string> = {
  option: SegmentOption<T>;
  index: number;
  selected: boolean;
  disabled?: boolean;
  minHeight: number;
  activeIndex: SharedValue<number>;
  mutedColor: string;
  sheetColor: string;
  reducedMotion: boolean;
  labelStyle: TextStyle;
  onPress: () => void;
};

function SegmentButton<T extends string>({
  option,
  index,
  selected,
  disabled,
  minHeight,
  activeIndex,
  mutedColor,
  sheetColor,
  reducedMotion,
  labelStyle,
  onPress,
}: SegmentButtonProps<T>) {
  const pressScale = useSharedValue(1);

  const animatedLabelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(activeIndex.value - index);
    const selectedBlend = Math.max(0, 1 - Math.min(distance, 1));
    return {
      color: interpolateColor(selectedBlend, [0, 1], [mutedColor, sheetColor]),
      opacity: interpolate(selectedBlend, [0, 1], [0.78, 1]),
      transform: [{ scale: interpolate(selectedBlend, [0, 1], [1, 1.06]) }],
    };
  });

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const content =
    option.renderLabel?.({
      selected,
      activeTextColor: sheetColor,
      inactiveTextColor: mutedColor,
    }) ?? (
      <AnimatedText style={[labelStyle, animatedLabelStyle]} numberOfLines={1}>
        {option.label}
      </AnimatedText>
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      disabled={disabled}
      onPressIn={() => {
        if (reducedMotion || disabled) return;
        pressScale.value = withSpring(0.94, POP_SPRING);
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, SLIDE_SPRING);
      }}
      onPress={onPress}
      style={[styles.segmentPress, { minHeight }]}>
      <Animated.View style={[styles.segmentPressInner, pressStyle]}>{content}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segmentShell: {
    paddingVertical: 2,
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: SEGMENT_GAP,
    padding: TRACK_PAD,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    overflow: 'hidden',
  },
  segmentIndicator: {
    position: 'absolute',
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    left: 0,
    borderRadius: radius.pill,
    ...Platform.select({
      ios: {
        shadowColor: semantic.actionPrimary,
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  segmentPress: {
    flex: 1,
    zIndex: 1,
  },
  segmentPressInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentChipLabel: {
    ...typography.compact,
    fontWeight: '700',
  },
  segmentChipLabelCompact: {
    ...typography.micro,
    fontWeight: '700',
  },
});

type SegmentPanelProps = {
  panelKey: string;
  children: React.ReactNode;
};

/** Lightweight cross-fade when segment body swaps — pair with SegmentControl. */
export function SegmentPanel({ panelKey, children }: SegmentPanelProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <View>{children}</View>;
  }

  return (
    <Animated.View
      key={panelKey}
      entering={FadeIn.duration(MOTION.duration.reducedCrossfade)
        .springify()
        .damping(SLIDE_SPRING.damping)
        .stiffness(SLIDE_SPRING.stiffness)}
      exiting={FadeOut.duration(MOTION.duration.micro)}>
      {children}
    </Animated.View>
  );
}
