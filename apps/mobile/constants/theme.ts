export const palette = {
  /** Ink family — dusty blue-grey (trust, editorial). */
  slate950: '#2c343c',
  slate900: '#383f48',
  slate800: '#434d58',
  slate500: '#6b7582',
  slate200: '#c5cfd8',
  slate100: '#e4eaef',

  /** Warm ivory surfaces vs cold white — premium paper. */
  white: '#faf8f6',
  mist: '#f1f2f4',

  /** Primary: saturated dusty cobalt — calm + credible CTAs & links. */
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

  /** Dark hero washes (splash, cinematic headers): blue-grey soot, never pure black. */
  nightInk: '#2d363e',
  nightSlate: '#3e4854',
  nightHorizon: '#4e5a67',

  /** Live / pulse indicator on light chrome. */
  livePulse: '#5ebf9f',

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
