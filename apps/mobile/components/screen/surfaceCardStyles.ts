import { StyleSheet } from 'react-native';

import { elevation, radius } from '@/constants/theme';

/** Grouped card chrome for PMF tab surfaces (Explore, Decide, Replay, You). */
export const surfaceCardStyles = StyleSheet.create({
  grouped: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    ...elevation.rest,
  },
  focus: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 10,
    ...elevation.raised,
  },
  insight: {
    borderRadius: radius.hero,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
    ...elevation.rest,
  },
});
