import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetJson } from '@/lib/api';
import { usePostedCommunityCards } from '@/lib/exploreCommunityPosts';
import { latestDecisionRecord, resolveProfileScreen } from '@/lib/profileScreenData';
import { useViewerEntitlements } from '@/lib/useViewerEntitlements';
import { themeSurface } from '@/constants/theme';
import { DecisionDnaProfileSchema, DecisionRecordSchema } from '@shouldi/contracts';

import { ProfileDnaCard } from '@/app/(tabs)/you/components/ProfileDnaCard';
import { ProfileGrowthSection } from '@/app/(tabs)/you/components/ProfileGrowthSection';
import { ProfileHeader } from '@/app/(tabs)/you/components/ProfileHeader';
import { ProfileIdentityCard } from '@/app/(tabs)/you/components/ProfileIdentityCard';
import { ProfileStatsRow } from '@/app/(tabs)/you/components/ProfileStatsRow';
import { RecentDecisionsSection } from '@/app/(tabs)/you/components/RecentDecisionsSection';
import { YouFocusCard } from '@/app/(tabs)/you/components/YouFocusCard';
import { youScreenStyles as styles } from '@/app/(tabs)/you/components/youScreenStyles';

type DecisionsListResponse = { decisions: Array<unknown> };

export default function YouScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();
  const { hydrated: entitlementsHydrated, isPremium } = useViewerEntitlements();
  const communityPosts = usePostedCommunityCards();

  const dnaQuery = useQuery({
    queryKey: ['me-dna'],
    queryFn: async () => {
      const data = await apiGetJson('/v1/me/dna');
      return DecisionDnaProfileSchema.parse(data);
    },
  });

  const decisionsQuery = useQuery({
    queryKey: ['decisions'],
    queryFn: async () => {
      const data = await apiGetJson('/v1/decisions');
      const list = (data as DecisionsListResponse).decisions ?? [];
      return list.map((item) => DecisionRecordSchema.parse(item));
    },
  });

  const decisionsReady = decisionsQuery.isSuccess || decisionsQuery.isError;
  const isBootstrapping =
    !entitlementsHydrated || (!decisionsReady && decisionsQuery.isLoading);

  if (isBootstrapping) {
    return <AppLaunchScreen detail="Loading your profile…" />;
  }

  const profile = resolveProfileScreen({
    decisions: decisionsQuery.data ?? [],
    dna: dnaQuery.data,
    isPremium,
    decisionsReady,
  });

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
          displayName={profile.displayName}
          isPremium={profile.isPremium}
          decisionsCount={profile.decisionsCount}
          memberSinceLabel={profile.memberSinceLabel}
          textDisplay={surface.textDisplay}
          textMuted={surface.textMuted}
        />

        <View style={styles.sectionWrap}>
          <YouFocusCard
            latestDecision={latestDecisionRecord(profile.decisions)}
            communityPostCount={communityPosts.length}
            textDisplay={surface.textDisplay}
            textMuted={surface.textMuted}
            groupedSurface={surface.groupedSurface}
            groupedBorder={surface.groupedBorder}
          />
        </View>

        <ProfileStatsRow
          stats={profile.momentumStats}
          textDisplay={surface.textDisplay}
          textMuted={surface.textMuted}
          statTileBg={surface.statTileBg}
          statTileBorder={surface.statTileBorder}
        />

        <RecentDecisionsSection
          decisions={profile.recentDecisions}
          textDisplay={surface.textDisplay}
          textPrimary={surface.textPrimary}
          textMuted={surface.textMuted}
          groupedSurface={surface.groupedSurface}
          groupedBorder={surface.groupedBorder}
          hairline={surface.hairline}
        />

        <ProfileDnaCard
          summary={profile.dnaSummary}
          dimensions={profile.dnaDimensions}
          decisionsCount={profile.decisionsCount}
          textDisplay={surface.textDisplay}
          textPrimary={surface.textPrimary}
          textMuted={surface.textMuted}
          groupedSurface={surface.groupedSurface}
          groupedBorder={surface.groupedBorder}
        />

        <ProfileGrowthSection
          cards={profile.growthCards}
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
