import { palette, profileLight } from './theme';

const tintColorLight = profileLight.sky;
const tintColorDark = palette.neonMint;

export default {
  light: {
    text: profileLight.body,
    background: palette.sheet,
    tint: tintColorLight,
    tabIconDefault: profileLight.tabInactive,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: palette.textOnCanvas,
    background: palette.mist,
    tint: tintColorDark,
    tabIconDefault: 'rgba(237,241,246,0.45)',
    tabIconSelected: tintColorDark,
  },
};
