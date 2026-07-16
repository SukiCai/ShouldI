import * as React from 'react';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, type ThemeSurface, themeSurface, typography, semantic } from '@/constants/theme';

/** Runtime text color helpers — use instead of `profileTypography` on PMF surfaces. */
export function pmfText(surface: ThemeSurface) {
  return {
    display: { color: surface.textDisplay },
    primary: { color: surface.textPrimary },
    muted: { color: surface.textMuted },
    onAction: { color: palette.sheet },
  } as const;
}

export function usePmfSurface(): ThemeSurface {
  const scheme = useColorScheme();
  return React.useMemo(() => themeSurface(scheme), [scheme]);
}

export const pmfTypography = {
  sectionEyebrow: {
    ...typography.caption,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  badgeLabel: {
    ...typography.label,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
};

/** Option pill chrome for Explore / Replay reel cards — replaces cobalt/ink editorial frames. */
export function reelOptionPillChrome(
  surface: ThemeSurface,
  emphasis: 'default' | 'user' | 'ai' | 'userAndAi',
) {
  if (emphasis === 'user') {
    return {
      borderWidth: 2,
      borderColor: `${semantic.actionPrimary}55`,
      backgroundColor: `${semantic.actionPrimary}10`,
    } as const;
  }
  if (emphasis === 'ai') {
    return {
      borderWidth: 2,
      borderColor: surface.hairline,
      backgroundColor: surface.canvas,
    } as const;
  }
  if (emphasis === 'userAndAi') {
    return {
      borderWidth: 1,
      borderColor: surface.groupedBorder,
      backgroundColor: surface.groupedSurface,
      borderLeftWidth: 4,
      borderLeftColor: semantic.actionPrimary,
      borderRightWidth: 4,
      borderRightColor: surface.textMuted,
    } as const;
  }
  return {
    borderColor: surface.groupedBorder,
    backgroundColor: surface.groupedSurface,
  } as const;
}

export function reelVoteBadgeChrome(kind: 'user' | 'ai', surface: ThemeSurface) {
  if (kind === 'user') {
    return {
      shell: {
        backgroundColor: `${semantic.actionPrimary}18`,
        borderColor: `${semantic.actionPrimary}40`,
      },
      text: { color: semantic.actionPrimary },
    } as const;
  }
  return {
    shell: {
      backgroundColor: surface.textDisplay,
      borderColor: surface.hairline,
    },
    text: { color: palette.sheet },
  } as const;
}
