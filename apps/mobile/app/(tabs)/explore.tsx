import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  decisionFeedStatus,
  PagedDecisionFeed,
} from '@/components/explore/PagedDecisionFeed';
import { ExploreCanvasBackdrop } from '@/components/explore/ExploreCanvasBackdrop';
import { Button, EmptyState } from '@/components/ui';
import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import { ExploreMomentHeader } from '@/components/ui/ExploreMomentHeader';
import { screenContentGutter, palette, themeSurface } from '@/constants/theme';
import { apiGetJson, GATEWAY_ORIGIN } from '@/lib/api';
import { useViewerPointsBalance } from '@/lib/useViewerPointsBalance';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { useColorScheme } from '@/components/useColorScheme';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  const { balance: viewerPointsBalance, hydrated: pointsHydrated, awardPoints } =
    useViewerPointsBalance();
  const query = useQuery({
    queryKey: ['explore'],
    queryFn: async () => {
      const json = await apiGetJson('/v1/explore');
      return ExploreFeedResponseSchema.parse(json);
    },
  });

  const cards = query.data?.cards ?? [];
  const openCards = React.useMemo(
    () => cards.filter((c) => decisionFeedStatus(c) === 'open'),
    [cards],
  );

  if (query.isLoading) {
    return <AppLaunchScreen detail="Loading reels…" />;
  }

  if (query.error) {
    return (
      <View style={[styles.surface, styles.errorFill, { backgroundColor: isDark ? surface.canvas : palette.white }]}>
        <ExploreCanvasBackdrop isDark={isDark} />
        <EmptyState
          title="Couldn't connect"
          body={`Trying ${GATEWAY_ORIGIN}\n\nRun npm run api locally`}
          actionLabel="Retry"
          onAction={() => query.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.surface, { backgroundColor: isDark ? surface.canvas : palette.white }]}>
      <ExploreCanvasBackdrop isDark={isDark} />
      <View style={styles.chromeLayer}>
        <View style={[styles.headerWrap, { paddingTop: Math.max(6, insets.top + 2) }]}>
          <ExploreMomentHeader
            caseCount={openCards.length}
            viewerPointsBalance={viewerPointsBalance}
            pointsHydrated={pointsHydrated}
            variant="minimal"
            footerLink={{
              label: 'Outcomes ›',
              accessibilityHint:
                'Open reels that already ended — community results and lessons.',
              onPress: () => router.push('/plot-deck'),
            }}
          />
        </View>

        {openCards.length === 0 ? (
          <EmptyState
            title="You're caught up"
            body="Pull down to refresh, or peek at finished dilemmas when you're ready."
            footer={
              <Button
                variant="ghost"
                label="Browse outcomes"
                accessibilityLabel="Browse outcomes"
                accessibilityHint="Open reels that already ended — community results and lessons."
                onPress={() => router.push('/plot-deck')}
                style={styles.emptyAction}
              />
            }
          />
        ) : (
          <PagedDecisionFeed
            cards={openCards}
            headerChromeEstimate={90}
            bottomOverlayExtra={88}
            isFetching={query.isFetching}
            onRefresh={() => query.refetch()}
            celebrateLandingHero
            onEarnExploreVotePoints={awardPoints}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    overflow: 'hidden',
  },
  chromeLayer: {
    flex: 1,
    zIndex: 1,
    minHeight: 0,
    overflow: 'visible',
  },
  headerWrap: {
    position: 'relative',
    zIndex: 20,
    elevation: 20,
    paddingHorizontal: screenContentGutter,
    paddingBottom: 2,
    overflow: 'visible',
  },
  emptyAction: {
    marginTop: 8,
    minWidth: 180,
  },
  errorFill: {
    flex: 1,
  },
});
