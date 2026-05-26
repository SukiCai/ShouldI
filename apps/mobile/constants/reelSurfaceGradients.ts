import type { DecisionCategory, ExploreCard } from '@shouldi/contracts';

import { profileLight } from '@/constants/theme';

/** Profile-tab canvas / warm paper — aligns with `themeSurface('light').canvas` + hero panels. */
const PROFILE_CANVAS = '#f7f9fb';

const { sky, mint, pink } = profileLight;

/**
 * Category washes tinted from Profile pastel triad — ends on the same ivory canvas as You / Decide.
 */
export const REEL_SURFACE_GRADIENTS: Record<
  DecisionCategory,
  readonly [string, string, string, string, string]
> = {
  life: [`${mint}a8`, `${mint}62`, `#d5f8f1`, PROFILE_CANVAS, '#fffcf9'],
  career: [`${sky}9c`, `${sky}52`, `#d9f6fd`, PROFILE_CANVAS, '#fffcf9'],
  relationship: [`${pink}a0`, `${pink}54`, `#fce7f1`, PROFILE_CANVAS, '#fffcf9'],
  money: ['#f9c98a', '#fce3c5', `#fef5eb`, PROFILE_CANVAS, '#fffcf9'],
};

/** Stops paired with `REEL_SURFACE_GRADIENTS` for reel card + similar surfaces. */
export const REEL_SURFACE_MAIN_LOCATIONS = [0, 0.24, 0.48, 0.73, 1] as const;

/** Legacy three-stop timings for simpler full-screen backgrounds. */
export const REEL_SURFACE_LOCATIONS = [0, 0.52, 1] as const;

/** Top-corner chroma bloom — matches Profile sky / mint / pink energy. */
export const REEL_SURFACE_FLARE: Record<DecisionCategory, readonly [string, string]> = {
  life: ['rgba(45,212,191,0.38)', 'rgba(255,255,255,0)'],
  career: ['rgba(73,205,235,0.36)', 'rgba(255,255,255,0)'],
  relationship: ['rgba(236,122,184,0.36)', 'rgba(255,255,255,0)'],
  money: ['rgba(245,158,11,0.34)', 'rgba(255,255,255,0)'],
};

/**
 * Diagonal base wash — leading corner chroma settles to Profile canvas → white (static, legible).
 */
export const REEL_PANEL_DIAGONAL: Record<DecisionCategory, readonly [string, string, string]> = {
  life: [`${mint}52`, PROFILE_CANVAS, '#ffffff'],
  career: [`${sky}54`, PROFILE_CANVAS, '#ffffff'],
  relationship: [`${pink}56`, PROFILE_CANVAS, '#ffffff'],
  money: ['rgba(251,191,36,0.45)', PROFILE_CANVAS, '#ffffff'],
};

/** Subtle Profile sky/pink veil (bottom-left → top-right). */
export const REEL_CROSS_WASH_LIGHT: readonly [string, string, string] = [
  `${sky}22`,
  'rgba(247,249,251,0)',
  `${pink}18`,
] as const;

/** Top-lit paper edge — keeps depth without muddy mid-tones. */
export const REEL_EDGE_GLOSS: readonly [string, string, string] = [
  'rgba(255,255,255,0.78)',
  'rgba(255,255,255,0.14)',
  'rgba(255,255,255,0)',
] as const;

export function reelSurfaceGradientCoarse(category: DecisionCategory): readonly [string, string, string] {
  const g = REEL_SURFACE_GRADIENTS[category];
  return [g[0], g[2], g[4]];
}

export function parseReelCategoryParam(raw: unknown): DecisionCategory | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return undefined;
  if (['life', 'career', 'relationship', 'money'].includes(v)) return v as DecisionCategory;
  return undefined;
}

/** Decide category gradient for Decide detail / Discuss while feed data may still be loading. */
export function reelDiscussBackdropCategory(
  card: ExploreCard | undefined,
  reelCategoryRaw: unknown,
): DecisionCategory {
  return card?.category ?? parseReelCategoryParam(reelCategoryRaw) ?? 'life';
}

/** Orb specs for Explore reel liquid layer — anchored 0–1 inside the card, sized vs min(w,h). */
export type LiquidBlobSpec = Readonly<{
  relDiameter: number;
  ax: number;
  ay: number;
  color: string;
  phaseOffset?: number;
  motionGain?: number;
}>;

/** Liquid blobs — teal / cyan / blush / apricot keyed to Profile accents. */
export const REEL_CARD_LIQUID_BLOBS: Record<DecisionCategory, readonly LiquidBlobSpec[]> = {
  life: [
    { relDiameter: 0.82, ax: 0.12, ay: 0.1, color: 'rgba(45,212,191,0.34)', phaseOffset: 1.35, motionGain: 1 },
    { relDiameter: 0.58, ax: 0.78, ay: 0.72, color: 'rgba(149,239,226,0.3)', phaseOffset: 4.15, motionGain: 0.85 },
    { relDiameter: 0.45, ax: 0.52, ay: 0.28, color: 'rgba(255,253,251,0.52)', phaseOffset: 2.72, motionGain: 0.92 },
    { relDiameter: 0.36, ax: 0.38, ay: 0.88, color: 'rgba(73,205,235,0.22)', phaseOffset: 5.4, motionGain: 0.72 },
  ],
  career: [
    { relDiameter: 0.78, ax: 0.1, ay: 0.2, color: 'rgba(73,205,235,0.33)', phaseOffset: 0.6, motionGain: 1 },
    { relDiameter: 0.55, ax: 0.76, ay: 0.66, color: 'rgba(165,236,247,0.28)', phaseOffset: 3.7, motionGain: 0.82 },
    { relDiameter: 0.42, ax: 0.48, ay: 0.36, color: 'rgba(255,254,251,0.48)', phaseOffset: 2.1, motionGain: 0.95 },
    { relDiameter: 0.38, ax: 0.32, ay: 0.82, color: 'rgba(45,212,191,0.22)', phaseOffset: 5.95, motionGain: 0.76 },
  ],
  relationship: [
    { relDiameter: 0.8, ax: 0.14, ay: 0.14, color: 'rgba(236,122,184,0.34)', phaseOffset: 2.05, motionGain: 1 },
    { relDiameter: 0.56, ax: 0.74, ay: 0.7, color: 'rgba(248,206,229,0.3)', phaseOffset: 4.82, motionGain: 0.87 },
    { relDiameter: 0.46, ax: 0.5, ay: 0.32, color: 'rgba(255,251,253,0.5)', phaseOffset: 0.94, motionGain: 0.93 },
    { relDiameter: 0.34, ax: 0.36, ay: 0.86, color: 'rgba(73,205,235,0.2)', phaseOffset: 6.1, motionGain: 0.71 },
  ],
  money: [
    { relDiameter: 0.76, ax: 0.11, ay: 0.18, color: 'rgba(251,191,36,0.32)', phaseOffset: 2.61, motionGain: 1 },
    { relDiameter: 0.54, ax: 0.74, ay: 0.68, color: 'rgba(253,230,206,0.34)', phaseOffset: 5.15, motionGain: 0.82 },
    { relDiameter: 0.46, ax: 0.47, ay: 0.34, color: 'rgba(255,251,246,0.5)', phaseOffset: 0.73, motionGain: 0.93 },
    { relDiameter: 0.37, ax: 0.36, ay: 0.84, color: 'rgba(236,122,184,0.18)', phaseOffset: 4.43, motionGain: 0.73 },
  ],
};
