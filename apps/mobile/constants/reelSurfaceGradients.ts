import type { DecisionCategory, ExploreCard } from '@shouldi/contracts';

/**
 * Dusty Morandi washes with higher chroma corners — luminous mid for copy legibility,
 * drifting to warm ivory (not clinical white).
 */
export const REEL_SURFACE_GRADIENTS: Record<
  DecisionCategory,
  readonly [string, string, string, string, string]
> = {
  life: ['#b9aedd', '#cdc2e9', '#e8e4f6', '#f7f7fb', '#fffcf9'],
  career: ['#9bbada', '#b7cee7', '#dee9f8', '#f0f4fb', '#fffcf9'],
  relationship: ['#d9b9d9', '#e7ccdf', '#f4ecf6', '#fbf8fc', '#fffcf9'],
  money: ['#e8c089', '#f0d7b8', '#f9eedf', '#fdf9f6', '#fffcf9'],
};

/** Stops paired with `REEL_SURFACE_GRADIENTS` for reel card + similar surfaces. */
export const REEL_SURFACE_MAIN_LOCATIONS = [0, 0.24, 0.48, 0.73, 1] as const;

/** Legacy three-stop timings for simpler full-screen backgrounds. */
export const REEL_SURFACE_LOCATIONS = [0, 0.52, 1] as const;

/** Top-corner chroma bloom — dusty violets, blues, blush, apricot flares. */
export const REEL_SURFACE_FLARE: Record<DecisionCategory, readonly [string, string]> = {
  life: ['rgba(118,103,172,0.34)', 'rgba(255,255,255,0)'],
  career: ['rgba(79,126,164,0.32)', 'rgba(255,255,255,0)'],
  relationship: ['rgba(176,129,169,0.33)', 'rgba(255,255,255,0)'],
  money: ['rgba(204,154,94,0.36)', 'rgba(255,255,255,0)'],
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

/** Liquid blobs tinted to match Morandi category hues. */
export const REEL_CARD_LIQUID_BLOBS: Record<DecisionCategory, readonly LiquidBlobSpec[]> = {
  life: [
    { relDiameter: 0.82, ax: 0.12, ay: 0.1, color: 'rgba(116,109,174,0.34)', phaseOffset: 1.35, motionGain: 1 },
    { relDiameter: 0.58, ax: 0.78, ay: 0.72, color: 'rgba(198,177,229,0.3)', phaseOffset: 4.15, motionGain: 0.85 },
    { relDiameter: 0.45, ax: 0.52, ay: 0.28, color: 'rgba(255,252,247,0.52)', phaseOffset: 2.72, motionGain: 0.92 },
    { relDiameter: 0.36, ax: 0.38, ay: 0.88, color: 'rgba(152,143,207,0.26)', phaseOffset: 5.4, motionGain: 0.72 },
  ],
  career: [
    { relDiameter: 0.78, ax: 0.1, ay: 0.2, color: 'rgba(78,134,174,0.31)', phaseOffset: 0.6, motionGain: 1 },
    { relDiameter: 0.55, ax: 0.76, ay: 0.66, color: 'rgba(132,173,207,0.28)', phaseOffset: 3.7, motionGain: 0.82 },
    { relDiameter: 0.42, ax: 0.48, ay: 0.36, color: 'rgba(255,252,248,0.48)', phaseOffset: 2.1, motionGain: 0.95 },
    { relDiameter: 0.38, ax: 0.32, ay: 0.82, color: 'rgba(102,154,188,0.24)', phaseOffset: 5.95, motionGain: 0.76 },
  ],
  relationship: [
    { relDiameter: 0.8, ax: 0.14, ay: 0.14, color: 'rgba(184,135,173,0.34)', phaseOffset: 2.05, motionGain: 1 },
    { relDiameter: 0.56, ax: 0.74, ay: 0.7, color: 'rgba(230,206,237,0.3)', phaseOffset: 4.82, motionGain: 0.87 },
    { relDiameter: 0.46, ax: 0.5, ay: 0.32, color: 'rgba(255,251,253,0.5)', phaseOffset: 0.94, motionGain: 0.93 },
    { relDiameter: 0.34, ax: 0.36, ay: 0.86, color: 'rgba(200,162,207,0.26)', phaseOffset: 6.1, motionGain: 0.71 },
  ],
  money: [
    { relDiameter: 0.76, ax: 0.11, ay: 0.18, color: 'rgba(212,157,108,0.34)', phaseOffset: 2.61, motionGain: 1 },
    { relDiameter: 0.54, ax: 0.74, ay: 0.68, color: 'rgba(240,218,173,0.31)', phaseOffset: 5.15, motionGain: 0.82 },
    { relDiameter: 0.46, ax: 0.47, ay: 0.34, color: 'rgba(255,251,247,0.5)', phaseOffset: 0.73, motionGain: 0.93 },
    { relDiameter: 0.37, ax: 0.36, ay: 0.84, color: 'rgba(225,174,117,0.27)', phaseOffset: 4.43, motionGain: 0.73 },
  ],
};
