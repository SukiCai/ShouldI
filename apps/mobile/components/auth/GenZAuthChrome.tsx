import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as React from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { palette, radius, typography } from '@/constants/theme';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

/** White sheet SVG: rounded top + flat-ish bottom + center scoop (shows CTA capsule). */
function notchSheetPath(w: number, h: number, topR: number, notchHalf: number, notchDip: number) {
  const r = Math.min(topR, w / 2 - 1);
  const mid = w / 2;
  const n = Math.min(notchHalf, mid - 40);
  const d = notchDip;
  return [
    `M ${r},0`,
    `H ${w - r}`,
    `Q ${w},0 ${w},${r}`,
    `V ${h}`,
    `H ${mid + n}`,
    `C ${mid + n * 0.5} ${h - d} ${mid - n * 0.5} ${h - d} ${mid - n},${h}`,
    `H 0`,
    `V ${r}`,
    `Q 0,0 ${r},0`,
    `Z`,
  ].join(' ');
}

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
                shadowOpacity: 0.5,
                shadowRadius: size / 4,
              }
            : { elevation: 0 }),
        },
        style,
      ]}
    />
  );
}

function GlowOrbsMist() {
  return (
    <>
      <GlowOrb size={46} bg={`${palette.neonCitron}3a`} blur={palette.neonCitron} style={{ left: '7%', top: '14%' }} />
      <GlowOrb size={44} bg={`${palette.bokehSky}4a`} blur={palette.neonSky} style={{ right: '5%', top: '12%' }} />
      <GlowOrb size={58} bg={`${palette.bokehPink}3d`} blur={palette.neonPink} style={{ left: '2%', top: '38%' }} />
      <GlowOrb size={40} bg={`${palette.bokehMint}4f`} blur={palette.neonMint} style={{ right: '12%', bottom: '32%' }} />
      <GlowOrb size={50} bg={`${palette.bokehViolet}38`} blur={palette.neonPink} style={{ right: '4%', bottom: '8%' }} />
    </>
  );
}

/** Lifted luminous pastels on #000 — clearer / less muddy than dusty bokeh, calmer than full neon. */
const OLED_LUMA_PINK = '#ffb2e8';
const OLED_LUMA_SKY = '#93edff';
const OLED_LUMA_MINT = '#7fffd0';
const OLED_LUMA_LIME = '#e4f299';
const OLED_LUMA_VIOLET = '#e4d9ff';
const OLED_LUMA_TEAL = '#70d8c6';

type OledSpeck = { k: string; z: number; c: string } & (
  | { left: `${number}%`; top: `${number}%` }
  | { right: `${number}%`; top: `${number}%` }
  | { left: `${number}%`; bottom: `${number}%` }
  | { right: `${number}%`; bottom: `${number}%` }
);

/** Tiny solids — same luma ladder as halo rings so the field stays bright-coherent. */
const OLED_FLUOR_SPECKS: readonly OledSpeck[] = [
  { k: 'a', z: 7, c: OLED_LUMA_PINK, left: '8%', top: '12%' },
  { k: 'b', z: 5, c: OLED_LUMA_SKY, left: '5%', top: '34%' },
  { k: 'c', z: 6, c: OLED_LUMA_MINT, right: '10%', top: '11%' },
  { k: 'd', z: 4, c: OLED_LUMA_LIME, right: '6%', top: '29%' },
  { k: 'e', z: 8, c: OLED_LUMA_SKY, left: '13%', top: '50%' },
  { k: 'f', z: 5, c: OLED_LUMA_VIOLET, left: '7%', bottom: '42%' },
  { k: 'g', z: 6, c: OLED_LUMA_MINT, right: '12%', bottom: '34%' },
  { k: 'h', z: 4, c: OLED_LUMA_PINK, right: '8%', bottom: '14%' },
  { k: 'i', z: 5, c: OLED_LUMA_TEAL, left: '24%', bottom: '22%' },
];

function OledFluorSpeckles() {
  return (
    <View style={styles.oledFluorLayer} pointerEvents="none">
      {OLED_FLUOR_SPECKS.map((s) => {
        const { k, z, c, ...pos } = s;
        const r = z / 2;
        return (
          <View
            key={k}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.oledFluorDot,
              pos,
              {
                width: z,
                height: z,
                borderRadius: r,
                backgroundColor: c,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function AvatarFallback() {
  const items = [
    { emoji: '🧑🏽', ring: palette.neonSky, rotate: '-8deg' as const, key: 'a' },
    { emoji: '👩🏻‍🎤', ring: palette.neonPink, rotate: '6deg' as const, key: 'b' },
    { emoji: '👦🏻', ring: palette.neonMint, rotate: '-5deg' as const, key: 'c' },
  ];
  return (
    <View style={styles.avatarRow}>
      {items.map((a, idx) => (
        <View key={a.key} style={[styles.avatarPlate, idx > 0 && styles.avatarOverlap, { transform: [{ rotate: a.rotate }] }]}>
          <LinearGradient colors={[`${a.ring}cc`, `${a.ring}49`]} start={{ x: 0.15, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
            <Text style={styles.avatarEmoji}>{a.emoji}</Text>
          </LinearGradient>
        </View>
      ))}
    </View>
  );
}

function HeroRaster({ heroImage, minHeight }: { heroImage: ImageSourcePropType; minHeight: number }) {
  return (
    <View style={[styles.heroRasterWrap, { minHeight }]}>
      <Image source={heroImage} style={styles.heroRaster} resizeMode="contain" accessibilityIgnoresInvertColors accessibilityLabel="Featured members artwork" />
    </View>
  );
}

type BreathPreset = {
  breathMs: number;
  scaleMin: number;
  scaleMax: number;
};

export type HeroMotionTier = 'standard' | 'premium';

/** Idle breathing — baseline before tier tuning. */
const HERO_CLUSTER_BREATH: BreathPreset[] = [
  { breathMs: 2_720, scaleMin: 0.974, scaleMax: 1.022 },
  { breathMs: 3_080, scaleMin: 0.97, scaleMax: 1.026 },
  { breathMs: 2_480, scaleMin: 0.978, scaleMax: 1.018 },
  { breathMs: 3_340, scaleMin: 0.971, scaleMax: 1.024 },
  { breathMs: 2_660, scaleMin: 0.975, scaleMax: 1.021 },
  { breathMs: 2_910, scaleMin: 0.972, scaleMax: 1.027 },
  { breathMs: 3_420, scaleMin: 0.969, scaleMax: 1.024 },
];

function heroClusterBreathForIndex(index: number): BreathPreset {
  return HERO_CLUSTER_BREATH[index % HERO_CLUSTER_BREATH.length]!;
}

function breathForTier(base: BreathPreset, tier: HeroMotionTier): BreathPreset {
  if (tier !== 'premium') return base;
  return {
    breathMs: Math.round(base.breathMs * 0.88),
    scaleMin: Math.max(0.88, base.scaleMin - 0.055),
    scaleMax: Math.min(1.09, base.scaleMax + 0.05),
  };
}

/** Lissajous-style floats — amplitudes stay small vs fixed layout so disks don’t clip each other badly. */
const SIGNUP_FLOAT_PRESETS = [
  { ampX: 6.9, ampY: 5.3, xMs: 8_800, yMs: 10_900, staggerMs: 0 },
  { ampX: 5.4, ampY: 7.1, xMs: 10_600, yMs: 8_900, staggerMs: 140 },
  { ampX: 7.6, ampY: 4.9, xMs: 9_900, yMs: 9_900, staggerMs: 60 },
  { ampX: 5.9, ampY: 6.9, xMs: 8_900, yMs: 9_900, staggerMs: 200 },
  { ampX: 6.7, ampY: 5.9, xMs: 9_450, yMs: 10_050, staggerMs: 320 },
  { ampX: 5.9, ampY: 6.9, xMs: 9_880, yMs: 9_760, staggerMs: 180 },
  { ampX: 6.35, ampY: 6.05, xMs: 9_670, yMs: 9_790, staggerMs: 260 },
];

/**
 * Packed circle centers — OLED auth reference: **triangle** ◁ three busts ◁ pastel rings.
 */
type SwarmSlot = { cx: number; cy: number; diameter: number };

/** Pre-scale ◁ OLED layout — size contrast; **top-left disk is largest** (visual anchor).
 * Centers nudged ~7% toward triangle centroid — rings read a hair tighter together. */
const OLED_TRI_BASE: SwarmSlot[] = [
  { cx: 90, cy: 57, diameter: 132 },
  { cx: 244, cy: 59, diameter: 106 },
  { cx: 168, cy: 180, diameter: 120 },
];

const OLED_TRI_MAG = 1.125;

function scaleOrb(s: SwarmSlot, mag: number): SwarmSlot {
  return {
    cx: s.cx * mag,
    cy: s.cy * mag,
    diameter: s.diameter * mag,
  };
}

/** Three-orbit seats — matches ref: pink / icy blue / mint. */
function swarmExtents(slots: SwarmSlot[]): { w: number; h: number } {
  let minL = Infinity;
  let minT = Infinity;
  let maxR = 0;
  let maxB = 0;
  for (const s of slots) {
    const l = s.cx - s.diameter / 2;
    const t = s.cy - s.diameter / 2;
    const r = s.cx + s.diameter / 2;
    const b = s.cy + s.diameter / 2;
    minL = Math.min(minL, l);
    minT = Math.min(minT, t);
    maxR = Math.max(maxR, r);
    maxB = Math.max(maxB, b);
  }
  const pad = 14;
  return { w: Math.ceil(maxR - minL + pad * 2), h: Math.ceil(maxB - minT + pad * 2) };
}

const OLED_TRI_SLOTS = OLED_TRI_BASE.map((s) => scaleOrb(s, OLED_TRI_MAG));
const OLED_TRIANGLE_BOUNDS = swarmExtents(OLED_TRI_SLOTS);

/** Triangle halos · bright-coherent luminous pastels. */
const OLED_TRI_RINGS = [OLED_LUMA_PINK, OLED_LUMA_SKY, OLED_LUMA_MINT] as const;

const OLED_TRI_TILTS = ['-10deg', '8deg', '-5deg'] as const;

const SWARM_ENTER_MS = 1_060;
/** How far outside the arena circles begin their approach (pixels, pre-scale). */
const SWARM_APPROACH_RADIUS = 228;
const SWARM_BREATH_EASE = Easing.inOut(Easing.sin);

/** Inner photo diameter — thin scatter ring only; portrait sits close to the outer disk rim. */
function swarmInnerDiameter(outer: number) {
  const ringPad = Math.max(5, Math.min(9, Math.round(outer * 0.046)));
  const target = outer - ringPad;
  return Math.min(outer - 4, Math.max(40, target));
}

/**
 * Larger layout quad + `resizeMode cover` pulls **sharp** sprites into the halo.
 * (**Avoid `transform: { scale }` on `Image`** — RN often interpolates softened.)
 *
 * `PAN_DOWN` nudges hips / legs toward the bottom arc (keep **≤ `(LAYOUT_SCALE - 1) / 2`** so portals don’t show empty wedges).
 */
const HERO_AVATAR_SPRITE_LAYOUT_SCALE = 1.3;
const HERO_AVATAR_PAN_DOWN_FRAC = 0.062;

/** Tint behind cropped photo — slightly richer veil so rings read lively on OLED. */
function clipBackdropForRing(ringHex: string, premium: boolean) {
  const a = premium ? '2e' : '26';
  return `${ringHex}${a}`;
}

const GOLDEN_ANGLE_LIFT = 0.713;

function heroSwarmEnterAngle(total: number, index: number) {
  return (Math.PI * 2 * index) / total + index * GOLDEN_ANGLE_LIFT + (index % 2 === 0 ? -0.11 : 0.14);
}

function swarmStaticTiltStyle(rotation: string): Pick<ViewStyle, 'transform'> {
  return { transform: [{ rotate: rotation }] };
}

function AnimatedCircularAvatarOrb({
  source,
  index,
  ringColor,
  rotation,
  layoutLeft,
  layoutTop,
  diameter,
  approachBx,
  approachBy,
  enterDelayMs,
  motionTier,
}: {
  source: ImageSourcePropType;
  index: number;
  ringColor: string;
  rotation: string;
  layoutLeft: number;
  layoutTop: number;
  diameter: number;
  approachBx: number;
  approachBy: number;
  enterDelayMs: number;
  motionTier: HeroMotionTier;
}) {
  const reducedMotion = useReducedMotion();
  const bp = breathForTier(heroClusterBreathForIndex(index), motionTier);
  const floatCfg = React.useMemo(() => SIGNUP_FLOAT_PRESETS[index % SIGNUP_FLOAT_PRESETS.length]!, [index]);
  const neonPopStyling = motionTier === 'premium';
  /** Float drift only when tier is premium **and** reduced motion off (layout still clears neighbors). */
  const floatAmpX = motionTier === 'premium' && !reducedMotion ? floatCfg.ampX : 0;
  const floatAmpY = motionTier === 'premium' && !reducedMotion ? floatCfg.ampY : 0;

  const enter = useSharedValue(reducedMotion ? 1 : 0);
  const breath = useSharedValue(0);
  const fx = useSharedValue(0.5);
  const fy = useSharedValue(0.5);

  React.useEffect(() => {
    cancelAnimation(breath);
    cancelAnimation(enter);
    cancelAnimation(fx);
    cancelAnimation(fy);
    if (reducedMotion) {
      enter.value = 1;
      breath.value = 0;
      fx.value = 0.5;
      fy.value = 0.5;
      return;
    }
    enter.value = 0;
    breath.value = 0;

    breath.value = withDelay(
      enterDelayMs + Math.round(SWARM_ENTER_MS * 0.48),
      withRepeat(withTiming(1, { duration: bp.breathMs, easing: SWARM_BREATH_EASE }), -1, true),
    );
    enter.value = withDelay(enterDelayMs, withTiming(1, { duration: SWARM_ENTER_MS, easing: Easing.out(Easing.cubic) }));

    if (motionTier === 'premium') {
      const { xMs, yMs, staggerMs } = floatCfg;
      fx.value = withDelay(
        staggerMs + enterDelayMs,
        withRepeat(withTiming(1, { duration: xMs, easing: SWARM_BREATH_EASE }), -1, true),
      );
      fy.value = withDelay(
        staggerMs + enterDelayMs + 320,
        withRepeat(withTiming(1, { duration: yMs, easing: SWARM_BREATH_EASE }), -1, true),
      );
    } else {
      fx.value = 0.5;
      fy.value = 0.5;
    }

    return () => {
      cancelAnimation(enter);
      cancelAnimation(breath);
      cancelAnimation(fx);
      cancelAnimation(fy);
    };
  }, [reducedMotion, motionTier, bp.breathMs, breath, enter, enterDelayMs, fx, fy, floatCfg]);

  const sMin = bp.scaleMin;
  const sMax = bp.scaleMax;

  const animatedStyle = useAnimatedStyle(() => {
    const ramp = interpolate(enter.value, [0.42, 0.93], [0, 1], Extrapolation.CLAMP);
    const bx = interpolate(enter.value, [0, 1], [approachBx, 0], Extrapolation.CLAMP);
    const by = interpolate(enter.value, [0, 1], [approachBy, 0], Extrapolation.CLAMP);
    const dx = ramp * interpolate(fx.value, [0, 1], [-floatAmpX, floatAmpX], Extrapolation.CLAMP);
    const dy = ramp * interpolate(fy.value, [0, 1], [-floatAmpY, floatAmpY], Extrapolation.CLAMP);

    return {
      transform: [
        { translateX: bx + dx },
        { translateY: by + dy },
        { rotate: rotation },
        { scale: interpolate(breath.value, [0, 1], [sMin, sMax], Extrapolation.CLAMP) },
      ],
    };
  });

  const inner = swarmInnerDiameter(diameter);
  const rOuter = diameter / 2;
  const rInner = inner / 2;
  const spriteBox = inner * HERO_AVATAR_SPRITE_LAYOUT_SCALE;
  const spriteLeft = (inner - spriteBox) / 2;
  const spriteTop = (inner - spriteBox) / 2 + inner * HERO_AVATAR_PAN_DOWN_FRAC;
  const clipTint = clipBackdropForRing(ringColor, neonPopStyling);
  /** Unique gradient id across disks; alphanumeric only (hyphens break url(#…) on some parsers). */
  const scatterGradId = `orbScatter${index}`;

  const orbPeripheralGlow = Platform.select({
    ios: {
      shadowColor: ringColor,
      shadowOpacity: neonPopStyling ? 0.58 : 0.46,
      shadowRadius: neonPopStyling ? 42 : 32,
      shadowOffset: { width: 0, height: 0 },
    },
    android: {},
    default: {},
  });

  /** Outer ring only — avoids `Svg` full-disk layers painting above `Image` on some platforms. Center shows photo. */
  const cx = rOuter;
  const cy = rOuter;
  const ro = rOuter;
  const ri = rInner;
  const scatterRingD =
    `M ${cx - ro},${cy} a ${ro},${ro} 0 1 1 ${2 * ro},0 a ${ro},${ro} 0 1 1 ${-2 * ro},0 ` +
    `M ${cx - ri},${cy} a ${ri},${ri} 0 1 0 ${2 * ri},0 a ${ri},${ri} 0 1 0 ${-2 * ri},0`;

  const faceOrb = (
    <View
      pointerEvents="none"
      style={[
        orbPeripheralGlow,
        {
          width: diameter,
          height: diameter,
          borderRadius: rOuter,
        },
      ]}>
      <View
        style={{
          width: diameter,
          height: diameter,
          borderRadius: rOuter,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: `${ringColor}e4`,
          backgroundColor: ringColor,
          position: 'relative',
        }}>
          <View
            collapsable={false}
            style={{
              position: 'absolute',
              left: (diameter - inner) / 2,
              top: (diameter - inner) / 2,
              width: inner,
              height: inner,
              borderRadius: rInner,
              overflow: 'hidden',
              backgroundColor: clipTint,
              borderWidth: 1,
              borderColor: `${ringColor}92`,
              zIndex: 1,
            }}>
            <Image
              source={source}
              style={{
                position: 'absolute',
                left: spriteLeft,
                top: spriteTop,
                width: spriteBox,
                height: spriteBox,
              }}
              resizeMode="cover"
              resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
              accessibilityIgnoresInvertColors
              accessibilityLabel={`Avatar ${index + 1}`}
            />
          </View>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { zIndex: 2 }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Svg width={diameter} height={diameter}>
              <Defs>
                {neonPopStyling ? (
                  <RadialGradient
                    id={scatterGradId}
                    cx="50%"
                    cy="50%"
                    r="72%"
                    fx="50%"
                    fy="48%"
                    gradientUnits="objectBoundingBox">
                    <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.78} />
                    <Stop offset="28%" stopColor="#ffffff" stopOpacity={0.38} />
                    <Stop offset="56%" stopColor={ringColor} stopOpacity={0.62} />
                    <Stop offset="100%" stopColor={ringColor} stopOpacity={0.42} />
                  </RadialGradient>
                ) : (
                  <RadialGradient
                    id={scatterGradId}
                    cx="50%"
                    cy="50%"
                    r="72%"
                    fx="50%"
                    fy="48%"
                    gradientUnits="objectBoundingBox">
                    <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.58} />
                    <Stop offset="34%" stopColor="#ffffff" stopOpacity={0.22} />
                    <Stop offset="62%" stopColor={ringColor} stopOpacity={0.58} />
                    <Stop offset="100%" stopColor={ringColor} stopOpacity={0.38} />
                  </RadialGradient>
                )}
              </Defs>
              <Path fillRule="evenodd" d={scatterRingD} fill={`url(#${scatterGradId})`} />
            </Svg>
          </View>
      </View>
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.charOrbSeat, { left: layoutLeft, top: layoutTop, width: diameter, height: diameter, zIndex: index + 3 }]}>
      {!reducedMotion ? (
        <Animated.View style={[animatedStyle, styles.charOrbStack, { width: diameter, height: diameter }]}>
          <View style={styles.charPlate}>{faceOrb}</View>
        </Animated.View>
      ) : (
        <View style={[styles.charOrbStack, { width: diameter, height: diameter }]}>
          <View style={[styles.charPlate, swarmStaticTiltStyle(rotation)]}>{faceOrb}</View>
        </View>
      )}
    </View>
  );
}

const OLED_CLUSTER_FACE_COUNT = 3;

/** Triangle hero · radial fly-in. `premium` adds buoyant drift. */
function HeroCircularCluster({ sources, motionTier }: { sources: ImageSourcePropType[]; motionTier: HeroMotionTier }) {
  const faces = sources.slice(0, OLED_CLUSTER_FACE_COUNT);
  const n = faces.length;
  if (n === 0) return null;

  /* Slightly tighter margins + allow mild overshoot on wide screens → larger overall orbs */
  const swarmScale = Math.min(1.04, (SCREEN_W - 40) / (OLED_TRIANGLE_BOUNDS.w + 24));

  const { arenaWidth, scaledSlots, slotShiftX } = React.useMemo(() => {
    const slots = OLED_TRI_SLOTS.slice(0, n).map((slot) => ({
      cx: slot.cx * swarmScale,
      cy: slot.cy * swarmScale,
      diameter: slot.diameter * swarmScale,
    }));
    const aw = OLED_TRIANGLE_BOUNDS.w * swarmScale + 8;

    let minLX = Infinity;
    let maxRX = -Infinity;
    for (const s of slots) {
      minLX = Math.min(minLX, s.cx - s.diameter / 2);
      maxRX = Math.max(maxRX, s.cx + s.diameter / 2);
    }
    const clusterMidX = (minLX + maxRX) / 2;
    const dx = aw / 2 - clusterMidX;

    return {
      arenaWidth: aw,
      scaledSlots: slots,
      slotShiftX: dx,
    };
  }, [n, swarmScale]);

  return (
    <View style={[styles.avatarRowFloating]}>
      <View
        style={[
          styles.avatarSwarmArena,
          {
            width: arenaWidth,
            minHeight: OLED_TRIANGLE_BOUNDS.h * swarmScale + 16,
          },
        ]}>
        {faces.map((src, idx) => {
          const slot = scaledSlots[idx];
          if (!slot) return null;
          const { cx, cy, diameter } = slot;
          const θ = heroSwarmEnterAngle(n, idx);
          return (
            <AnimatedCircularAvatarOrb
              key={`avatar-${idx}`}
              source={src}
              index={idx}
              ringColor={OLED_TRI_RINGS[idx]!}
              rotation={OLED_TRI_TILTS[idx]!}
              layoutLeft={cx - diameter / 2 + slotShiftX}
              layoutTop={cy - diameter / 2}
              diameter={diameter}
              approachBx={Math.cos(θ) * SWARM_APPROACH_RADIUS * swarmScale}
              approachBy={Math.sin(θ) * SWARM_APPROACH_RADIUS * swarmScale}
              enterDelayMs={idx * 118}
              motionTier={motionTier}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Light frosted badge (mist hero) — readable rim + visible fashion tint vs hero. */
const glassBadgeMist = Platform.select({
  ios: {
    borderWidth: 1,
    borderColor: 'rgba(255,120,178,0.52)',
    backgroundColor: 'rgba(246,249,253,0.58)',
    shadowColor: '#4a3558',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 9 },
  },
  android: {
    borderWidth: 1,
    borderColor: 'rgba(242,142,206,0.58)',
    backgroundColor: 'rgba(246,249,253,0.62)',
    elevation: 3,
  },
  default: {},
});

/** OLED chip — frost reads from **backdrop blur**; tint + hairline mimic reference capsule. */
const glassBadgeOled = Platform.select({
  ios: {
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 4, height: 14 },
  },
  android: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'transparent',
    elevation: 6,
  },
  default: {},
});

export type SwipeAlternateOpts = {
  pathname: '/sign-in' | '/sign-up';
  /** Sign-up surface: swipe *up*. Sign-in surface: swipe *down* back to Sign-up — matches carousel mental model */
  direction: 'up' | 'down';
};

type GenZAuthChromeProps = {
  appearance?: 'mist' | 'oled';
  headline: string;
  subtitle?: string;
  heroBadge: string;
  /** Optional PNG illustration (three avatars artwork). Falls back to emoji cluster when omitted. */
  heroImage?: ImageSourcePropType;
  /** Raster neon-ring avatar swarm (`constants/users`). */
  heroAvatars?: ImageSourcePropType[];
  /** OLED hero choreography — `premium` adds brighter halos + Lissajous float. */
  heroMotion?: HeroMotionTier;
  sheetHeader: React.ReactNode;
  children: React.ReactNode;
  tertiaryRow?: React.ReactNode;
  footerCtaLabel: string;
  footerSubtitle?: string;
  footerCtaAccessibilityLabel?: string;
  onFooterPress: () => void;
  slideHint?: React.ReactNode;
  /** Swiping the capsule / notch swaps auth surface (animated route replace). */
  swipeAlternate?: SwipeAlternateOpts;
  scrollBottomPad?: number;
  style?: StyleProp<ViewStyle>;
};

export function GenZAuthChrome({
  appearance = 'mist',
  headline,
  subtitle,
  heroBadge,
  heroImage,
  heroAvatars,
  heroMotion = 'standard',
  sheetHeader,
  children,
  tertiaryRow,
  footerCtaLabel,
  footerSubtitle,
  footerCtaAccessibilityLabel,
  onFooterPress,
  slideHint,
  swipeAlternate,
  scrollBottomPad = 100,
  style,
}: GenZAuthChromeProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const oled = appearance === 'oled';
  /** ~55% sheet */
  const sheetMinH = Math.max(392, Math.round(SCREEN_H * 0.52));
  const topR = 46;
  const notchHalf = Math.min(92, SCREEN_W * 0.22);
  const notchDip = 36;
  const ctaBump = notchDip + 18;
  const footerReserve = ctaBump + 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 8);

  const path = notchSheetPath(SCREEN_W, sheetMinH, topR, notchHalf, notchDip);

  const panResponder = React.useMemo(
    () =>
      swipeAlternate == null
        ? null
        : PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gesture) =>
              swipeAlternate.direction === 'up'
                ? gesture.dy < -10 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
                : gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
            onPanResponderTerminationRequest: () => true,
            onPanResponderRelease: (_, g) => {
              if (!swipeAlternate) return;
              const fast = swipeAlternate.direction === 'up' ? g.vy < -1.05 : g.vy > 1.05;
              const far =
                swipeAlternate.direction === 'up'
                  ? g.dy < -(Platform.OS === 'ios' ? 52 : 60)
                  : g.dy > (Platform.OS === 'ios' ? 52 : 60);
              if (!(far || fast)) return;
              void bumpHaptic(Haptics.ImpactFeedbackStyle.Light);
              Keyboard.dismiss();
              router.replace(swipeAlternate.pathname);
            },
          }),
    [router, swipeAlternate],
  );

  return (
    <View style={[styles.root, oled && styles.rootOled, style]}>
      <StatusBar style={oled ? 'light' : 'dark'} />

      {oled ? (
        <>
          <View style={[StyleSheet.absoluteFill, styles.oledBase]} />
          <OledFluorSpeckles />
        </>
      ) : (
        <>
          <View style={[StyleSheet.absoluteFill, styles.mistBase]} />
          <LinearGradient
            colors={[palette.mist, `${palette.accentSoft}b3`, palette.mist]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.mistWash}
            pointerEvents="none"
          />
          <GlowOrbsMist />
        </>
      )}

      {!oled ? (
        <View pointerEvents="none" style={[styles.ctaGlow, { bottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.ctaGlowInner} />
        </View>
      ) : null}

      {/* CTA tucked under scoop — OLED uses flat black capsule like reference */}
      <View {...(panResponder ? panResponder.panHandlers : {})} pointerEvents="box-none" style={[styles.ctaDock, { bottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={footerCtaAccessibilityLabel ?? footerCtaLabel}
          accessibilityHint={
            footerSubtitle ?? (swipeAlternate ? 'Swipe on the capsule to flip between Sign up and Sign in' : undefined)
          }
          onPress={() => {
            void bumpHaptic(Haptics.ImpactFeedbackStyle.Medium);
            onFooterPress();
          }}
          style={({ pressed }) => [
            styles.ctaPress,
            oled ? styles.ctaPressOled : null,
            pressed && { opacity: oled ? 0.93 : 0.96, transform: [{ scale: oled ? 0.988 : 0.985 }] },
          ]}>
          {oled ? (
            <View style={styles.ctaSolid}>
              <View style={{ flexShrink: 1, alignItems: 'center', width: '100%' }}>
                <Text style={[styles.ctaLabel, styles.ctaLabelOled]}>{footerCtaLabel}</Text>
                {slideHint ? <Text style={styles.ctaSwipeHint}>{slideHint}</Text> : null}
                {footerSubtitle ? <Text style={styles.ctaSubtitleOled}>{footerSubtitle}</Text> : null}
              </View>
            </View>
          ) : (
            <LinearGradient
              colors={['#0a0d12', palette.heroInk, '#131820']}
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.ctaLabel}>{footerCtaLabel}</Text>
                {footerSubtitle ? <Text style={styles.ctaSubtitle}>{footerSubtitle}</Text> : null}
              </View>
              <LinearGradient
                colors={[`${palette.neonMint}b8`, palette.neonMint]}
                style={styles.ctaArrowGlow}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}>
                <Ionicons name="chevron-forward" size={21} color={palette.heroInk} />
              </LinearGradient>
            </LinearGradient>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, zIndex: 24 }}
        pointerEvents="box-none">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          pointerEvents="box-none"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: footerReserve + 8, paddingTop: Math.max(insets.top, 10) + 46 },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.heroCluster}>
            <View
              style={[
                styles.heroInner,
                (heroAvatars?.length ?? 0) >= 3 || heroImage ? styles.heroInnerTall : null,
              ]}>
              {(heroAvatars?.length ?? 0) >= 3 ? (
                <HeroCircularCluster sources={heroAvatars ?? []} motionTier={heroMotion} />
              ) : heroImage ? (
                <HeroRaster heroImage={heroImage} minHeight={228} />
              ) : (
                <AvatarFallback />
              )}
              {heroBadge.trim() ? (
                <View
                  style={[
                    styles.heroBadgeOuter,
                    oled ? glassBadgeOled : glassBadgeMist,
                    oled && (heroAvatars?.length ?? 0) >= 3 ? styles.heroBadgeOledTriangle : null,
                  ]}>
                  {oled ? (
                    <>
                      {Platform.OS === 'web' ? (
                        <View
                          pointerEvents="none"
                          style={[styles.heroBadgeBlurPlate, styles.heroBadgeFrostFallbackWeb]}
                        />
                      ) : (
                        <BlurView
                          pointerEvents="none"
                          tint="dark"
                          intensity={Platform.OS === 'ios' ? 78 : 92}
                          style={styles.heroBadgeBlurPlate}
                          {...(Platform.OS === 'android'
                            ? ({
                                experimentalBlurMethod: 'dimezisBlurView',
                                blurReductionFactor: 5,
                              } as const)
                            : {})}
                        />
                      )}
                      <View pointerEvents="none" style={styles.heroBadgeFrostTint} />
                      <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.02)', 'rgba(14,14,26,0.5)']}
                        locations={[0, 0.42, 1]}
                        start={{ x: 0.12, y: 0 }}
                        end={{ x: 0.88, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                        locations={[0, 1]}
                        start={{ x: 0.25, y: 0 }}
                        end={{ x: 0.65, y: 0.55 }}
                        style={styles.heroBadgeTopSheenFrost}
                      />
                      <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.heroBadgeFrostHairline}
                      />
                    </>
                  ) : (
                    <>
                      <LinearGradient
                        pointerEvents="none"
                        colors={[
                          'rgba(255,248,252,0.9)',
                          'rgba(244,232,248,0.68)',
                          'rgba(232,242,252,0.82)',
                        ]}
                        locations={[0, 0.48, 1]}
                        start={{ x: 0.08, y: 0 }}
                        end={{ x: 0.92, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <LinearGradient
                        pointerEvents="none"
                        colors={[
                          'rgba(255,204,228,0.58)',
                          'rgba(230,248,255,0.4)',
                          'rgba(240,252,255,0.22)',
                        ]}
                        locations={[0, 0.55, 1]}
                        start={{ x: 0.12, y: 0 }}
                        end={{ x: 0.88, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <LinearGradient
                        pointerEvents="none"
                        colors={[`${palette.neonPink}f5`, `${palette.bokehViolet}ef`, `${palette.neonSky}f2`]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.heroBadgeLeftAccent}
                      />
                      <LinearGradient
                        pointerEvents="none"
                        colors={[
                          'rgba(255,255,255,0)',
                          'rgba(255,77,148,0.85)',
                          'rgba(94,228,255,0.78)',
                          'rgba(255,255,255,0)',
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.heroBadgeBottomGleam}
                      />
                      <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
                        locations={[0, 1]}
                        start={{ x: 0.3, y: 0 }}
                        end={{ x: 0.7, y: 0.55 }}
                        style={styles.heroBadgeTopSheen}
                      />
                    </>
                  )}
                  <Text style={[styles.heroBadgeTxt, oled ? styles.heroBadgeTxtOled : null]}>{heroBadge}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.heroHeadlineSpacer}>
            <View style={styles.titleBlock}>
              <Text style={[styles.heroTitle, oled ? styles.heroTitleOled : null]}>{headline}</Text>
              {subtitle ? <Text style={[styles.heroSub, oled ? styles.heroSubOled : null]}>{subtitle}</Text> : null}
            </View>
          </View>

          <View style={[styles.sheetStack, { minHeight: sheetMinH }]}>
            <Svg width={SCREEN_W} height={sheetMinH} pointerEvents="none" style={styles.sheetSvg}>
              <Path d={path} fill={palette.sheet} />
            </Svg>
            <View style={styles.sheetInner}>
              <View style={styles.sheetInset}>{sheetHeader}</View>
              <View style={[styles.sheetInset, styles.sheetForm]}>{children}</View>
              {tertiaryRow ? <View style={styles.sheetInset}>{tertiaryRow}</View> : null}
              <View style={{ height: scrollBottomPad }} pointerEvents="none" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.chromeOverlay, { paddingTop: insets.top, zIndex: 40 }]} pointerEvents="box-none">
        {router.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => {
              void bumpHaptic();
              router.back();
            }}
            style={({ pressed }) => [
              styles.backChip,
              oled && styles.backChipOled,
              pressed && styles.backChipPressed,
            ]}>
            <Ionicons name="chevron-back" size={22} color={oled ? '#fdfefe' : palette.heroInk} />
          </Pressable>
        ) : (
          <View style={styles.backSlot} />
        )}
      </View>
    </View>
  );
}

async function bumpHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  try {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(style);
    }
  } catch {
    /* optional */
  }
}

export const AuthFields = StyleSheet.create({
  linkRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
    marginTop: 4,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
  },
  muted: {
    ...typography.compact,
    color: palette.slate500,
    textAlign: 'center',
    fontWeight: '500',
  },
  boldLink: {
    ...typography.compact,
    fontWeight: '900',
    color: palette.heroInk,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
    marginBottom: 14,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minWidth: 102,
    backgroundColor: '#eceef2',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 56,
    borderWidth: 0,
  },
  countryEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  countryCode: {
    ...typography.compact,
    fontWeight: '800',
    color: palette.heroInk,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  controlFocused: Platform.select({
    ios: {
      borderWidth: 0,
      backgroundColor: palette.sheet,
      shadowColor: palette.neonMint,
      shadowOpacity: 0.28,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
    },
    android: {
      borderWidth: 0,
      backgroundColor: palette.sheet,
      elevation: 2,
    },
    default: {
      borderWidth: 0,
      backgroundColor: palette.sheet,
    },
  }),
  inputPill: {
    flex: 1,
    backgroundColor: '#eceef2',
    borderRadius: radius.pill,
    minHeight: 56,
    paddingHorizontal: 18,
    borderWidth: 0,
    justifyContent: 'center',
    position: 'relative',
  },
  pwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 54,
  },
  pwdInput: {
    flex: 1,
    ...typography.body,
    fontSize: 17,
    color: palette.slate950,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'ios' ? 16 : 11,
    minHeight: 50,
    letterSpacing: Platform.OS === 'ios' ? 0.02 : 0,
  },
  tertiaryCenter: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  tertiaryBold: {
    ...typography.compact,
    fontWeight: '800',
    color: palette.heroInk,
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.mist,
    overflow: 'hidden',
  },
  rootOled: {
    backgroundColor: '#000000',
  },
  mistBase: {
    backgroundColor: palette.mist,
    zIndex: 0,
  },
  mistWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: SCREEN_H,
    opacity: 0.65,
    zIndex: 0,
  },
  oledBase: {
    backgroundColor: '#000000',
    zIndex: 0,
  },
  /** Solid micro-fluor accents (under hero; above black slab). */
  oledFluorLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: 'hidden',
  },
  oledFluorDot: {
    position: 'absolute',
  },
  chromeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    zIndex: 30,
    pointerEvents: 'box-none',
  },
  backSlot: {
    width: 44,
    height: 44,
  },
  backChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.heroInk}10`,
    marginLeft: -2,
  },
  backChipOled: {
    backgroundColor: 'rgba(15,17,21,0.55)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  backChipPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroCluster: {
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 2,
    width: '100%',
  },
  /** Headline hugs avatars · symmetric modest pad below before sheet */
  heroHeadlineSpacer: {
    width: '100%',
    alignItems: 'center',
    marginTop: -34,
    paddingTop: 0,
    paddingBottom: 18,
    paddingHorizontal: 20,
    zIndex: 2,
  },
  heroInner: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  heroInnerTall: {
    minHeight: 298,
    paddingTop: 4,
    overflow: 'visible',
  },
  heroRasterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  heroRaster: {
    width: SCREEN_W * 0.9,
    maxWidth: 420,
    height: 246,
    maxHeight: 280,
    alignSelf: 'center',
  },
  titleBlock: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 10,
    maxWidth: 340,
    paddingHorizontal: 4,
    width: '100%',
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: palette.slate950,
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 340,
    width: '100%',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroTitleOled: {
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 1 },
  },
  heroSub: {
    ...typography.compact,
    color: palette.slate800,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    paddingHorizontal: 8,
    opacity: 0.88,
    maxWidth: 280,
  },
  heroSubOled: {
    color: 'rgba(247,247,247,0.58)',
    opacity: 1,
  },
  orbBase: {
    position: 'absolute',
    opacity: Platform.OS === 'android' ? 0.88 : 0.98,
    zIndex: 0,
  },
  avatarSwarmArena: {
    position: 'relative',
    overflow: 'visible',
    alignSelf: 'center',
    zIndex: 1,
    marginTop: 2,
  },
  charOrbSeat: {
    position: 'absolute',
    overflow: 'visible',
  },
  charOrbStack: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 2,
    zIndex: 1,
    paddingHorizontal: 10,
  },
  avatarRowFloating: {
    overflow: 'visible',
    width: '100%',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 2,
    minHeight: 200,
    alignSelf: 'stretch',
  },
  avatarOverlap: {
    marginLeft: -26,
    zIndex: 1,
  },
  charPlate: {
    zIndex: 4,
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.5 : 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    ...Platform.select({
      android: { elevation: 10 },
      default: {},
    }),
  },
  charRingGlow: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    borderWidth: 0,
  },
  charRingGlowPremium: {
    borderWidth: 0,
  },
  charClipInner: {
    overflow: 'hidden',
    borderWidth: 0,
  },
  avatarPlate: {
    zIndex: 2,
    shadowColor: palette.heroInk,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  avatarRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.96)',
    backgroundColor: 'rgba(248,249,251,0.98)',
    overflow: 'hidden',
  },
  avatarEmoji: {
    fontSize: 42,
    lineHeight: 48,
  },
  heroBadgeOuter: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    zIndex: 14,
    marginTop: -18,
    overflow: 'hidden',
    /** Editorial chip: asymmetric radii + attitude tilt */
    borderTopLeftRadius: 28,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 26,
    borderBottomLeftRadius: 18,
    transform: [{ translateY: 15 }, { rotateZ: '-7deg' }, { skewX: '7deg' }],
    paddingHorizontal: 32,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Backdrop frost — OLED SHOULDI capsule (blur + tonal veil). */
  heroBadgeBlurPlate: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBadgeFrostTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(48,46,54,0.38)',
  },
  heroBadgeFrostFallbackWeb: {
    backgroundColor: 'rgba(52,54,62,0.78)',
  },
  heroBadgeTopSheenFrost: {
    ...StyleSheet.absoluteFillObject,
    height: '42%',
    bottom: undefined,
    opacity: 0.48,
  },
  heroBadgeFrostHairline: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    bottom: 0,
    height: 2,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
  heroBadgeLeftAccent: {
    position: 'absolute',
    left: 0,
    top: '5%',
    bottom: '5%',
    width: 6,
    borderRadius: 3,
    opacity: 1,
  },
  heroBadgeBottomGleam: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    bottom: 0,
    height: 4,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  heroBadgeTopSheen: {
    ...StyleSheet.absoluteFillObject,
    height: '48%',
    bottom: undefined,
    opacity: 0.82,
  },
  /** OLED triangle cluster — overlaps avatars like reference pill. */
  heroBadgeOledTriangle: {
    top: '40%',
    marginTop: -20,
    transform: [{ translateY: 9 }, { rotateZ: '-8.5deg' }, { skewX: '8deg' }],
    paddingHorizontal: 34,
    paddingVertical: 11,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 17,
  },
  heroBadgeTxt: {
    ...typography.compact,
    fontWeight: '800',
    color: palette.heroInk,
    letterSpacing: 4.2,
    fontSize: 13,
    textTransform: 'uppercase',
    zIndex: 6,
  },
  heroBadgeTxtOled: {
    color: '#fff',
    letterSpacing: 4.5,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(12,8,26,0.62)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 6,
      },
      android: {
        textShadowColor: 'rgba(0,0,0,0.58)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 6,
      },
      default: {
        textShadowColor: 'rgba(0,0,0,0.58)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 6,
      },
    }),
  },
  sheetStack: {
    position: 'relative',
    width: SCREEN_W,
    alignSelf: 'stretch',
    marginTop: 0,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.1,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: -20 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  sheetSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
    zIndex: 0,
  },
  sheetInner: {
    position: 'relative',
    paddingTop: 36,
    zIndex: 2,
    minHeight: 120,
    paddingBottom: 4,
    pointerEvents: 'box-none',
  },
  sheetInset: {
    paddingHorizontal: Math.max(22, SCREEN_W * 0.068),
    marginBottom: 4,
  },
  sheetForm: {
    paddingTop: 10,
    marginBottom: 0,
    paddingHorizontal: Math.max(20, SCREEN_W * 0.06),
  },
  ctaDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
    paddingHorizontal: 28,
    paddingVertical: 18,
    pointerEvents: 'box-none',
  },
  ctaPress: {
    width: SCREEN_W - 56,
    maxWidth: 400,
    borderRadius: radius.pill,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: palette.neonMint,
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  ctaPressOled: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    paddingVertical: 0,
    maxWidth: 420,
    width: SCREEN_W - 48,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    paddingLeft: 24,
    paddingRight: 10,
    minHeight: 60,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(61,255,184,0.22)',
    borderRadius: radius.pill,
    gap: 12,
  },
  ctaSolid: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 19 : 18,
    paddingHorizontal: 20,
    minHeight: 64,
    backgroundColor: '#000000',
    borderRadius: radius.pill,
  },
  ctaLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.sheet,
    letterSpacing: 0.25,
    textAlign: 'center',
  },
  ctaLabelOled: {
    letterSpacing: 0.65,
    textTransform: 'none',
    fontSize: 19,
    fontVariant: [],
  },
  ctaSubtitle: {
    ...typography.caption,
    color: 'rgba(251,251,251,0.55)',
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.12,
    lineHeight: 16,
  },
  ctaSubtitleOled: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
  },
  ctaSwipeHint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.48)',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  ctaArrowGlow: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGlow: {
    position: 'absolute',
    left: SCREEN_W / 2 - SCREEN_W * 0.42,
    width: SCREEN_W * 0.84,
    maxWidth: 380,
    height: 64,
    zIndex: 3,
    opacity: Platform.OS === 'ios' ? 0.85 : 0.55,
    pointerEvents: 'none',
  },
  ctaGlowInner: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    shadowColor: palette.neonMint,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
});
