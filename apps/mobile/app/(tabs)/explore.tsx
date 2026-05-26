import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  decisionFeedStatus,
  PagedDecisionFeed,
} from '@/components/explore/PagedDecisionFeed';
import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { ExploreMomentHeader } from '@/components/ui/ExploreMomentHeader';
import { OledFluorSpeckles } from '@/components/ui/OledSignUpBackdrop';
import { palette, themeSurface, typography } from '@/constants/theme';
import { apiGetJson, GATEWAY_ORIGIN } from '@/lib/api';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { useColorScheme } from '@/components/useColorScheme';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
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
    return <AppLaunchScreen detail="Fetching live reels…" />;
  }

  if (query.error) {
    return (
      <View style={[styles.center, styles.errorPad, { backgroundColor: surface.canvas }]}>
        <View style={styles.canvasSpeckles} pointerEvents="none">
          <OledFluorSpeckles />
        </View>
        <Text style={[typography.title, styles.sheetTitle, { color: surface.textPrimary }]}>Couldn’t connect to ShouldI API</Text>
        <Text style={[typography.body, styles.centerText, { color: surface.textMuted }]}>
          Trying <Text style={styles.monoDim}>{GATEWAY_ORIGIN}</Text>
        </Text>
        <Text style={[typography.caption, styles.centerText, { color: surface.textMuted }]}>
          Start API: npm run api or docker compose up
        </Text>
        <PrimaryButton accessibilityLabel="Retry loading explore cards" onPress={() => query.refetch()}>
          <Text style={styles.buttonLabel}>Retry</Text>
        </PrimaryButton>
      </View>
    );
  }

  return (
    <View style={[styles.surface, { backgroundColor: surface.canvas }]}>
      <View style={styles.canvasSpeckles} pointerEvents="none">
        <OledFluorSpeckles />
      </View>
      <View style={[styles.headerWrap, { paddingTop: Math.max(6, insets.top + 2) }]}>
        <ExploreMomentHeader
          caseCount={openCards.length}
          variant="minimal"
          footerLink={{
            label: 'Plot Deck ›',
            accessibilityHint:
              'Open Plot Deck — vertical reel of dilemmas after the community voted, with outcomes.',
            onPress: () => router.push('/plot-deck'),
          }}
        />
      </View>

      {openCards.length === 0 ? (
        <View style={styles.emptyFrame}>
          <Text style={[typography.title, styles.emptyTitle, { color: surface.textPrimary }]}>You’re caught up</Text>
          <Text style={[typography.body, styles.emptyBody, { color: surface.textMuted }]}>
            No live dilemmas in the reel right now. Flip to the Plot Deck for resolved arcs—or pull to refresh later.
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
            <Text style={[styles.plotDeckGhostText, { color: surface.textPrimary }]}>Open Plot Deck</Text>
            <Text style={styles.plotDeckGhostArrow}>→</Text>
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    overflow: 'hidden',
  },
  canvasSpeckles: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  headerWrap: {
    paddingHorizontal: 14,
    paddingBottom: 2,
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
    color: palette.neonMint,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
