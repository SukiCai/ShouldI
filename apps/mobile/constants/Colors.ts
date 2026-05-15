import { palette } from './theme';

const tintColorLight = palette.neonMint;
const tintColorDark = palette.neonMint;

export default {
  light: {
    text: palette.slate950,
    background: palette.sheet,
    tint: tintColorLight,
    tabIconDefault: 'rgba(15,23,42,0.42)',
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
