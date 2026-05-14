import type { DecisionCategory } from '@shouldi/contracts';

export const REEL_SURFACE_GRADIENTS: Record<DecisionCategory, readonly [string, string, string]> = {
  /** Editorial-tint washes — airy, readable on white UI chrome. */
  life: ['#d4cbfa', '#f4f2fc', '#fff8fb'],
  career: ['#c5daff', '#eff6ff', '#f2fcfa'],
  relationship: ['#f2c4ec', '#faf5ff', '#fff5f9'],
  money: ['#ffd8b8', '#fff7ed', '#f0fcf6'],
};

export const REEL_SURFACE_LOCATIONS = [0, 0.52, 1] as const;

export function parseReelCategoryParam(raw: unknown): DecisionCategory | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return undefined;
  if (['life', 'career', 'relationship', 'money'].includes(v)) return v as DecisionCategory;
  return undefined;
}
