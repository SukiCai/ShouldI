import * as React from 'react';
import { Image, type ImageSourcePropType, Text, View } from 'react-native';

import { semantic } from '@/constants/theme';

import { youScreenStyles as styles } from './youScreenStyles';

type ProfileAvatarProps = {
  emoji?: string;
  imageSource?: ImageSourcePropType;
  size?: number;
  borderColor?: string;
  surfaceColor?: string;
};

export function ProfileAvatar({
  emoji = '🙂',
  imageSource,
  size = 56,
  borderColor,
  surfaceColor,
}: ProfileAvatarProps) {
  const radius = size / 2;
  const shellStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: borderColor ?? `${semantic.actionPrimary}22`,
    backgroundColor: surfaceColor ?? `${semantic.actionPrimary}10`,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (imageSource) {
    return (
      <View style={[styles.profileAvatar, shellStyle]}>
        <Image
          source={imageSource}
          accessibilityIgnoresInvertColors
          style={{
            width: size * 1.08,
            height: size * 1.22,
            marginTop: size * 0.08,
          }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[styles.profileAvatar, shellStyle]}>
      <Text style={[styles.profileAvatarEmoji, { fontSize: Math.round(size * 0.46) }]}>{emoji}</Text>
    </View>
  );
}
