import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  decisionFeedStatus,
  PagedDecisionFeed,
} from '@/components/explore/PagedDecisionFeed';
import { ExploreCanvasBackdrop } from '@/components/explore/ExploreCanvasBackdrop';
import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { ExploreMomentHeader } from '@/components/ui/ExploreMomentHeader';
import { palette, profileLight, themeSurface, typography } from '@/constants/theme';
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
        <View style={[styles.center, styles.errorPad]}>
          <Text style={[typography.title, styles.sheetTitle, { color: surface.textPrimary }]}>Couldn’t connect</Text>
          <Text style={[typography.body, styles.centerText, { color: surface.textMuted }]}>
            Trying <Text style={styles.monoDim}>{GATEWAY_ORIGIN}</Text>
          </Text>
          <Text style={[typography.caption, styles.centerText, { color: surface.textMuted }]}>
            Run <Text style={styles.monoDim}>npm run api</Text> locally
          </Text>
          <PrimaryButton accessibilityLabel="Retry loading explore cards" onPress={() => query.refetch()}>
            <Text style={styles.buttonLabel}>Retry</Text>
          </PrimaryButton>
        </View>
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
          <View style={styles.emptyFrame}>
            <Text style={[typography.title, styles.emptyTitle, { color: surface.textPrimary }]}>You’re caught up</Text>
            <Text style={[typography.body, styles.emptyBody, { color: surface.textMuted }]}>
              Pull down to refresh, or peek at finished dilemmas when you’re ready.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/plot-deck')}
              style={[
                styles.plotDeckGhost,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : palette.sheet,
                  borderColor: surface.hairline,
                },
              ]}>
              <Text style={[styles.plotDeckGhostText, { color: surface.textPrimary }]}>Browse outcomes</Text>
              <Text style={[styles.plotDeckGhostArrow, { color: isDark ? palette.neonMint : profileLight.sky }]}>
                →
              </Text>
            </Pressable>
          </View>
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
    paddingHorizontal: 14,
    paddingBottom: 2,
    overflow: 'visible',
  },
  emptyFrame: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
    marginBottom: 80,
  },
  emptyTitle: {
    color: palette.textOnCanvas,
    textAlign: 'center',
  },
  emptyBody: {
    color: palette.textMutedOnCanvas,
    textAlign: 'center',
    lineHeight: 23,
  },
  plotDeckGhost: {
    alignSelf: 'center',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  plotDeckGhostText: {
    ...typography.compact,
    fontWeight: '700',
  },
  plotDeckGhostArrow: {
    ...typography.compact,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    zIndex: 1,
  },
  errorFill: {
    flex: 1,
  },
  errorPad: {
    paddingHorizontal: 24,
  },
  centerText: {
    textAlign: 'center',
  },
  sheetTitle: {
    color: palette.textOnCanvas,
    textAlign: 'center',
    marginBottom: 4,
  },
  mutedDark: {
    color: palette.textMutedOnCanvas,
    textAlign: 'center',
  },
  monoDim: {
    ...typography.caption,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: palette.neonSky,
  },
  buttonLabel: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 16,
  },
});
