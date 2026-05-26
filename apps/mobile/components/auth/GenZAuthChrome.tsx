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

import { palette, profileTypography, radius, typography } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { OledFluorSpeckles, OLED_LUMA_MINT, OLED_LUMA_PINK, OLED_LUMA_SKY } from '@/components/ui/OledSignUpBackdrop';

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

function sheetBottomCornerR(w: number, h: number, topR: number): number {
  return Math.max(13, Math.min(26, Math.min(topR * 0.52, w * 0.062, h * 0.068)));
}

/**
 * One symmetric quadratic from current point `(xR, yB)` to `(xL, yB)`:
 * parabolic bell — smooth apex, no segmented cubics needed.
 *
 * Control at `(mid, yB − 2·depth)` so the midpoint depth from the chord is `depth`.
 */
function gaussianScoopBell(mid: number, xL: number, _xR: number, yB: number, depth: number): string {
  const cy = yB - 2 * depth;
  return `Q ${mid},${cy} ${xL},${yB}`;
}

/** White sheet SVG: rounded top + smooth bottom fillets + Gaussian center scoop (~⅓ chord). */
function notchSheetPath(w: number, h: number, topR: number, notchHalf: number, notchDip: number) {
  const r = Math.min(topR, w / 2 - 1);
  const mid = w / 2;
  const n = Math.min(notchHalf, mid - 28);
  const d = notchDip;
  const br = sheetBottomCornerR(w, h, topR);
  const brK = 0.42;

  const xBellL = mid - n;
  const xBellR = mid + n;
  const xR0 = w - br;

  const rightSpan = xR0 - xBellR;
  const wingBow = Math.min(6.25, Math.max(2.4, d * 0.11));

  let rightWing: string[];
  if (rightSpan <= 4) {
    const p2Sm = xBellR + rightSpan / 2;
    rightWing = [`C ${xR0 - 1},${h} ${p2Sm},${h - wingBow * 0.75} ${xBellR},${h}`];
  } else {
    const p1Wx = xR0 - Math.min(rightSpan * 0.38, Math.max(rightSpan * 0.08, rightSpan - 10));
    const p2Wx = Math.max(xBellR + 3, Math.min(xR0 - 3, xBellR + rightSpan * 0.5));
    rightWing = [`C ${p1Wx},${h} ${p2Wx},${h - wingBow} ${xBellR},${h}`];
  }

  const xBL = br;
  const leftSpan = xBellL - xBL;
  let leftWing: string[];
  if (leftSpan <= 4) {
    const p2SmL = xBellL - leftSpan / 2;
    leftWing = [`C ${xBellL - 1},${h} ${p2SmL},${h - wingBow * 0.75} ${xBL},${h}`];
  } else {
    const p1Lx = xBellL - Math.min(leftSpan * 0.38, Math.max(leftSpan * 0.08, leftSpan - 10));
    const p2Lx = Math.min(xBellL - 3, Math.max(xBL + 3, xBL + leftSpan * 0.58));
    leftWing = [`C ${p1Lx},${h} ${p2Lx},${h - wingBow} ${xBL},${h}`];
  }

  const scoop = gaussianScoopBell(mid, xBellL, xBellR, h, d);

  return [
    `M ${r},0`,
    `H ${w - r}`,
    `Q ${w},0 ${w},${r}`,
    `V ${h - br}`,
    `C ${w},${h - br * brK} ${w - br * brK},${h} ${xR0},${h}`,
    ...rightWing,
    scoop,
    ...leftWing,
    `C ${br * brK},${h} 0,${h - br * brK} 0,${h - br}`,
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

/** Triangle hero · each donut flies in from outside along centroid → seat. `premium` adds buoyant drift. */
function HeroCircularCluster({
  sources,
  motionTier,
  signupTrioAvoidSheetOverlap,
}: {
  sources: ImageSourcePropType[];
  motionTier: HeroMotionTier;
  /** Extra foot room + stacking guard for OLED signup — bottom orb vs white sheet chrome. */
  signupTrioAvoidSheetOverlap?: boolean;
}) {
  const faces = sources.slice(0, OLED_CLUSTER_FACE_COUNT);
  const n = faces.length;
  if (n === 0) return null;

  /* Slightly tighter margins + allow mild overshoot on wide screens → larger overall orbs */
  const swarmScale = Math.min(1.04, (SCREEN_W - 40) / (OLED_TRIANGLE_BOUNDS.w + 24));

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
  const scrollRef = React.useRef<ScrollView>(null);

  const scrollSheetHeroToTop = React.useCallback(() => {
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const oled = appearance === 'oled';
  const colorScheme = useColorScheme();
  /** Light appearance only → pastel paper OLED. Dark / unspecified → billboard black OLED. */
  const oledLightCanvas = oled && colorScheme === 'light';
  const oledDarkBillboard = oled && colorScheme !== 'light';
  const trioRasterHero = oled && (heroAvatars?.length ?? 0) >= 3;
  /** ~55% sheet */
  const sheetMinH = Math.max(392, Math.round(SCREEN_H * 0.52));
  const topR = 46;
  const notchHalf = Math.min(Math.floor(SCREEN_W * 0.26), Math.round(SCREEN_W / 2) - 28);
  const notchDip = 70;
  const oledInsetPad = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 8);
  const ctaBump = notchDip + Math.round(Math.max(56, Math.round(notchDip + 26)) * 0.82);
  /** Bottom scroll padding for Mist (docked CTA). OLED CTA is in-card — see ScrollView padding. */
  const footerReserve = ctaBump + 44 + oledInsetPad;

  const mistSheetPath = notchSheetPath(SCREEN_W, sheetMinH, topR, notchHalf, notchDip);

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
      <StatusBar style={oledLightCanvas ? 'dark' : 'light'} />

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

      {!oled ? (
        <View pointerEvents="none" style={[styles.ctaGlow, { bottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.ctaGlowInner} />
        </View>
      ) : null}

      {/* Mist: docked capsule CTA. OLED: CTA renders inside sheet (see ScrollView card). */}
      {!oled ? (
        <View
          {...(panResponder ? panResponder.panHandlers : {})}
          pointerEvents="box-none"
          style={[styles.ctaDock, { bottom: Math.max(insets.bottom, 10) }]}>
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
            style={({ pressed }) =>
              [
                styles.ctaPress,
                styles.ctaPressDocked,
                pressed &&
                  ({
                    opacity: 0.96,
                    transform: [{ scale: 0.985 }],
                  } as const),
              ]
            }>
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
          </Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, zIndex: 24 }}
        pointerEvents="box-none">
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="always"
          pointerEvents="box-none"
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: oled ? Math.max(24, Math.round(insets.bottom * 0.45)) : footerReserve + 8,
              paddingTop: Math.max(insets.top, 10) + 46,
            },
          ]}
          showsVerticalScrollIndicator={false}>
          <View
            pointerEvents={oled ? 'box-none' : 'auto'}
            style={[styles.heroCluster, trioRasterHero && styles.heroClusterZUnderSignupSheet]}>
            <View
              pointerEvents={oled ? 'box-none' : 'auto'}
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
          <View
            pointerEvents={oled ? 'box-none' : 'auto'}
            style={[styles.heroHeadlineSpacer, trioRasterHero && styles.heroHeadSpacerSignupTrio]}>
            <View style={styles.titleBlock}>
              <Text style={[styles.heroTitle, oledDarkBillboard ? styles.heroTitleOled : null]}>{headline}</Text>
              {subtitle ? (
                <Text style={[styles.heroSub, oledDarkBillboard ? styles.heroSubOled : null]}>{subtitle}</Text>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.sheetStack,
              trioRasterHero && styles.sheetStackSignupTrio,
              oled && styles.sheetStackOledFront,
              !oled && { minHeight: sheetMinH },
              oled &&
                Platform.OS === 'ios' &&
                ({
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                } as const),
            ]}>
            {oled ? (
              <View style={styles.sheetCardOled} pointerEvents="auto" collapsable={false}>
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
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={footerCtaAccessibilityLabel ?? footerCtaLabel}
                      accessibilityHint={footerSubtitle}
                      onPress={() => {
                        void bumpHaptic(Haptics.ImpactFeedbackStyle.Medium);
                        onFooterPress();
                      }}
                      style={({ pressed }) =>
                        [
                          styles.ctaPress,
                          styles.ctaPressInCard,
                          pressed &&
                            ({
                              opacity: 0.96,
                              transform: [{ scale: 0.985 }],
                            } as const),
                        ]
                      }>
                      <View style={styles.ctaOledSolid}>
                        <Text style={styles.ctaOledSolidLabel}>{footerCtaLabel}</Text>
                      </View>
                    </Pressable>
                    {footerSubtitle ? <Text style={styles.ctaFooterBelowOled}>{footerSubtitle}</Text> : null}
                    {slideHint ? <Text style={styles.ctaSwipeHintBelowOled}>{slideHint}</Text> : null}
                  </View>
                  <View style={{ height: scrollBottomPad }} pointerEvents="none" />
                </View>
              </View>
            ) : (
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
            )}
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
              oledDarkBillboard && styles.backChipOled,
              pressed && styles.backChipPressed,
            ]}>
            <Ionicons name="chevron-back" size={22} color={oledDarkBillboard ? '#fdfefe' : palette.heroInk} />
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
    ...typography.compact,
    fontSize: 13,
    color: profileTypography.subdued,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  boldLink: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: palette.heroInk,
    letterSpacing: -0.3,
    textAlign: 'center',
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
    ...typography.body,
    fontSize: 17,
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
  tertiaryBold: {
    fontSize: 15,
    lineHeight: 20,
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
      android: {},
      default: {},
    }),
  },
  sheetCardOled: {
    position: 'relative',
    width: SCREEN_W,
    alignSelf: 'center',
    backgroundColor: palette.sheet,
    borderRadius: 26,
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
    paddingTop: 36,
    paddingBottom: 12,
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
    marginTop: 10,
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
    zIndex: 26,
    paddingHorizontal: 28,
    paddingVertical: 18,
    pointerEvents: 'box-none',
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
  /** OLED sign-in / sign-up: flat primary pill (matches `PrimaryButton` primary). */
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  ctaOledSolidLabel: {
    fontSize: 17,
    fontWeight: '700',
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
    ...typography.caption,
    color: 'rgba(15,17,21,0.48)',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 10,
    lineHeight: 14,
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
    fontSize: 18,
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
