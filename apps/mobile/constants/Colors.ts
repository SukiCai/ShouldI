import { palette } from './theme';

const tintColorLight = palette.neonMint;
const tintColorDark = palette.white;

export default {
  light: {
    text: palette.slate950,
    background: palette.sheet,
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: palette.white,
    background: palette.slate950,
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};
