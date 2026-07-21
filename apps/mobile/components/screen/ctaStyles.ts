import { StyleSheet } from 'react-native';

import { palette, radius, semantic, typography } from '@/constants/theme';

/** Primary / secondary CTA recipes shared across PMF tabs. */
export const ctaStyles = StyleSheet.create({
  primary: {
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: semantic.actionPrimary,
  },
  primaryLabel: {
    ...typography.compact,
    color: palette.sheet,
    fontWeight: '700',
  },
  secondary: {
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryLabel: {
    ...typography.compact,
    fontWeight: '700',
  },
  segmentChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  segmentChipLabel: {
    ...typography.compact,
    fontWeight: '600',
  },
  segmentChipLabelActive: {
    fontWeight: '700',
  },
});
