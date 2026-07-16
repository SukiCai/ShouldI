import { router } from 'expo-router';
import * as React from 'react';
import { Text } from 'react-native';

import { TabHeaderIconButton, TabScreenHeader } from '@/components/screen/TabScreenHeader';
import { tabScreenStyles as styles } from '@/components/screen/tabScreenStyles';
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
      blockStyle={{ marginBottom: 8 }}
      subtitle={
        <>
          <Text style={[styles.subtitle, { color: textMuted }]}>Understand your patterns.</Text>
          <Text style={[styles.subtitle, { color: textMuted, marginTop: 0 }]}>
            Make better decisions.
          </Text>
        </>
      }
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
