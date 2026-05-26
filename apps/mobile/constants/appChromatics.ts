import { palette, profileLight, themeSurface, type ThemeSurface } from '@/constants/theme';

/**
 * Full chrome for Profile tab + any screen that should match it (accents, tabs, wallet CTAs).
 */
export type AppChromatics = {
  textPrimary: string;
  textMuted: string;
  display: string;
  sky: string;
  pink: string;
  mint: string;
  tabActive: string;
  tabInactive: string;
  tabUnderline: string;
  tabTrack: string;
  linkSignIn: string;
  linkJoin: string;
  walletUsd: string;
  walletRate: string;
  walletDisc: string;
  walletRateBg: string;
  walletRateBorder: string;
  ctaOnGradient: string;
  liveDot: string;
  liveText: string;
  liveBorder: string;
  liveBg: string;
  gearIcon: string;
};

function buildChromatics(isDark: boolean, surface?: ThemeSurface): AppChromatics {
  const L = profileLight;
  if (!isDark) {
    return {
      textPrimary: L.body,
      textMuted: L.muted,
      display: L.ink,
      sky: L.sky,
      pink: L.pink,
      mint: L.mint,
      tabActive: L.sky,
      tabInactive: L.tabInactive,
      tabUnderline: L.sky,
      tabTrack: L.tabTrack,
      linkSignIn: L.sky,
      linkJoin: L.pink,
      walletUsd: L.emphasis,
      walletRate: L.emphasis,
      walletDisc: L.muted,
      walletRateBg: `${L.sky}18`,
      walletRateBorder: `${L.sky}45`,
      ctaOnGradient: L.ctaOnGradient,
      liveDot: L.sky,
      liveText: L.muted,
      liveBorder: `${L.sky}50`,
      liveBg: `${L.sky}14`,
      gearIcon: L.ink,
    };
  }
  const s = surface ?? themeSurface('dark');
  return {
    textPrimary: s.textPrimary,
    textMuted: s.textMuted,
    display: s.textPrimary,
    sky: palette.neonSky,
    pink: palette.neonPink,
    mint: palette.neonMint,
    tabActive: s.textPrimary,
    tabInactive: s.textMuted,
    tabUnderline: palette.neonMint,
    tabTrack: s.hairline,
    linkSignIn: palette.neonSky,
    linkJoin: palette.neonMint,
    walletUsd: palette.neonMint,
    walletRate: palette.neonMint,
    walletDisc: s.textMuted,
    walletRateBg: 'rgba(61,255,184,0.07)',
    walletRateBorder: `${palette.neonMint}30`,
    ctaOnGradient: palette.heroInk,
    liveDot: palette.neonMint,
    liveText: palette.neonMint,
    liveBorder: `${palette.neonMint}40`,
    liveBg: `${palette.neonMint}09`,
    gearIcon: s.textPrimary,
  };
}

/** Resolve Profile-matched chromatics; pass `surface` from `themeSurface(scheme)` when available. */
export function resolveAppChromatics(isDark: boolean, surface: ThemeSurface | undefined): AppChromatics {
  return buildChromatics(isDark, surface);
}

/** Alias kept for call sites that named this after the You tab. */
export const resolveYouChromatics = resolveAppChromatics;
