import type { DecisionCategory } from '@shouldi/contracts';

export const REEL_SURFACE_GRADIENTS: Record<DecisionCategory, readonly [string, string, string]> = {
  life: ['#a87cff', '#f06dae', '#ffd0ec'],
  career: ['#3d83ff', '#36c5ff', '#9af3e8'],
  relationship: ['#ff5cb8', '#986fff', '#ffbce0'],
  money: ['#ff9f1c', '#f4d941', '#2dd4a7'],
};

export const REEL_SURFACE_LOCATIONS = [0, 0.52, 1] as const;

export function parseReelCategoryParam(raw: unknown): DecisionCategory | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return undefined;
  if (['life', 'career', 'relationship', 'money'].includes(v)) return v as DecisionCategory;
  return undefined;
}
