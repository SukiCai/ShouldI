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
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { MOTION } from '@/constants/motion';
import { palette, profileTypography, radius, typography } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import Button from '@/components/ui/Button';
import { OledFluorSpeckles, OLED_LUMA_MINT, OLED_LUMA_PINK, OLED_LUMA_SKY } from '@/components/ui/OledSignUpBackdrop';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
/** Space under the status bar before the back chip — 8 felt flush to the top. */
const CHROME_TOP_PAD = 12;
const BACK_BTN_SIZE = 44;
const AUTH_EXPAND_SNAP = 0.38;
/** Collapsed notch sheet — shorter so hero headline clears the card top. */
const AUTH_SHEET_MIN_H = Math.max(348, Math.round(SCREEN_H * 0.435));
/**
 * Pixel-traced from auth reference card:
 * topR ≈ 0.10·W, scoop mouth ≈ 0.85·W, depth ≈ 0.19·W, tiny bottom feet (~0.06·W).
 * Side gutter keeps a slim black reveal between card and screen edges.
 */
const AUTH_CARD_GUTTER = Math.max(10, Math.round(SCREEN_W * 0.028));
const AUTH_CARD_W = SCREEN_W - AUTH_CARD_GUTTER * 2;
const AUTH_CARD_TOP_R = Math.round(Math.min(64, Math.max(48, AUTH_CARD_W * 0.128)));
/** Leading inset for the back chip — sits with the card edge + a little air. */
const AUTH_BACK_INSET = Math.max(16, Math.round(SCREEN_W * 0.028) + 6);
const AUTH_SCOOP_MOUTH_FRAC = 0.855;
const AUTH_SCOOP_DEPTH_FRAC = 0.19;
/** Continuous-corner tangent factor — longer edge run-in than a circular arc (less “kink”). */
const AUTH_CORNER_K = 0.62;

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

/**
 * Reference silhouette: continuous (squircle-like) side corners + wide U scoop.
 * Top L/R use cubic continuous corners — smoother than circular `Q` arcs.
 */
function notchSheetPath(w: number, h: number, topR: number, mouthFrac: number, depthFrac: number) {
  const r = Math.min(topR, w / 2 - 1);
  const k = AUTH_CORNER_K;
  const mid = w / 2;
  const mouth = Math.min(w * mouthFrac, w - 28);
  const n = mouth / 2;
  const d = Math.min(Math.max(68, w * depthFrac), h * 0.32);
  /** Bottom feet — a bit larger + continuous so side→scoop reads as one soft curve. */
  const br = Math.min(Math.max(28, w * 0.078), (w - mouth) * 0.52);
  const apexY = h - d;
  const lobeK = 0.62;

  return [
    `M ${r},0`,
    `H ${w - r}`,
    // top-right continuous corner
    `C ${w - r * (1 - k)},0 ${w},${r * (1 - k)} ${w},${r}`,
    `V ${h - br}`,
    // right foot → scoop (continuous)
    `C ${w},${h - br * (1 - k)} ${w - br * (1 - k)},${h} ${mid + n},${h}`,
    `C ${mid + n * 0.64},${h} ${mid + n * 0.36},${apexY} ${mid},${apexY}`,
    `C ${mid - n * 0.36},${apexY} ${mid - n * 0.64},${h} ${mid - n},${h}`,
    // scoop → left foot (continuous)
    `C ${br * (1 - k)},${h} 0,${h - br * (1 - k)} 0,${h - br}`,
    `V ${r}`,
    // top-left continuous corner
    `C 0,${r * (1 - k)} ${r * (1 - k)},0 ${r},0`,
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
/** Per-seat enter delay (ms). Bottom orb starts with the herd — no trailing wait. */
const SWARM_ENTER_STAGGER_MS: readonly [number, number, number] = [0, 170, 0];
/** Bottom triangle seat (third orb): eases **in from the left** (translateX − → 0). */
const SWARM_BOTTOM_SLOT_INDEX = 2;
/** |translateX| at t=0 as a fraction of `approachReach` (negative bx = enters from stage left). */
const SWARM_BOTTOM_FROM_LEFT_HORIZONTAL_MUL = 0.78;
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
    const tierBp = breathForTier(heroClusterBreathForIndex(index), motionTier);
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
      withRepeat(withTiming(1, { duration: tierBp.breathMs, easing: SWARM_BREATH_EASE }), -1, true),
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
  }, [reducedMotion, motionTier, enterDelayMs, index, floatCfg]);

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
          {faceOrb}
        </Animated.View>
      ) : (
        <View
          style={[
            styles.charOrbStack,
            { width: diameter, height: diameter },
            swarmStaticTiltStyle(rotation),
          ]}>
          {faceOrb}
        </View>
      )}
    </View>
  );
}

const OLED_CLUSTER_FACE_COUNT = 3;

/** Triangle hero · each donut flies in from outside along centroid → seat. `premium` adds buoyant drift. */
function HeroCircularCluster({
  sources,
  motionTier,
  signupTrioAvoidSheetOverlap,
  clusterScale = 1,
}: {
  sources: ImageSourcePropType[];
  motionTier: HeroMotionTier;
  /** Extra foot room + stacking guard for OLED signup — bottom orb vs white sheet chrome. */
  signupTrioAvoidSheetOverlap?: boolean;
  /** Scales the triangle cluster — use ~0.72 for compact auth decor. */
  clusterScale?: number;
}) {
  const faces = sources.slice(0, OLED_CLUSTER_FACE_COUNT);
  const n = faces.length;
  if (n === 0) return null;

  /* Slightly tighter margins + allow mild overshoot on wide screens → larger overall orbs */
  const swarmScale =
    Math.min(1.04, (SCREEN_W - 40) / (OLED_TRIANGLE_BOUNDS.w + 24)) * Math.max(0.55, clusterScale);

  const { arenaWidth, scaledSlots, slotShiftX, centroidCx, centroidCy } = React.useMemo(() => {
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
    const dxShift = aw / 2 - clusterMidX;

    let sumCx = 0;
    let sumCy = 0;
    for (const s of slots) {
      sumCx += s.cx;
      sumCy += s.cy;
    }
    const ccx = slots.length ? sumCx / slots.length : 0;
    const ccy = slots.length ? sumCy / slots.length : 0;

    return {
      arenaWidth: aw,
      scaledSlots: slots,
      slotShiftX: dxShift,
      centroidCx: ccx,
      centroidCy: ccy,
    };
  }, [n, swarmScale]);

  const sheetGuard = !!signupTrioAvoidSheetOverlap;
  const arenaPadBottom = sheetGuard ? 38 : 16;
  const floatingBottomPad = sheetGuard ? 24 : 2;

  return (
    <View pointerEvents="box-none" style={[styles.avatarRowFloating, sheetGuard && { paddingBottom: floatingBottomPad }]}>
      <View
        pointerEvents="box-none"
        style={[
          styles.avatarSwarmArena,
          {
            width: arenaWidth,
            minHeight: OLED_TRIANGLE_BOUNDS.h * swarmScale + arenaPadBottom,
          },
        ]}>
        {faces.map((src, idx) => {
          const slot = scaledSlots[idx];
          if (!slot) return null;
          const { cx, cy, diameter } = slot;

          const approachReach = SWARM_APPROACH_RADIUS * swarmScale;

          let approachBx: number;
          let approachBy: number;

          if (idx === SWARM_BOTTOM_SLOT_INDEX && n >= 3) {
            /** Left → right glide into apex seat. */
            approachBx = -approachReach * SWARM_BOTTOM_FROM_LEFT_HORIZONTAL_MUL;
            approachBy = 0;
          } else {
            /** Unit vector centroid → seat: begin further out on that ray, ease to origin. */
            let rdx = cx - centroidCx;
            let rdy = cy - centroidCy;
            const rlen = Math.hypot(rdx, rdy);
            if (rlen < 0.75) {
              const ang = ((Math.PI * 2) / Math.max(n, 1)) * idx;
              rdx = Math.cos(ang);
              rdy = Math.sin(ang);
            } else {
              rdx /= rlen;
              rdy /= rlen;
            }
            approachBx = rdx * approachReach;
            approachBy = rdy * approachReach;
          }

          const stagger = SWARM_ENTER_STAGGER_MS[idx] ?? idx * 170;

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
              approachBx={approachBx}
              approachBy={approachBy}
              enterDelayMs={stagger}
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

/** OLED billboard (dark appearance) — dark blur capsule on #000 canvas. */
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
  /** Optional — omit for compact auth (form-first). */
  headline?: string;
  subtitle?: string;
  heroBadge?: string;
  /** Optional PNG illustration (three avatars artwork). Falls back to emoji cluster when omitted. */
  heroImage?: ImageSourcePropType;
  /** Raster neon-ring avatar swarm (`constants/users`). */
  heroAvatars?: ImageSourcePropType[];
  /** OLED hero choreography — `premium` adds brighter halos + Lissajous float. */
  heroMotion?: HeroMotionTier;
  /** Compact form-first layout — decor hero + in-card sheet. Omit for classic half-screen split. */
  compact?: boolean;
  /** `docked` = notch half-sheet + bottom capsule CTA (reference layout). `inCard` = CTA inside sheet. */
  ctaPlacement?: 'docked' | 'inCard';
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
  heroBadge = '',
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
  compact = false,
  ctaPlacement = 'docked',
  style,
}: GenZAuthChromeProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = React.useRef<ScrollView>(null);
  const scrollY = useSharedValue(0);
  const expandDragStartY = useSharedValue(0);
  const expandDistanceSv = useSharedValue(200);
  const sheetMinHSv = useSharedValue(AUTH_SHEET_MIN_H);
  const expandedSheetHSv = useSharedValue(AUTH_SHEET_MIN_H + 120);
  const topRadiusSv = useSharedValue(AUTH_CARD_TOP_R);
  const collapsedBottomSv = useSharedValue(16);
  const safeBottomSv = useSharedValue(16);
  /** 0 → off-screen below; 1 → settled. First-mount slide-up for the docked card. */
  const sheetEnter = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  /** Collapsed = docked CTA only; expanded = in-sheet CTA only — never both mounted. */
  const [useInSheetCta, setUseInSheetCta] = React.useState(false);

  const oled = appearance === 'oled';
  const colorScheme = useColorScheme();
  /** Light appearance only → pastel paper OLED. Dark / unspecified → billboard black OLED. */
  const oledLightCanvas = oled && colorScheme === 'light';
  const oledDarkBillboard = oled && colorScheme !== 'light';
  const trioRasterHero = oled && (heroAvatars?.length ?? 0) >= 3;
  const halfScreen = !compact;
  const dockedCta = !compact && ctaPlacement === 'docked';
  const showHeroVisual = (heroAvatars?.length ?? 0) >= 3 || !!heroImage;
  const showHeroCopy = halfScreen && !!(headline?.trim() || subtitle?.trim());
  const decorHero = compact && showHeroVisual;
  /** ~52% sheet — notch SVG for docked half-screen (OLED hero + white sheet). */
  const sheetMinH = AUTH_SHEET_MIN_H;
  const topR = AUTH_CARD_TOP_R;
  const cardW = AUTH_CARD_W;
  const cardGutter = AUTH_CARD_GUTTER;
  const notchDip = Math.round(Math.min(Math.max(68, cardW * AUTH_SCOOP_DEPTH_FRAC), sheetMinH * 0.32));
  const oledInsetPad = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 8);
  const footerReserve = notchDip + 28 + oledInsetPad;
  const mistSheetPath =
    halfScreen && dockedCta
      ? notchSheetPath(cardW, sheetMinH, topR, AUTH_SCOOP_MOUTH_FRAC, AUTH_SCOOP_DEPTH_FRAC)
      : '';

  const topChrome = Math.max(insets.top, 10) + CHROME_TOP_PAD + BACK_BTN_SIZE;
  /** Sheet sits on the safe-area floor — scoop + CTA are inside the card, not a second dock below. */
  const collapsedBottom = Math.max(insets.bottom, 10);
  const safeBottom = Math.max(insets.bottom, 16);
  const sheetTopCollapsed = SCREEN_H - collapsedBottom - sheetMinH;
  const expandedSheetH = SCREEN_H - topChrome - safeBottom;
  const expandDistance = Math.max(160, sheetTopCollapsed - topChrome);

  React.useEffect(() => {
    expandDistanceSv.value = expandDistance;
    sheetMinHSv.value = sheetMinH;
    expandedSheetHSv.value = expandedSheetH;
    topRadiusSv.value = AUTH_CARD_TOP_R;
    collapsedBottomSv.value = collapsedBottom;
    safeBottomSv.value = safeBottom;
  }, [
    collapsedBottom,
    expandDistance,
    expandedSheetH,
    expandDistanceSv,
    expandedSheetHSv,
    safeBottom,
    collapsedBottomSv,
    safeBottomSv,
    sheetMinH,
    sheetMinHSv,
    topRadiusSv,
  ]);

  React.useEffect(() => {
    if (reduceMotion) {
      sheetEnter.value = 1;
      return;
    }
    sheetEnter.value = 0;
    sheetEnter.value = withDelay(
      40,
      withSpring(1, {
        damping: 18,
        stiffness: 190,
        mass: 0.88,
        overshootClamping: false,
      }),
    );
  }, [reduceMotion, sheetEnter]);

  const expandPanGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .onBegin(() => {
          expandDragStartY.value = scrollY.value;
        })
        .onUpdate((event) => {
          const dist = expandDistanceSv.value;
          scrollY.value = Math.max(
            0,
            Math.min(dist, expandDragStartY.value - event.translationY),
          );
        })
        .onEnd((event) => {
          const dist = expandDistanceSv.value;
          if (dist <= 0) return;
          const open = scrollY.value > dist * AUTH_EXPAND_SNAP || event.velocityY < -620;
          scrollY.value = withSpring(open ? dist : 0, { damping: 22, stiffness: 220 });
        }),
    [expandDistanceSv, expandDragStartY, scrollY],
  );

  useAnimatedReaction(
    () => {
      const dist = expandDistanceSv.value;
      const progress = dist > 0 ? Math.min(scrollY.value / dist, 1) : 0;
      return progress >= 0.5 ? 1 : 0;
    },
    (next, prev) => {
      if (!dockedCta || next === prev) return;
      runOnJS(setUseInSheetCta)(next === 1);
    },
    [dockedCta],
  );

  const scrollSheetHeroToTop = React.useCallback(() => {
    Keyboard.dismiss();
    if (dockedCta) {
      scrollY.value = reduceMotion ? 0 : withSpring(0, { damping: 22, stiffness: 220 });
      return;
    }
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [dockedCta, reduceMotion, scrollY]);

  const heroExpandStyle = useAnimatedStyle(() => {
    const dist = expandDistanceSv.value;
    const progress = dist > 0 ? Math.min(scrollY.value / dist, 1) : 0;
    return {
      opacity: interpolate(progress, [0, 0.72], [1, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(progress, [0, 1], [0, -28], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(progress, [0, 1], [1, 0.94], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const sheetPinnedStyle = useAnimatedStyle(() => {
    const dist = expandDistanceSv.value;
    const progress = dist > 0 ? Math.min(scrollY.value / dist, 1) : 0;
    const minH = sheetMinHSv.value;
    const maxH = expandedSheetHSv.value;
    const height = minH + progress * (maxH - minH);
    const bottom =
      collapsedBottomSv.value + (safeBottomSv.value - collapsedBottomSv.value) * progress;
    const topRadius = topRadiusSv.value * (1 - progress);
    const enter = sheetEnter.value;
    // Allow slight overshoot past 1 so the spring can bounce above the rest seat.
    const enterY = interpolate(enter, [0, 1], [minH + 72, 0]);
    return {
      height,
      bottom,
      borderTopLeftRadius: topRadius,
      borderTopRightRadius: topRadius,
      opacity: interpolate(enter, [0, 0.22, 1], [0, 1, 1], Extrapolation.CLAMP),
      transform: [{ translateY: enterY }],
    };
  });

  const sheetScoopFadeStyle = useAnimatedStyle(() => {
    const dist = expandDistanceSv.value;
    const progress = dist > 0 ? Math.min(scrollY.value / dist, 1) : 0;
    return {
      opacity: interpolate(progress, [0, 0.55], [1, 0], Extrapolation.CLAMP),
    };
  });

  /** Rect fill only while expanding — collapsed card shape is SVG-only. */
  const sheetRectFillStyle = useAnimatedStyle(() => {
    const dist = expandDistanceSv.value;
    const progress = dist > 0 ? Math.min(scrollY.value / dist, 1) : 0;
    return {
      opacity: interpolate(progress, [0.35, 0.7], [0, 1], Extrapolation.CLAMP),
    };
  });

  const ctaDockExpandStyle = useAnimatedStyle(() => {
    const dist = expandDistanceSv.value;
    const progress = dist > 0 ? Math.min(scrollY.value / dist, 1) : 0;
    const enter = sheetEnter.value;
    const enterY = interpolate(enter, [0, 1], [sheetMinHSv.value + 72, 0]);
    const expandY = interpolate(progress, [0.3, 0.55], [0, 88], Extrapolation.CLAMP);
    return {
      opacity:
        interpolate(enter, [0, 0.22, 1], [0, 1, 1], Extrapolation.CLAMP) *
        interpolate(progress, [0, 0.32, 0.46], [1, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: enterY + expandY }],
    };
  });

  /** Scoop CTA — text sits in the notch; ink follows canvas (white on OLED black, dark on light mist). */
  const renderScoopCtaPressable = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={footerCtaAccessibilityLabel ?? footerCtaLabel}
      accessibilityHint={
        footerSubtitle ??
        (swipeAlternate ? 'Swipe near the bottom button to flip between Sign up and Sign in' : undefined)
      }
      onPress={() => {
        void bumpHaptic(Haptics.ImpactFeedbackStyle.Medium);
        onFooterPress();
      }}
      style={({ pressed }) => [styles.ctaScoopHit, pressed && styles.ctaScoopHitPressed]}>
      <Text
        style={[
          styles.ctaScoopLabel,
          oledDarkBillboard ? styles.ctaScoopLabelDark : styles.ctaScoopLabelLight,
        ]}>
        {footerCtaLabel}
      </Text>
    </Pressable>
  );

  const renderAuthCtaPressable = (styleExtras: StyleProp<ViewStyle>) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={footerCtaAccessibilityLabel ?? footerCtaLabel}
      accessibilityHint={
        footerSubtitle ??
        (swipeAlternate ? 'Swipe near the bottom button to flip between Sign up and Sign in' : undefined)
      }
      onPress={() => {
        void bumpHaptic(Haptics.ImpactFeedbackStyle.Medium);
        onFooterPress();
      }}
      style={({ pressed }) => [
        styles.ctaOledSolid,
        styles.ctaPressDocked,
        styleExtras,
        pressed && styles.backChipPressed,
      ]}>
      <Text style={styles.ctaOledSolidLabel}>{footerCtaLabel}</Text>
    </Pressable>
  );

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
    <View
      style={[
        styles.root,
        oledLightCanvas && styles.authSurfaceRoot,
        oledDarkBillboard && styles.authSurfaceDarkRoot,
        style,
      ]}>
      <StatusBar style={oledDarkBillboard ? 'light' : 'dark'} />

      {oled ? (
        oledLightCanvas ? (
          <>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.authSurfaceLightBase]} />
            <LinearGradient
              pointerEvents="none"
              colors={[palette.white, palette.accentSoft, '#eef2fb']}
              locations={[0, 0.45, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={styles.authSurfaceLightWash}
            />
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.authGlowOrbsDim]}>
              <GlowOrbsMist />
            </View>
          </>
        ) : (
          <>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.authSurfaceDarkBase]} />
            <OledFluorSpeckles />
          </>
        )
      ) : (
        <>
          <View style={[StyleSheet.absoluteFill, styles.mistBase]} />
          <LinearGradient
            colors={[palette.mist, `${palette.nightWash}b3`, palette.mist]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.mistWash}
            pointerEvents="none"
          />
          <GlowOrbsMist />
        </>
      )}

      {dockedCta && !useInSheetCta ? (
        <Animated.View
          {...(panResponder ? panResponder.panHandlers : {})}
          pointerEvents="box-none"
          style={[
            styles.ctaDock,
            {
              bottom: collapsedBottom,
              height: notchDip,
            },
            ctaDockExpandStyle,
          ]}>
          {renderScoopCtaPressable()}
        </Animated.View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, zIndex: 24 }}
        pointerEvents="box-none">
        {dockedCta ? (
          <>
            {(showHeroVisual || showHeroCopy) ? (
              <Animated.View
                pointerEvents="box-none"
                style={[
                  styles.heroExpandOverlay,
                  { paddingTop: topChrome + 6 },
                  heroExpandStyle,
                  trioRasterHero && styles.heroClusterZUnderSignupSheet,
                ]}>
                {showHeroVisual ? (
                  <View
                    pointerEvents="box-none"
                    style={[
                      styles.heroCluster,
                      trioRasterHero && styles.heroClusterZUnderSignupSheet,
                    ]}>
                    <View
                      pointerEvents="box-none"
                      style={[
                        styles.heroInner,
                        (heroAvatars?.length ?? 0) >= 3 || heroImage ? styles.heroInnerTall : null,
                      ]}>
                      {(heroAvatars?.length ?? 0) >= 3 ? (
                        <HeroCircularCluster
                          sources={heroAvatars ?? []}
                          motionTier={heroMotion}
                          signupTrioAvoidSheetOverlap={trioRasterHero}
                        />
                      ) : heroImage ? (
                        <HeroRaster heroImage={heroImage} minHeight={228} />
                      ) : (
                        <AvatarFallback />
                      )}
                      {heroBadge.trim() ? (
                        <View
                          style={[
                            styles.heroBadgeOuter,
                            oledDarkBillboard ? glassBadgeOled : glassBadgeMist,
                            oled && (heroAvatars?.length ?? 0) >= 3 ? styles.heroBadgeOledTriangle : null,
                          ]}>
                          {oledDarkBillboard ? (
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
                          <Text style={[styles.heroBadgeTxt, oledDarkBillboard ? styles.heroBadgeTxtOled : null]}>
                            {heroBadge}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                {showHeroCopy ? (
                  <View
                    pointerEvents="box-none"
                    style={[styles.heroHeadlineSpacer, trioRasterHero && styles.heroHeadSpacerSignupTrio]}>
                    <View style={styles.titleBlock}>
                      {headline?.trim() ? (
                        <Text style={[styles.heroTitle, oledDarkBillboard ? styles.heroTitleOled : styles.heroTitleMist]}>
                          {headline}
                        </Text>
                      ) : null}
                      {subtitle ? (
                        <Text style={[styles.heroSub, oledDarkBillboard ? styles.heroSubOled : null]}>{subtitle}</Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            <GestureDetector gesture={expandPanGesture}>
              <Animated.View
                style={[
                  styles.sheetExpandPinned,
                  { left: cardGutter, right: cardGutter, width: cardW },
                  sheetPinnedStyle,
                ]}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.sheetExpandRectFill, sheetRectFillStyle]}
                />
                <Animated.View
                  style={[styles.sheetExpandScoop, { height: sheetMinH }, sheetScoopFadeStyle]}
                  pointerEvents="none">
                  <Svg width={cardW} height={sheetMinH} pointerEvents="none">
                    <Path d={mistSheetPath} fill={palette.sheet} />
                  </Svg>
                </Animated.View>
                <View style={styles.sheetExpandGrab} pointerEvents="none">
                  <View style={styles.sheetExpandGrabPill} />
                </View>
                <GestureDetector gesture={Gesture.Native()}>
                  <ScrollView
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}
                    style={styles.sheetExpandFormScroll}
                    contentContainerStyle={[
                      styles.sheetExpandFormScrollContent,
                      { paddingBottom: useInSheetCta ? 24 : notchDip + 8 },
                    ]}>
                    <View style={styles.sheetExpandFormInner}>
                      <View style={styles.sheetInset} pointerEvents="auto">
                        {sheetHeader}
                      </View>
                      <View style={[styles.sheetInset, styles.sheetForm]} pointerEvents="auto">
                        {children}
                      </View>
                      {tertiaryRow ? (
                        <View style={styles.sheetInset} pointerEvents="auto">
                          {tertiaryRow}
                        </View>
                      ) : null}
                      {useInSheetCta ? (
                        <View style={[styles.sheetInset, styles.sheetCtaBlock]} pointerEvents="auto">
                          {renderAuthCtaPressable(styles.ctaPressInCard)}
                        </View>
                      ) : null}
                    </View>
                  </ScrollView>
                </GestureDetector>
              </Animated.View>
            </GestureDetector>
          </>
        ) : (
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="always"
          pointerEvents="box-none"
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: dockedCta ? footerReserve + 8 : Math.max(insets.bottom, 12),
              paddingTop:
                Math.max(insets.top, 10) +
                CHROME_TOP_PAD +
                BACK_BTN_SIZE +
                (decorHero ? 2 : showHeroVisual ? 10 : 4),
            },
            halfScreen && { minHeight: SCREEN_H },
          ]}
          showsVerticalScrollIndicator={false}>
          {showHeroVisual ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.heroCluster,
              decorHero && styles.heroClusterDecor,
              trioRasterHero && styles.heroClusterZUnderSignupSheet,
            ]}>
            <View
              pointerEvents="box-none"
              style={[
                styles.heroInner,
                decorHero
                  ? styles.heroInnerDecor
                  : (heroAvatars?.length ?? 0) >= 3 || heroImage
                    ? styles.heroInnerTall
                    : null,
              ]}>
              {(heroAvatars?.length ?? 0) >= 3 ? (
                <HeroCircularCluster
                  sources={heroAvatars ?? []}
                  motionTier={heroMotion}
                  signupTrioAvoidSheetOverlap={trioRasterHero}
                  clusterScale={decorHero ? 0.74 : 1}
                />
              ) : heroImage ? (
                <HeroRaster heroImage={heroImage} minHeight={228} />
              ) : (
                <AvatarFallback />
              )}
              {heroBadge.trim() ? (
                <View
                  style={[
                    styles.heroBadgeOuter,
                    oledDarkBillboard ? glassBadgeOled : glassBadgeMist,
                    oled && (heroAvatars?.length ?? 0) >= 3 ? styles.heroBadgeOledTriangle : null,
                  ]}>
                  {oledDarkBillboard ? (
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
                  <Text style={[styles.heroBadgeTxt, oledDarkBillboard ? styles.heroBadgeTxtOled : null]}>
                    {heroBadge}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          ) : null}
          {showHeroCopy ? (
            <View
              pointerEvents="box-none"
              style={[styles.heroHeadlineSpacer, trioRasterHero && styles.heroHeadSpacerSignupTrio]}>
              <View style={styles.titleBlock}>
                {headline?.trim() ? (
                  <Text style={[styles.heroTitle, oledDarkBillboard ? styles.heroTitleOled : styles.heroTitleMist]}>
                    {headline}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text style={[styles.heroSub, oledDarkBillboard ? styles.heroSubOled : null]}>{subtitle}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View
            style={[
              styles.sheetStack,
              halfScreen && !dockedCta && styles.sheetStackFill,
              halfScreen && !dockedCta && styles.sheetStackFront,
              compact && styles.sheetStackCompact,
              dockedCta && { minHeight: sheetMinH },
              halfScreen && !dockedCta && showHeroVisual && styles.sheetStackHeroOverlap,
              trioRasterHero && styles.sheetStackSignupTrio,
              oled && halfScreen && !dockedCta && styles.sheetStackOledFill,
              oled && halfScreen && !dockedCta && styles.sheetStackOledFront,
            ]}>
            {dockedCta ? (
              <>
                <Svg width={SCREEN_W} height={sheetMinH} pointerEvents="none" style={styles.sheetSvg}>
                  <Path d={mistSheetPath} fill={palette.sheet} />
                </Svg>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Scroll to top"
                  accessibilityHint="Scrolls back to show the headline and illustration at the top."
                  onPress={scrollSheetHeroToTop}
                  style={styles.sheetTapScroll}
                />
                <View style={styles.sheetForeground} pointerEvents="box-none">
                  <View style={styles.sheetInset} pointerEvents="auto">
                    {sheetHeader}
                  </View>
                  <View style={[styles.sheetInset, styles.sheetForm]} pointerEvents="box-none">
                    {children}
                  </View>
                  {tertiaryRow ? (
                    <View style={styles.sheetInset} pointerEvents="auto">
                      {tertiaryRow}
                    </View>
                  ) : null}
                  <View style={{ height: scrollBottomPad }} pointerEvents="none" />
                </View>
              </>
            ) : (
              <View
                {...(panResponder ? panResponder.panHandlers : {})}
                style={[
                  oled && halfScreen ? styles.sheetCardOled : styles.sheetCardAuth,
                  halfScreen && { flex: 1 },
                  { paddingBottom: Math.max(insets.bottom, 16) },
                ]}
                pointerEvents="auto"
                collapsable={false}>
                <View style={styles.sheetCardForeground} pointerEvents="box-none">
                  <View style={styles.sheetInset} pointerEvents="auto">
                    {sheetHeader}
                  </View>
                  <View style={[styles.sheetInset, styles.sheetForm]} pointerEvents="auto">
                    {children}
                  </View>
                  {tertiaryRow ? (
                    <View style={styles.sheetInset} pointerEvents="auto">
                      {tertiaryRow}
                    </View>
                  ) : null}
                  <View style={[styles.sheetInset, styles.sheetCtaBlock]} pointerEvents="box-none">
                    <Button
                      variant="primary"
                      label={footerCtaLabel}
                      accessibilityLabel={footerCtaAccessibilityLabel ?? footerCtaLabel}
                      accessibilityHint={
                        footerSubtitle ??
                        (swipeAlternate ? 'Swipe the form to switch between Sign in and Sign up' : undefined)
                      }
                      onPress={() => {
                        void bumpHaptic(Haptics.ImpactFeedbackStyle.Medium);
                        onFooterPress();
                      }}
                      style={StyleSheet.flatten([styles.ctaPress, styles.ctaPressInCard])}
                    />
                    {footerSubtitle ? <Text style={styles.ctaFooterBelowOled}>{footerSubtitle}</Text> : null}
                    {slideHint ? <Text style={styles.ctaSwipeHintBelowOled}>{slideHint}</Text> : null}
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
        )}
      </KeyboardAvoidingView>

      <View
        style={[
          styles.chromeOverlay,
          {
            paddingTop: Math.max(insets.top, 8) + CHROME_TOP_PAD,
            paddingLeft: Math.max(insets.left, 0) + AUTH_BACK_INSET,
            paddingRight: Math.max(insets.right, 0) + AUTH_BACK_INSET,
            zIndex: 40,
          },
        ]}
        pointerEvents="box-none">
        {router.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={() => {
              void bumpHaptic();
              router.back();
            }}
            style={({ pressed }) => [
              styles.backChip,
              oledDarkBillboard && styles.backChipOled,
              pressed && styles.backChipPressed,
            ]}>
            <Ionicons
              name="chevron-back"
              size={22}
              color={oledDarkBillboard ? '#fdfefe' : palette.heroInk}
              style={styles.backChevron}
            />
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
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
    marginTop: 2,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
  },
  muted: {
    ...typography.subhead,
    color: profileTypography.subdued,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  boldLink: {
    ...typography.title,
    fontWeight: '800',
    color: palette.heroInk,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  sheetLead: {
    ...typography.bodySm,
    color: profileTypography.subdued,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  sheetHeaderStack: {
    gap: 16,
    alignSelf: 'stretch',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    marginBottom: 14,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minWidth: 104,
    backgroundColor: '#eceef2',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 56,
    borderWidth: 0,
  },
  countryEmoji: {
    fontSize: 21,
    lineHeight: 26,
  },
  countryCode: {
    ...typography.compact,
    fontWeight: '700',
    color: palette.heroInk,
    letterSpacing: -0.2,
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
    ...typography.titleSm,
    color: profileTypography.ink,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'ios' ? 16 : 11,
    minHeight: 50,
    letterSpacing: Platform.OS === 'ios' ? 0.02 : 0,
  },
  tertiaryCenter: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  tertiaryStack: {
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 6,
  },
  tertiaryBold: {
    ...typography.bodySm,
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
  /** Sign-in / Sign-up OLED in **system light mode**. */
  authSurfaceRoot: {
    backgroundColor: palette.white,
  },
  /** OLED dark / billboard (dark mode or unspecified). */
  authSurfaceDarkRoot: {
    backgroundColor: '#000000',
  },
  authSurfaceLightBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.white,
    zIndex: 0,
  },
  authSurfaceLightWash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    opacity: 0.88,
  },
  authGlowOrbsDim: {
    zIndex: 0,
    opacity: Platform.OS === 'ios' ? 0.5 : 0.4,
  },
  authSurfaceDarkBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 0,
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
  chromeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    zIndex: 30,
    pointerEvents: 'box-none',
  },
  backSlot: {
    width: BACK_BTN_SIZE,
    height: BACK_BTN_SIZE,
  },
  backChip: {
    width: BACK_BTN_SIZE,
    height: BACK_BTN_SIZE,
    borderRadius: BACK_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.heroInk}10`,
  },
  /** Ionicons chevron-back sits optically right — nudge for even padding in the circle. */
  backChevron: {
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
  heroExpandOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 18,
    alignItems: 'center',
  },
  sheetExpandPinned: {
    position: 'absolute',
    /** Transparent — white fill comes only from the notched SVG path (rect fill hides the scoop). */
    backgroundColor: 'transparent',
    overflow: 'hidden',
    zIndex: 16,
  },
  sheetExpandGrab: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetExpandGrabPill: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15,17,21,0.14)',
  },
  sheetExpandFormScroll: {
    flex: 1,
  },
  sheetExpandFormScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  sheetExpandScoop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetExpandRectFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.sheet,
  },
  sheetExpandFormInner: {
    paddingTop: 4,
    zIndex: 2,
  },
  heroCluster: {
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
    width: '100%',
  },
  /** Below headline + sheet — keeps white notch from looking “under” the billboard orbs. */
  heroClusterZUnderSignupSheet: {
    zIndex: 3,
  },
  /** Headline hugs avatars · symmetric modest pad below before sheet */
  heroHeadlineSpacer: {
    width: '100%',
    alignItems: 'center',
    marginTop: -34,
    paddingTop: 0,
    paddingBottom: 18,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  heroHeadSpacerSignupTrio: {
    /** Pull copy back under the triangle (was −26, read as a wide air gap). */
    marginTop: -60,
    paddingBottom: 22,
    zIndex: 14,
  },
  heroClusterDecor: {
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: -12,
  },
  heroInnerDecor: {
    minHeight: 172,
    paddingTop: 0,
    overflow: 'visible',
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
    ...typography.displayLg,
    letterSpacing: -1.4,
    color: profileTypography.ink,
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
    color: profileTypography.emphasis,
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
  avatarPlate: {
    zIndex: 2,
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
    ...typography.subhead,
    fontWeight: '800',
    color: palette.heroInk,
    letterSpacing: 4.2,
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
  heroTitleMist: {
    textShadowColor: 'transparent',
    textShadowRadius: 0,
  },
  heroClusterCompact: {
    paddingVertical: 0,
  },
  heroInnerCompact: {
    minHeight: 0,
    paddingTop: 0,
  },
  sheetStackFill: {
    flex: 1,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  sheetStackFront: {
    zIndex: 38,
    position: 'relative',
    ...Platform.select({
      ios: {},
      android: { elevation: 24 },
      default: {},
    }),
  },
  sheetStackCompact: {
    marginTop: 4,
  },
  /** Pull mist notch sheet up under avatar cluster when headline is omitted. */
  sheetStackHeroOverlap: {
    marginTop: -32,
    zIndex: 12,
  },
  sheetCardAuth: {
    position: 'relative',
    width: SCREEN_W,
    alignSelf: 'center',
    backgroundColor: palette.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    marginTop: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.08,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -8 },
      },
      android: { elevation: 6 },
      default: {},
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
      android: {},
      default: {},
    }),
  },
  sheetCardOled: {
    position: 'relative',
    width: SCREEN_W,
    alignSelf: 'center',
    backgroundColor: palette.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    marginTop: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.16,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 14 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  sheetCardForeground: {
    position: 'relative',
    zIndex: 2,
    paddingTop: 24,
    pointerEvents: 'box-none',
  },
  sheetStackSignupTrio: {
    marginTop: 18,
    zIndex: 11,
  },
  /** OLED: pull auth card above overlapping hero/layout so TextInputs reliably receive taps. */
  sheetStackOledFront: {
    zIndex: 38,
    position: 'relative',
    ...Platform.select({
      ios: {},
      android: { elevation: 24 },
      default: {},
    }),
  },
  sheetStackOledFill: {
    flex: 1,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  sheetSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
    zIndex: 0,
  },
  sheetTapScroll: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  sheetForeground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    paddingTop: 36,
    paddingBottom: 4,
    pointerEvents: 'box-none',
  },
  sheetCtaBlock: {
    marginTop: 20,
    marginBottom: 0,
    gap: 0,
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
    justifyContent: 'center',
    zIndex: 26,
    paddingHorizontal: 28,
    pointerEvents: 'box-none',
  },
  ctaScoopHit: {
    minWidth: Math.min(220, SCREEN_W * 0.56),
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaScoopHitPressed: {
    opacity: 0.72,
  },
  ctaScoopLabel: {
    ...typography.titleSm,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  /** Dark OLED billboard — white label in the black scoop. */
  ctaScoopLabelDark: {
    color: palette.sheet,
  },
  /** Light mist canvas — dark label so Sign In / Continue stay readable. */
  ctaScoopLabelLight: {
    color: palette.heroInk,
  },
  ctaPress: {
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
  ctaPressDocked: {
    width: SCREEN_W - 56,
    maxWidth: 400,
  },
  ctaPressInCard: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  /** OLED sign-in / sign-up: single flat primary pill — mint rim/glow on the button itself (no second ghost pill). */
  ctaOledSolid: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'ios' ? 16 : 15,
    paddingHorizontal: 22,
    minHeight: 52,
    backgroundColor: '#000000',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.signUpMintHairline,
    ...Platform.select<ViewStyle>({
      ios: {
        shadowColor: palette.neonMint,
        shadowOpacity: 0.32,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  ctaOledSolidLabel: {
    ...typography.titleSm,
    letterSpacing: 0.35,
    color: palette.sheet,
    textAlign: 'center',
  },
  ctaFooterBelowOled: {
    ...typography.caption,
    color: 'rgba(15,17,21,0.42)',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
    maxWidth: 300,
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  ctaSwipeHintBelowOled: {
    ...typography.micro,
    color: 'rgba(15,17,21,0.48)',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
    maxWidth: 300,
    alignSelf: 'center',
    paddingHorizontal: 8,
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
  ctaLabel: {
    ...typography.h2,
    fontWeight: '800',
    color: palette.sheet,
    letterSpacing: 0.25,
    textAlign: 'center',
  },
  ctaSubtitle: {
    ...typography.caption,
    color: 'rgba(251,251,251,0.55)',
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.12,
    lineHeight: 16,
  },
  ctaSwipeHint: {
    ...typography.micro,
    color: 'rgba(255,255,255,0.48)',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ctaArrowGlow: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
