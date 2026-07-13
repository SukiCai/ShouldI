import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import { resolveAppChromatics } from '@/constants/appChromatics';
import { themeSurface } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';

import { youScreenStyles as styles } from './youScreenStyles';

type ProfileHeaderProps = {
  textDisplay: string;
  textMuted: string;
};

export function ProfileHeader({ textDisplay, textMuted }: ProfileHeaderProps) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const chrom = resolveAppChromatics(scheme === 'dark', surface);

  return (
    <View style={[styles.sectionWrap, { marginBottom: 8 }]}>
      <View style={styles.profileTitleRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: textDisplay }]}>Profile</Text>
          <Text style={[styles.subtitle, { color: textMuted }]}>Understand your patterns.</Text>
          <Text style={[styles.subtitle, { color: textMuted, marginTop: 0 }]}>Make better decisions.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push('/settings')}
          hitSlop={10}
          style={({ pressed }) => [styles.gearBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="settings-outline" size={22} color={chrom.gearIcon} />
        </Pressable>
      </View>
    </View>
  );
}
