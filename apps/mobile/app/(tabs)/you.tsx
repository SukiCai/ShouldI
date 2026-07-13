import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { themeSurface } from '@/constants/theme';
import { PROFILE_MOCK } from '@/lib/profileMockData';

import { ProfileDnaCard } from '@/app/(tabs)/you/components/ProfileDnaCard';
import { ProfileGrowthSection } from '@/app/(tabs)/you/components/ProfileGrowthSection';
import { ProfileHeader } from '@/app/(tabs)/you/components/ProfileHeader';
import { ProfileIdentityCard } from '@/app/(tabs)/you/components/ProfileIdentityCard';
import { ProfileQuoteCard } from '@/app/(tabs)/you/components/ProfileQuoteCard';
import { ProfileStatsRow } from '@/app/(tabs)/you/components/ProfileStatsRow';
import { RecentDecisionsSection } from '@/app/(tabs)/you/components/RecentDecisionsSection';
import { youScreenStyles as styles } from '@/app/(tabs)/you/components/youScreenStyles';

export default function YouScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();
  const mock = PROFILE_MOCK;

  return (
    <View style={[styles.surface, { backgroundColor: surface.canvas }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top + 10, 28),
          paddingBottom: Math.max(insets.bottom + 96, 120),
        }}
        showsVerticalScrollIndicator={false}>
        <ProfileHeader textDisplay={surface.textDisplay} textMuted={surface.textMuted} />

        <ProfileIdentityCard
          displayName={mock.displayName}
          isPremium={mock.isPremium}
          decisionsCount={mock.decisionsCount}
          memberSinceLabel={mock.memberSinceLabel}
          textDisplay={surface.textDisplay}
          textMuted={surface.textMuted}
        />

        <ProfileQuoteCard quote={mock.quote} textPrimary={surface.textPrimary} />

        <ProfileStatsRow
          stats={mock.stats}
          textDisplay={surface.textDisplay}
          textMuted={surface.textMuted}
          statTileBg={surface.statTileBg}
          statTileBorder={surface.statTileBorder}
        />

        <View style={{ height: 8 }} />

        <View style={styles.insightRow}>
          <ProfileDnaCard
            summary={mock.dnaSummary}
            dimensions={mock.dnaDimensions}
            textDisplay={surface.textDisplay}
            textPrimary={surface.textPrimary}
            textMuted={surface.textMuted}
            groupedSurface={surface.groupedSurface}
            groupedBorder={surface.groupedBorder}
            compact
          />

          <RecentDecisionsSection
            decisions={mock.recentDecisions}
            textDisplay={surface.textDisplay}
            textMuted={surface.textMuted}
            groupedSurface={surface.groupedSurface}
            groupedBorder={surface.groupedBorder}
            hairline={surface.hairline}
            compact
          />
        </View>

        <ProfileGrowthSection
          cards={mock.growthCards}
          textDisplay={surface.textDisplay}
          textPrimary={surface.textPrimary}
          textMuted={surface.textMuted}
          groupedSurface={surface.groupedSurface}
          groupedBorder={surface.groupedBorder}
          hairline={surface.hairline}
        />
      </ScrollView>
    </View>
  );
}
