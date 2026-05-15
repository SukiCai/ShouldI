export const palette = {
  /** Ink family — dusty blue-grey (trust, editorial). */
  slate950: '#2c343c',
  slate900: '#383f48',
  slate800: '#434d58',
  slate500: '#6b7582',
  slate200: '#c5cfd8',
  slate100: '#e4eaef',

  /** Warm ivory surfaces vs cold white — premium paper (legacy shells). */
  white: '#faf8f6',

  /** True white cards/sheets paired with airy gray chrome. */
  sheet: '#ffffff',

  /** Soft pill/input fill — matches airy “signup sheet” fields. */
  field: '#f0f0f0',

  /** App canvas — OLED black (billboard chrome, aligns with Sign-up hero). White sheets float above. */
  mist: '#000000',

  /** Gradient midpoint over black (hero / splash); use as #RRGGBBAA suffix on strings. */
  nightWash: '#141a22',

  /** Primary copy on OLED canvas — matches sign-up `heroTitleOled`. */
  textOnCanvas: '#ffffff',
  /** Secondary line on OLED — matches sign-up `heroSubOled`. */
  textMutedOnCanvas: 'rgba(247,247,247,0.58)',

  /** Hairlines on OLED chrome (dock, stack rails). */
  chromeHairline: 'rgba(255,255,255,0.12)',

  /** Mint rim from sign-up mist CTA pill — reuse on primary buttons / hero frames. */
  signUpMintHairline: 'rgba(61,255,184,0.22)',

  /** Ink for filled CTAs; keep punchy blacks on pastel chrome. */
  heroInk: '#0d0d11',

  /** Neon accents — fluorescent pastels against black. */
  neonPink: '#ff4d94',
  neonMint: '#3dffb8',
  neonSky: '#54dcff',
  neonCitron: '#f7ff94',

  /** Primary: dusty cobalt — links & secondary gradients. */
  accent: '#4f76c2',
  /** Companion stop (gradients, highlights); dusty sea-glass teal. */
  accentBloom: '#4da89b',
  /** Light wash for pills/fields sitting on WHITE cards only — not billboard canvas. */
  accentSoft: '#e6ecf5',

  /** Success / affirmation / logo hub — Morandi teal-sage with lift. */
  mint: '#5fa995',

  /** Playful accent — warm terracotta (moments that should feel cheeky-delightful). */
  playful: '#c9746a',

  warning: '#b0893d',
  danger: '#a85d64',

  /** Dark hero washes (splash): prefer full ink for billboard moments. */
  nightInk: '#000000',

  /** Companion hero stops — still visible on OLED black. */
  nightSlate: '#1a2229',
  nightHorizon: '#283039',

  /** Pastel bokeh (hero overlays); use at low opacity — tuned slightly brighter vs mist. */
  bokehPink: '#fda5d7',
  bokehViolet: '#cfb8ff',
  bokehMint: '#6cffa8',
  bokehSky: '#7bdcff',

  /** Live pulse on light chrome — mint pop without glow overload. */
  livePulse: '#10b981',

  /** Mid blend of accent + bloom — Expo splash/adaptive backdrop while letterboxing. */
  backdropMid: '#4f96b5',
};

export const typography = {
  hero: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600' as const,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  h2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400' as const,
  },
  compact: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
};

export const spacing = {
  xs: 6,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
};

/** Horizontal inset for `Screen` padded mode — use same value when measuring full-width layouts (grids, tabs). */
export const screenContentGutter = 20;

export const radius = {
  pill: 999,
  lg: 20,
  md: 16,
};

/** Semantic surfaces for light vs dark canvas (Profile, Settings, Screen, tabs chrome). */
export function themeSurface(scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  return {
    canvas: isDark ? palette.mist : '#f1f5f9',
    canvasSecondary: isDark ? palette.nightWash : '#e2e8f0',
    textPrimary: isDark ? palette.textOnCanvas : '#0f172a',
    textMuted: isDark ? palette.textMutedOnCanvas : 'rgba(15,23,42,0.58)',
    hairline: isDark ? palette.chromeHairline : 'rgba(15,23,42,0.1)',
    sheet: palette.sheet,
    sheetBorder: isDark ? 'rgba(15,23,42,0.06)' : 'rgba(15,23,42,0.08)',
    heroBorder: isDark ? palette.signUpMintHairline : 'rgba(15,23,42,0.1)',
    tabBar: isDark ? palette.mist : '#f8fafc',
    tabBarBorder: isDark ? palette.chromeHairline : 'rgba(15,23,42,0.08)',
    inactiveTab: isDark ? palette.textMutedOnCanvas : 'rgba(15,23,42,0.45)',
    statTileBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.95)',
    statTileBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)',
    pressedOverlay: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
  };
}
