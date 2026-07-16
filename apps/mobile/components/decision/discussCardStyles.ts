import { Platform, StyleSheet } from 'react-native';

import { pmfText } from '@/components/screen/pmfChrome';
import { surfaceCardStyles } from '@/components/screen/surfaceCardStyles';
import { palette, radius, semantic, spacing, type ThemeSurface, typography } from '@/constants/theme';

/** Shared Discuss / Review-draft card chrome — colors via `discussCardColors(surface)`. */
export const discussCardStyles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  summarySection: {
    marginTop: 18,
    gap: 14,
  },
  aiDecisionCard: {
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  aiDecisionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  aiDecisionBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiDecisionBadgeText: {
    ...typography.label,
    letterSpacing: 0.6,
    color: palette.sheet,
  },
  aiDecisionPick: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.12,
    flex: 1,
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceLabel: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  aiDecisionHeadline: {
    ...typography.titleSm,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  aiDecisionReason: {
    ...typography.compact,
    lineHeight: 21,
    fontWeight: '500',
  },
  keyContextSection: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  keyContextEyebrow: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  momentCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  momentOrdinal: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  momentCardTitle: {
    ...typography.compact,
    fontWeight: '700',
    lineHeight: 20,
  },
  momentCardSub: {
    ...typography.caption,
    fontWeight: '500',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  aiReactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  aiReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  aiReactionLabel: {
    ...typography.caption,
    fontWeight: '800',
  },
  communitySectionHeader: {
    marginTop: 18,
    gap: 5,
    paddingHorizontal: 2,
  },
  communitySectionEyebrow: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  communitySectionTitle: {
    ...typography.h2,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  communitySectionBody: {
    ...typography.compact,
    lineHeight: 20,
    fontWeight: '500',
  },
  communitySectionMeta: {
    ...typography.caption,
    fontWeight: '700',
  },
  filterRail: {
    marginTop: 14,
    marginBottom: 2,
    flexGrow: 0,
  },
  filterRailContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: spacing.sm,
    gap: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 220,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.035,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  filterChipOn: {
    borderColor: `${semantic.actionPrimary}80`,
    backgroundColor: `${semantic.actionPrimary}18`,
  },
  filterChipText: {
    ...typography.compact,
    fontWeight: '600',
    flexShrink: 1,
  },
  filterChipTextOn: {
    color: semantic.actionPrimary,
  },
  filterStripe: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 2,
    flexShrink: 0,
  },
  threadList: {
    gap: 10,
    marginTop: 14,
  },
  threadRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 15,
    borderLeftWidth: 4,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  threadRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  threadEmoji: {
    fontSize: 16,
  },
  threadAuthor: {
    fontWeight: '700',
    flexShrink: 1,
  },
  threadTime: {
    ...typography.caption,
    marginLeft: 4,
    fontWeight: '600',
  },
  draftPill: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: `${semantic.actionPrimary}18`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${semantic.actionPrimary}45`,
  },
  draftPillText: {
    ...typography.caption,
    fontWeight: '800',
    color: semantic.actionPrimary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  threadBody: {
    ...typography.body,
    fontWeight: '400',
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  composerSheet: {
    marginTop: 18,
    gap: 10,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#0b1224',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  composerEyebrow: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  composerInput: {
    ...typography.body,
    lineHeight: 23,
    minHeight: 88,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
  addPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  addPreviewText: {
    ...typography.compact,
    color: semantic.actionPrimary,
    fontWeight: '700',
  },
  editableField: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});

/** Runtime color + surface fills for Discuss cards. */
export function discussCardColors(surface: ThemeSurface) {
  const t = pmfText(surface);
  return {
    aiDecisionCard: {
      backgroundColor: surface.groupedSurface,
      borderColor: surface.groupedBorder,
      borderLeftColor: surface.textDisplay,
    },
    aiDecisionBadge: { backgroundColor: surface.textDisplay },
    aiDecisionPick: t.muted,
    aiDecisionHeadline: t.display,
    aiDecisionReason: t.primary,
    keyContextSection: { borderTopColor: surface.hairline },
    keyContextEyebrow: t.muted,
    momentCard: {
      backgroundColor: surface.groupedSurface,
      borderColor: surface.groupedBorder,
    },
    momentOrdinal: t.muted,
    momentCardTitle: t.display,
    momentCardSub: t.muted,
    aiReactionPill: {
      backgroundColor: surface.groupedSurface,
      borderColor: surface.hairline,
    },
    aiReactionLabel: t.primary,
    communitySectionEyebrow: t.muted,
    communitySectionTitle: t.display,
    communitySectionBody: t.primary,
    communitySectionMeta: t.muted,
    filterChip: {
      backgroundColor: surface.groupedSurface,
      borderColor: surface.hairline,
    },
    filterChipText: t.primary,
    threadRow: {
      backgroundColor: surface.groupedSurface,
      borderColor: surface.hairline,
    },
    threadAuthor: t.primary,
    threadTime: t.muted,
    threadBody: t.primary,
    composerSheet: {
      backgroundColor: surface.groupedSurface,
      borderColor: surface.hairline,
    },
    composerEyebrow: t.muted,
    composerInput: t.primary,
  } as const;
}
