import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { council } from '@/constants/theme';

import { youScreenStyles as styles } from './youScreenStyles';

const MOCK_AVATAR = require('@/assets/images/profile-mock-avatar.jpg');

type ProfileIdentityCardProps = {
  displayName: string;
  isPremium: boolean;
  decisionsCount: number;
  memberSinceLabel: string;
  textDisplay: string;
  textMuted: string;
};

export function ProfileIdentityCard({
  displayName,
  isPremium,
  decisionsCount,
  memberSinceLabel,
  textDisplay,
  textMuted,
}: ProfileIdentityCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View profile settings"
      onPress={() => router.push('/settings')}
      style={({ pressed }) => [styles.identityRow, pressed && { opacity: 0.9 }]}>
      <Image source={MOCK_AVATAR} style={styles.profileAvatarImage} />
      <View style={styles.identityCopy}>
        <View style={styles.identityNameRow}>
          <Text style={[styles.identityName, { color: textDisplay }]} numberOfLines={1}>
            {displayName}
          </Text>
          {isPremium ? (
            <View style={[styles.premiumPill, { backgroundColor: `${council.violet}18` }]}>
              <Ionicons name="star" size={10} color={council.violet} />
              <Text style={[styles.premiumPillText, { color: council.violet }]}>Premium</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.identityMetaRow}>
          <Ionicons name="locate-outline" size={12} color={textMuted} />
          <Text style={[styles.identityMeta, { color: textMuted }]}>
            {decisionsCount} decision{decisionsCount === 1 ? '' : 's'} made
          </Text>
        </View>
        <View style={styles.identityMetaRow}>
          <Ionicons name="calendar-outline" size={12} color={textMuted} />
          <Text style={[styles.identityMeta, { color: textMuted }]}>{memberSinceLabel}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={textMuted} />
    </Pressable>
  );
}
