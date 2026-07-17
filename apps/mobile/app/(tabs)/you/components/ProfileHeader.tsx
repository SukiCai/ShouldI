import { router } from 'expo-router';
import * as React from 'react';

import { TabHeaderIconButton, TabScreenHeader } from '@/components/screen/TabScreenHeader';
import { themeSurface } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';

type ProfileHeaderProps = {
  textDisplay: string;
  textMuted: string;
};

export function ProfileHeader({ textDisplay, textMuted }: ProfileHeaderProps) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);

  return (
    <TabScreenHeader
      title="Profile"
      textDisplay={textDisplay}
      textMuted={textMuted}
      groupedSurface={surface.groupedSurface}
      hairline={surface.hairline}
      textPrimary={surface.textPrimary}
      blockStyle={{ marginBottom: 12 }}
      subtitle="Understand your patterns. Make better decisions."
      action={
        <TabHeaderIconButton
          icon="settings-outline"
          accessibilityLabel="Open settings"
          onPress={() => router.push('/settings')}
          groupedSurface={surface.groupedSurface}
          hairline={surface.hairline}
          iconColor={surface.textPrimary}
          iconSize={22}
        />
      }
    />
  );
}
