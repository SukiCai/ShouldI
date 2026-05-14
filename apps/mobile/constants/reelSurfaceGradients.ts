import type { DecisionCategory } from '@shouldi/contracts';

/**
 * Five-stop category washes — deeper chroma toward the corners, luminous mid,
 * lifting to white where body copy sits for contrast.
 */
export const REEL_SURFACE_GRADIENTS: Record<
  DecisionCategory,
  readonly [string, string, string, string, string]
> = {
  life: ['#c7b9ff', '#ddd4ff', '#ece8ff', '#f7f5ff', '#ffffff'],
  career: ['#9dc2fb', '#c5dcfd', '#e3eefc', '#f3f8fe', '#ffffff'],
  relationship: ['#dfb8fc', '#ead5ff', '#f3ebff', '#faf7ff', '#ffffff'],
  money: ['#f4c892', '#f7deb8', '#fbf0dd', '#fdfaf4', '#ffffff'],
};

/** Stops paired with `REEL_SURFACE_GRADIENTS` for reel card + similar surfaces. */
export const REEL_SURFACE_MAIN_LOCATIONS = [0, 0.24, 0.48, 0.73, 1] as const;

/** Legacy three-stop timings for simpler full-screen backgrounds. */
export const REEL_SURFACE_LOCATIONS = [0, 0.52, 1] as const;

/** Top-corner chroma bloom (additive over base wash). */
export const REEL_SURFACE_FLARE: Record<DecisionCategory, readonly [string, string]> = {
  life: ['rgba(124,94,232,0.38)', 'rgba(255,255,255,0)'],
  career: ['rgba(46,138,246,0.34)', 'rgba(255,255,255,0)'],
  relationship: ['rgba(192,116,229,0.36)', 'rgba(255,255,255,0)'],
  money: ['rgba(232,157,62,0.4)', 'rgba(255,255,255,0)'],
};

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

/** Orb specs for Explore reel liquid layer — anchored 0–1 inside the card, sized vs min(w,h). */
export type LiquidBlobSpec = Readonly<{
  relDiameter: number;
  ax: number;
  ay: number;
  color: string;
  phaseOffset?: number;
  motionGain?: number;
}>;

/** Pastel blobs that drift independently (phase offsets separate them in animation). */
export const REEL_CARD_LIQUID_BLOBS: Record<DecisionCategory, readonly LiquidBlobSpec[]> = {
  life: [
    { relDiameter: 0.82, ax: 0.12, ay: 0.1, color: 'rgba(124,107,229,0.38)', phaseOffset: 1.35, motionGain: 1 },
    { relDiameter: 0.58, ax: 0.78, ay: 0.72, color: 'rgba(200,172,252,0.32)', phaseOffset: 4.15, motionGain: 0.85 },
    { relDiameter: 0.45, ax: 0.52, ay: 0.28, color: 'rgba(255,253,254,0.55)', phaseOffset: 2.72, motionGain: 0.92 },
    { relDiameter: 0.36, ax: 0.38, ay: 0.88, color: 'rgba(163,146,239,0.28)', phaseOffset: 5.4, motionGain: 0.72 },
  ],
  career: [
    { relDiameter: 0.78, ax: 0.1, ay: 0.2, color: 'rgba(64,154,239,0.34)', phaseOffset: 0.6, motionGain: 1 },
    { relDiameter: 0.55, ax: 0.76, ay: 0.66, color: 'rgba(130,184,246,0.3)', phaseOffset: 3.7, motionGain: 0.82 },
    { relDiameter: 0.42, ax: 0.48, ay: 0.36, color: 'rgba(255,255,255,0.5)', phaseOffset: 2.1, motionGain: 0.95 },
    { relDiameter: 0.38, ax: 0.32, ay: 0.82, color: 'rgba(95,173,239,0.26)', phaseOffset: 5.95, motionGain: 0.76 },
  ],
  relationship: [
    { relDiameter: 0.8, ax: 0.14, ay: 0.14, color: 'rgba(194,139,239,0.36)', phaseOffset: 2.05, motionGain: 1 },
    { relDiameter: 0.56, ax: 0.74, ay: 0.7, color: 'rgba(235,207,251,0.32)', phaseOffset: 4.82, motionGain: 0.87 },
    { relDiameter: 0.46, ax: 0.5, ay: 0.32, color: 'rgba(255,252,255,0.52)', phaseOffset: 0.94, motionGain: 0.93 },
    { relDiameter: 0.34, ax: 0.36, ay: 0.86, color: 'rgba(208,157,239,0.27)', phaseOffset: 6.1, motionGain: 0.71 },
  ],
  money: [
    { relDiameter: 0.76, ax: 0.11, ay: 0.18, color: 'rgba(235,173,73,0.36)', phaseOffset: 2.61, motionGain: 1 },
    { relDiameter: 0.54, ax: 0.74, ay: 0.68, color: 'rgba(249,216,157,0.32)', phaseOffset: 5.15, motionGain: 0.82 },
    { relDiameter: 0.46, ax: 0.47, ay: 0.34, color: 'rgba(255,251,246,0.52)', phaseOffset: 0.73, motionGain: 0.93 },
    { relDiameter: 0.37, ax: 0.36, ay: 0.84, color: 'rgba(242,182,103,0.28)', phaseOffset: 4.43, motionGain: 0.73 },
  ],
};
