import { StyleSheet } from 'react-native';

import { screenContentGutter, typography } from '@/constants/theme';

/** Canonical header chrome shared across Explore, Decide, Replay, and You tabs. */
export const tabScreenStyles = StyleSheet.create({
  headerBlock: {
    paddingHorizontal: screenContentGutter,
    marginBottom: 16,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  title: {
    ...typography.tabDisplay,
  },
  subtitle: {
    ...typography.compact,
    marginTop: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
});
