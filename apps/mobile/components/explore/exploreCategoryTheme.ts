import { Ionicons } from '@expo/vector-icons';

import type { DecisionCategory } from '@shouldi/contracts';

export type ExploreCategoryTheme = {
  label: string;
  accent: string;
  soft: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CATEGORY_THEMES: Record<DecisionCategory, ExploreCategoryTheme> = {
  career: { label: 'Career', accent: '#4a7bd8', soft: '#ebf2ff', icon: 'briefcase-outline' },
  money: { label: 'Money', accent: '#c9a227', soft: '#fff8e4', icon: 'wallet-outline' },
  relationship: { label: 'Relationship', accent: '#d4567a', soft: '#fff0f4', icon: 'heart-outline' },
  life: { label: 'Life', accent: '#56b37c', soft: '#ebf8f0', icon: 'leaf-outline' },
};

/** Maps Explore feed category strings or Decide categories to card chrome. */
export function exploreCategoryTheme(category: string): ExploreCategoryTheme {
  const key = category.toLowerCase() as DecisionCategory;
  if (key in CATEGORY_THEMES) {
    return CATEGORY_THEMES[key as DecisionCategory];
  }
  if (category.toLowerCase().includes('education')) {
    return { label: 'Education', accent: '#8c7ae6', soft: '#f2edff', icon: 'school-outline' };
  }
  if (category.toLowerCase().includes('environment')) {
    return { label: 'Environment', accent: '#56b37c', soft: '#ebf8f0', icon: 'leaf-outline' };
  }
  if (category.toLowerCase().includes('tech')) {
    return { label: 'Technology', accent: '#e0b327', soft: '#fff8e4', icon: 'hardware-chip-outline' };
  }
  return { label: 'Trending', accent: '#7c8aa3', soft: '#eff2f7', icon: 'sparkles-outline' };
}
