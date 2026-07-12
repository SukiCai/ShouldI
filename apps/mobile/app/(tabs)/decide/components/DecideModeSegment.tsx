import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { resolveAppChromatics } from '@/constants/appChromatics';
import { MOTION, usePrefersReducedMotion } from '@/constants/motion';
import { council, palette, profileLight, radius, themeSurface } from '@/constants/theme';

type Props = {
  mode: 'single' | 'complex';
  isDark: boolean;
  isPremium: boolean;
  canAccessCouncil: boolean;
  councilSessionCost: number;
  onSelectSingle: () => void;
  onSelectCouncil: () => void;
};

export function DecideModeSegment({
  mode,
  isDark,
  isPremium,
  canAccessCouncil,
  councilSessionCost,
  onSelectSingle,
  onSelectCouncil,
}: Props) {
  const surface = themeSurface(isDark ? 'dark' : 'light');
  const chrom = resolveAppChromatics(isDark, surface);
  const reducedMotion = usePrefersReducedMotion();
  const [trackWidth, setTrackWidth] = React.useState(0);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const selectionPop = useSharedValue(1);
  const activeIndex = mode === 'complex' ? 1 : 0;

  const moveIndicator = React.useCallback(
    (index: number, width: number, animated: boolean) => {
      if (width < 1) return;
      const gap = 6;
      const horizontalPad = 4;
      const inner = width - horizontalPad * 2;
      const seg = (inner - gap) / 2;
      const x = horizontalPad + index * (seg + gap);
      indicatorW.value = seg;
      if (animated && !reducedMotion) {
        indicatorX.value = withSpring(x, MOTION.tab);
        selectionPop.value = withSequence(
          withSpring(1.04, { damping: 18, stiffness: 420, mass: 0.34 }),
          withSpring(1, MOTION.tab),
        );
      } else {
        indicatorX.value = x;
        selectionPop.value = 1;
      }
    },
    [indicatorW, indicatorX, reducedMotion, selectionPop],
  );

  React.useEffect(() => {
    moveIndicator(activeIndex, trackWidth, true);
  }, [activeIndex, moveIndicator, trackWidth]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setTrackWidth(w);
    moveIndicator(activeIndex, w, false);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorW.value,
    transform: [{ translateX: indicatorX.value }, { scale: selectionPop.value }],
  }));

  const trackBg = isDark ? chrom.tabTrack : palette.field;
  const indicatorColors =
    mode === 'complex'
      ? isDark
        ? ([`${council.violet}55`, `${palette.neonSky}18`] as const)
        : ([`${profileLight.mint}24`, `${council.violet}18`] as const)
      : isDark
        ? ([`${chrom.tabUnderline}44`, `${palette.neonSky}18`] as const)
        : ([`${profileLight.mint}28`, `${profileLight.sky}16`] as const);

  return (
    <View style={[styles.track, { backgroundColor: trackBg }]} onLayout={onTrackLayout}>
      {trackWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              borderColor:
                mode === 'complex'
                  ? isDark
                    ? `${council.violet}66`
                    : `${council.violet}40`
                  : isDark
                    ? `${chrom.tabUnderline}66`
                    : `${profileLight.mint}44`,
            },
            indicatorStyle,
          ]}>
          <LinearGradient colors={indicatorColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
        </Animated.View>
      ) : null}

      <ModeHit
        label="Single"
        active={mode === 'single'}
        activeColor={chrom.tabActive}
        inactiveColor={chrom.tabInactive}
        reducedMotion={reducedMotion}
        onPress={onSelectSingle}
      />
      <ModeHit
        label="Council"
        active={mode === 'complex'}
        activeColor={mode === 'complex' ? (isDark ? palette.neonMint : council.violet) : chrom.tabInactive}
        inactiveColor={chrom.tabInactive}
        reducedMotion={reducedMotion}
        onPress={onSelectCouncil}
        trailing={
          !isPremium && mode !== 'complex' ? (
            <View style={[styles.costPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : profileLight.tabTrack }]}>
              {!canAccessCouncil ? (
                <Ionicons name="lock-closed" size={9} color={chrom.tabInactive} />
              ) : (
                <Text style={[styles.costText, { color: chrom.tabInactive }]}>{councilSessionCost}</Text>
              )}
            </View>
          ) : isPremium && mode === 'complex' ? (
            <Ionicons name="star" size={10} color={isDark ? palette.neonMint : council.violet} />
          ) : null
        }
      />
    </View>
  );
}

function ModeHit({
  label,
  active,
  activeColor,
  inactiveColor,
  reducedMotion,
  onPress,
  trailing,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  reducedMotion: boolean;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  const press = useSharedValue(1);
  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => {
        if (reducedMotion) return;
        press.value = withSpring(MOTION.press.scale, MOTION.tab);
      }}
      onPressOut={() => {
        if (reducedMotion) return;
        press.value = withSpring(1, MOTION.tab);
      }}
      style={styles.hit}>
      <Animated.View style={[styles.pill, shellStyle]}>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: active ? activeColor : inactiveColor, fontWeight: active ? '700' : '500' },
          ]}>
          {label}
        </Text>
        {trailing}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: radius.md,
    minHeight: 40,
    minWidth: 200,
    maxWidth: 280,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  hit: {
    flex: 1,
    zIndex: 1,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 34,
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  costPill: {
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  costText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
