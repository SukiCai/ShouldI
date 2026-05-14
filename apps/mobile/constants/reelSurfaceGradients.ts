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
