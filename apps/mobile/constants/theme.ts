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

  /** Airy canvas (Gen Z SaaS — soft clay / cool gray). Cards float above this. */
  mist: '#f2f5fb',

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

export const radius = {
  pill: 999,
  lg: 20,
  md: 16,
};
