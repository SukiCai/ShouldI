import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetJson } from '@/lib/api';
import { resolveProfileScreen } from '@/lib/profileScreenData';
import { useViewerEntitlements } from '@/lib/useViewerEntitlements';
import { themeSurface } from '@/constants/theme';
import { DecisionDnaProfileSchema, DecisionRecordSchema } from '@shouldi/contracts';

import { ProfileSectionEntrance } from '@/components/you/profileMotion';
import { ProfileDnaCard } from '@/components/you/ProfileDnaCard';
import { ProfileHeader } from '@/components/you/ProfileHeader';
import { ProfilePerspectivesSection } from '@/components/you/ProfilePerspectivesSection';
import { RecentDecisionsSection } from '@/components/you/RecentDecisionsSection';
import { YouProfileHero } from '@/components/you/YouProfileHero';
import { youScreenStyles as styles } from '@/components/you/youScreenStyles';

type DecisionsListResponse = { decisions: Array<unknown> };

export default function YouScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();
  const { hydrated: entitlementsHydrated, isPremium, balance } = useViewerEntitlements();

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
        <ProfileSectionEntrance index={0}>
          <ProfileHeader textDisplay={surface.textDisplay} textMuted={surface.textMuted} />
        </ProfileSectionEntrance>

        <ProfileSectionEntrance index={1}>
          <View style={styles.sectionWrap}>
            <YouProfileHero
              displayName={profile.displayName}
              avatarEmoji={profile.avatarEmoji}
              avatarSource={profile.avatarSource}
              isPremium={isPremium}
              pointsBalance={balance}
              walletHydrated={entitlementsHydrated}
              decisionsCount={profile.decisionsCount}
              memberSinceLabel={profile.memberSinceLabel}
              showOnboardingCta={!profile.useDemo && profile.decisionsCount === 0}
              textDisplay={surface.textDisplay}
              textPrimary={surface.textPrimary}
              textMuted={surface.textMuted}
              groupedSurface={surface.groupedSurface}
              groupedBorder={surface.groupedBorder}
              hairline={surface.hairline}
            />
          </View>
        </ProfileSectionEntrance>

        <ProfileSectionEntrance index={2}>
          <ProfilePerspectivesSection
            lensLibraryUnlocked={profile.useDemo || profile.decisionsCount > 0}
            useDemo={profile.useDemo}
            textDisplay={surface.textDisplay}
            textPrimary={surface.textPrimary}
            textMuted={surface.textMuted}
            groupedSurface={surface.groupedSurface}
            groupedBorder={surface.groupedBorder}
            hairline={surface.hairline}
            modalBg={surface.sheet}
            isDark={scheme === 'dark'}
            bottomInset={insets.bottom}
          />
        </ProfileSectionEntrance>

        {profile.recentDecisions.length > 0 ? (
          <ProfileSectionEntrance index={3}>
            <RecentDecisionsSection
              decisions={profile.recentDecisions}
              textDisplay={surface.textDisplay}
              textPrimary={surface.textPrimary}
              textMuted={surface.textMuted}
              groupedSurface={surface.groupedSurface}
              groupedBorder={surface.groupedBorder}
              hairline={surface.hairline}
            />
          </ProfileSectionEntrance>
        ) : null}

        <ProfileSectionEntrance index={profile.recentDecisions.length > 0 ? 4 : 3}>
          <ProfileDnaCard
            summary={profile.dnaSummary}
            dimensions={profile.dnaDimensions}
            decisionsCount={profile.decisionsCount}
            metricsSubline={profile.dnaMetricsSubline}
            textDisplay={surface.textDisplay}
            textPrimary={surface.textPrimary}
            textMuted={surface.textMuted}
            groupedSurface={surface.groupedSurface}
            groupedBorder={surface.groupedBorder}
          />
        </ProfileSectionEntrance>
      </ScrollView>
    </View>
  );
}
