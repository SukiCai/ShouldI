import type { ImageSourcePropType } from 'react-native';

/**
 * OLED hero — three busts (triangle layout); cropped figures (`user-char-xx.png`).
 */
export const HERO_AVATAR_CLUSTER: ImageSourcePropType[] = [
  require('./user-char-01.png'),
  require('./user-char-02.png'),
  require('./user-char-03.png'),
];

/**
 * Sign-up hero — same trio as {@link HERO_AVATAR_CLUSTER}.
 * Re-point these `require`s if you regenerate slices. Match sign-in OLED (`heroMotion="standard"` unless you boost motion).
 */
export const HERO_SIGNUP_AVATARS: ImageSourcePropType[] = [...HERO_AVATAR_CLUSTER];

/** Profile demo — Eleanor Park bust (matches sign-in character set). */
export const PROFILE_DEMO_AVATAR: ImageSourcePropType = require('./user-char-02.png');

export const DEFAULT_VIEWER_AVATAR_EMOJI = '🙂';
