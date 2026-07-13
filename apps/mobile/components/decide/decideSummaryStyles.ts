import { Platform, StyleSheet } from 'react-native';

import { palette, screenContentGutter, typography } from '@/constants/theme';

export const decideSummaryStyles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  sectionEyebrow: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  sectionHint: {
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 16,
  },
  heroInput: {
    ...typography.hero,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    fontWeight: '800',
    padding: 0,
    margin: 0,
  },
  bodyInput: {
    ...typography.compact,
    lineHeight: 21,
    fontWeight: '500',
    padding: 0,
    margin: 0,
    minHeight: 24,
  },
  multilineInput: {
    ...typography.compact,
    lineHeight: 21,
    fontWeight: '500',
    padding: 0,
    margin: 0,
    minHeight: 56,
    maxHeight: 140,
    textAlignVertical: 'top',
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  confidenceValue: {
    ...typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  confidenceTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.heroInk,
  },
  optionList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  optionRow: {
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionRowLast: {
    borderBottomWidth: 0,
  },
  optionRowSelected: {
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionInput: {
    flex: 1,
    minWidth: 0,
    ...typography.compact,
    fontWeight: '600',
    lineHeight: 18,
    padding: 0,
    margin: 0,
  },
  suggestedPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  suggestedPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  momentRow: {
    gap: 2,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  momentTitle: {
    ...typography.compact,
    fontWeight: '600',
    lineHeight: 18,
  },
  momentSub: {
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 16,
  },
  expertCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  expertTitle: {
    ...typography.caption,
    fontWeight: '600',
  },
  composerHint: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  composerHintText: {
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  confirmLead: {
    ...typography.compact,
    lineHeight: 20,
    marginBottom: 14,
  },
  confirmScroll: {
    flexGrow: 1,
    paddingHorizontal: screenContentGutter,
  },
  confirmActions: {
    marginTop: 20,
    gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
  },
  primaryBtn: {
    minHeight: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: palette.heroInk,
  },
  primaryBtnText: {
    ...typography.compact,
    color: palette.white,
    fontWeight: '700',
  },
  secondaryBtn: {
    minHeight: 46,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryBtnText: {
    ...typography.compact,
    fontWeight: '600',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexBtn: {
    flex: 1,
  },
  errorBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    ...typography.compact,
    fontWeight: '600',
    lineHeight: 20,
  },
  helper: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 18,
  },
});
