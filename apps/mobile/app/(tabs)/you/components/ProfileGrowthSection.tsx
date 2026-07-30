import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Text, View } from 'react-native';

import type { ProfileGrowthCardMock } from '@/lib/profileMockData';

import { ProfileSpringPress } from './profileMotion';
import { youScreenStyles as styles } from './youScreenStyles';

type ProfileGrowthSectionProps = {
  cards: ProfileGrowthCardMock[];
  textDisplay: string;
  textPrimary: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  hairline: string;
};

function cardDestination(tone: ProfileGrowthCardMock['tone']) {
  switch (tone) {
    case 'strength':
    case 'focus':
      return () => router.replace('/(tabs)/replay');
    case 'growth':
      return () => router.replace('/(tabs)/decide');
  }
}

export function ProfileGrowthSection({
  cards,
  textDisplay,
  textPrimary,
  textMuted,
  groupedSurface,
  groupedBorder,
  hairline,
}: ProfileGrowthSectionProps) {
  return (
    <View style={styles.sectionWrap}>
      <View
        style={[
          styles.insightFeedCard,
          styles.insightCardShell,
          styles.growthCardShell,
          { backgroundColor: groupedSurface, borderColor: groupedBorder },
        ]}>
        <ProfileSpringPress
          accessibilityRole="button"
          accessibilityLabel="Open Growth insights"
          haptic="selection"
          onPress={() => router.replace('/(tabs)/replay')}
          style={styles.insightCardHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={[styles.insightCardTitle, { color: textDisplay }]}>Growth</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={textMuted} />
        </ProfileSpringPress>

        <View style={styles.growthColumnsRow}>
          {cards.map((card, index) => {
            const isLast = index === cards.length - 1;
            return (
              <React.Fragment key={card.id}>
                <ProfileSpringPress
                  accessibilityRole="button"
                  accessibilityLabel={card.title}
                  haptic="none"
                  onPress={cardDestination(card.tone)}
                  style={styles.growthColumn}>
                  <View style={[styles.growthIconWrap, { backgroundColor: card.iconBg }]}>
                    <Ionicons name={card.icon} size={18} color={card.iconColor} />
                  </View>
                  <Text style={[styles.growthCardTitle, { color: textPrimary }]} numberOfLines={2}>
                    {card.title}
                  </Text>
                  <Text style={[styles.growthCardBody, { color: textMuted }]} numberOfLines={4}>
                    {card.body}
                  </Text>
                </ProfileSpringPress>
                {!isLast ? <View style={[styles.growthColumnDivider, { backgroundColor: hairline }]} /> : null}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
}
