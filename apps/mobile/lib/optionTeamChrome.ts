import { StyleSheet } from 'react-native';

import { semantic, type ThemeSurface } from '@/constants/theme';

/** Stable option identity palette — index 0 warm, 1 cool, then cycle semantic tokens. */
const OPTION_IDENTITY_COLORS = [
  semantic.actionDanger,
  semantic.actionPrimary,
  semantic.actionAffirm,
  semantic.actionCaution,
] as const;

export type OptionTeamEmphasis = 'default' | 'user' | 'ai' | 'userAndAi';

export function resolveOptionIndex(options: ReadonlyArray<{ id: string }>, optionId: string): number {
  const i = options.findIndex((o) => o.id === optionId);
  return i >= 0 ? i : 0;
}

export function optionTeamColorByIndex(index: number): string {
  const normalized = ((index % OPTION_IDENTITY_COLORS.length) + OPTION_IDENTITY_COLORS.length) % OPTION_IDENTITY_COLORS.length;
  return OPTION_IDENTITY_COLORS[normalized]!;
}

export function optionTeamColor(options: ReadonlyArray<{ id: string }>, optionId: string): string {
  return optionTeamColorByIndex(resolveOptionIndex(options, optionId));
}

export function optionLabelForId(
  options: ReadonlyArray<{ id: string; label: string }>,
  optionId: string,
  fallback = 'this option',
): string {
  return options.find((o) => o.id === optionId)?.label?.trim() || fallback;
}

/** Character budgets for tight UI — rows prefer `numberOfLines` + ellipsize. */
export const OPTION_LABEL_MAX = {
  chip: 18,
  filter: 14,
  cta: 40,
  sheet: 48,
} as const;

export function truncateOptionLabel(label: string, maxChars: number): string {
  const trimmed = label.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxChars) return trimmed;
  if (maxChars <= 1) return '…';
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

export function optionLabelForIdCompact(
  options: ReadonlyArray<{ id: string; label: string }>,
  optionId: string,
  maxChars: number,
  fallback = 'this option',
): string {
  return truncateOptionLabel(optionLabelForId(options, optionId, fallback), maxChars) || fallback;
}

/** Discussion / filter chip — reasoning is tied to an option label, not a “team”. */
export function optionAffiliationLabel(
  optionLabel: string,
  maxLabelChars: number = OPTION_LABEL_MAX.chip,
): string {
  const trimmed = optionLabel.trim();
  if (!trimmed) return 'For this option';
  const short = truncateOptionLabel(trimmed, maxLabelChars);
  return short ? `For ${short}` : 'For this option';
}

export function optionActionLabel(
  prefix: string,
  optionLabel: string,
  maxLabelChars: number = OPTION_LABEL_MAX.cta,
): string {
  const short = truncateOptionLabel(optionLabel, maxLabelChars);
  return `${prefix} ${short || 'this option'}`;
}

export function optionTeamSoftBg(colorOrIndex: number | string, alpha = '14'): string {
  const color = typeof colorOrIndex === 'number' ? optionTeamColorByIndex(colorOrIndex) : colorOrIndex;
  return `${color}${alpha}`;
}

export function optionTeamBorder(colorOrIndex: number | string, alpha = '52'): string {
  const color = typeof colorOrIndex === 'number' ? optionTeamColorByIndex(colorOrIndex) : colorOrIndex;
  return `${color}${alpha}`;
}

export function optionTeamBarFill(teamColor: string, emphasis: 'neutral' | 'user' | 'ai'): string {
  if (emphasis === 'user') return teamColor;
  if (emphasis === 'ai') return `${teamColor}cc`;
  return `${teamColor}55`;
}

/** Pill chrome for reel / feed option rows — border + fill follow the option's identity color. */
export function optionTeamPillChrome(
  optionIndex: number,
  surface: ThemeSurface,
  emphasis: OptionTeamEmphasis,
) {
  const optionColor = optionTeamColorByIndex(optionIndex);
  const strongBorder = optionTeamBorder(optionColor, '66');

  if (emphasis === 'user') {
    return {
      borderWidth: 2,
      borderColor: strongBorder,
      backgroundColor: optionTeamSoftBg(optionColor, '12'),
    } as const;
  }
  if (emphasis === 'ai') {
    return {
      borderWidth: 2,
      borderColor: surface.hairline,
      backgroundColor: surface.canvas,
      borderLeftWidth: 4,
      borderLeftColor: optionColor,
    } as const;
  }
  if (emphasis === 'userAndAi') {
    return {
      borderWidth: 2,
      borderColor: strongBorder,
      backgroundColor: optionTeamSoftBg(optionColor, '12'),
      borderLeftWidth: 4,
      borderLeftColor: optionColor,
    } as const;
  }
  return {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: optionTeamBorder(optionColor, '38'),
    backgroundColor: optionTeamSoftBg(optionColor, '0a'),
  } as const;
}
