import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { youScreenStyles as styles } from './youScreenStyles';

type Shortcut = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

const SHORTCUTS: Shortcut[] = [
  { id: 'personal', icon: 'person-outline', title: 'Personal info', subtitle: 'Name and preferences' },
  { id: 'notifications', icon: 'notifications-outline', title: 'Notifications', subtitle: 'Thread and replay alerts' },
  { id: 'privacy', icon: 'shield-outline', title: 'Privacy & data', subtitle: 'Export and retention' },
  { id: 'appearance', icon: 'color-palette-outline', title: 'Appearance', subtitle: 'Theme and display' },
];

type ProfileSettingsShortcutsProps = {
  textPrimary: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  hairline: string;
};

export function ProfileSettingsShortcuts({
  textPrimary,
  textMuted,
  groupedSurface,
  groupedBorder,
  hairline,
}: ProfileSettingsShortcutsProps) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={[styles.threadsTitle, { color: textPrimary }]}>Profile & settings</Text>
      <View
        style={[
          styles.feedCard,
          { backgroundColor: groupedSurface, borderColor: groupedBorder, gap: 0, paddingVertical: 4 },
        ]}>
        {SHORTCUTS.map((item, index) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [
              styles.settingsRow,
              index < SHORTCUTS.length - 1 && {
                borderBottomColor: hairline,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
              pressed && { opacity: 0.9 },
            ]}>
            <View style={[styles.settingsIconWrap, { backgroundColor: groupedBorder }]}>
              <Ionicons name={item.icon} size={16} color={textMuted} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.cardTitle, { color: textPrimary }]}>{item.title}</Text>
              <Text style={[styles.postFoot, { color: textMuted }]}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={textMuted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
