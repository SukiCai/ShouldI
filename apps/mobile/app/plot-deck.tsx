import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  decisionFeedStatus,
  PagedDecisionFeed,
  PLOT_DECK_SWIPE_CUES,
} from '@/components/explore/PagedDecisionFeed';
import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { palette, typography } from '@/constants/theme';
import { apiGetJson, GATEWAY_ORIGIN } from '@/lib/api';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

export default function PlotDeckScreen() {
  const insets = useSafeAreaInsets();

  const query = useQuery({
    queryKey: ['explore'],
    queryFn: async () => {
      const json = await apiGetJson('/v1/explore');
      return ExploreFeedResponseSchema.parse(json);
    },
  });

  const cards = query.data?.cards ?? [];
  const resolvedCards = React.useMemo(
    () => cards.filter((c) => decisionFeedStatus(c) === 'resolved'),
    [cards],
  );

  if (query.isLoading && !query.data) {
    return <AppLaunchScreen detail="Loading Plot Deck…" />;
  }

  if (query.error) {
    return (
      <View style={[styles.center, styles.errorPad]}>
        <Text style={[typography.title, styles.sheetHead]}>Couldn’t load Plot Deck</Text>
        <Text style={[typography.body, styles.centerText, styles.mutedOnBlack]}>
          Trying <Text style={styles.monoGlow}>{GATEWAY_ORIGIN}</Text>
        </Text>
        <PrimaryButton accessibilityLabel="Retry loading Plot Deck" onPress={() => query.refetch()}>
          <Text style={styles.buttonLabel}>Retry</Text>
        </PrimaryButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backLink, pressed && styles.backLinkPressed]}>
          <Text style={styles.backLinkText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.surface}>
      <Text style={[typography.caption, styles.lede, { paddingHorizontal: Math.max(16, insets.left || 16) }]}>
        After the herd voted — swipe outcomes like reels.
      </Text>

      {resolvedCards.length === 0 ? (
        <View style={styles.emptyFrame}>
          <Text style={[typography.title, styles.emptyTitle]}>No closed arcs yet</Text>
          <Text style={[typography.body, styles.emptyBody]}>Hop back to Explore for live dilemmas you can steer.</Text>
          <PrimaryButton accessibilityLabel="Go to Explore" onPress={() => router.replace('/(tabs)/explore')}>
            <Text style={styles.buttonLabel}>Explore live reels</Text>
          </PrimaryButton>
        </View>
      ) : (
        <PagedDecisionFeed
          cards={resolvedCards}
          headerChromeEstimate={44}
          bottomOverlayExtra={24}
          swipeCues={PLOT_DECK_SWIPE_CUES}
          isFetching={query.isFetching}
          onRefresh={() => query.refetch()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: palette.mist,
  },
  lede: {
    color: palette.slate500,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 6,
    marginBottom: 4,
    marginLeft: 4,
    lineHeight: 18,
    maxWidth: 360,
    alignSelf: 'flex-start',
  },
  emptyFrame: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  emptyTitle: {
    color: palette.slate950,
  },
  emptyBody: {
    color: palette.slate800,
    lineHeight: 23,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: palette.mist,
    paddingHorizontal: 20,
  },
  errorPad: {
    paddingHorizontal: 24,
  },
  centerText: {
    textAlign: 'center',
  },
  sheetHead: {
    color: palette.slate950,
    textAlign: 'center',
    marginBottom: 4,
  },
  mutedOnBlack: {
    color: palette.slate500,
  },
  monoGlow: {
    ...typography.caption,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: palette.neonSky,
  },
  mono: {
    ...typography.caption,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  muted: {
    color: palette.slate500,
  },
  buttonLabel: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  backLink: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backLinkPressed: {
    opacity: 0.7,
  },
  backLinkText: {
    ...typography.compact,
    fontWeight: '700',
    color: palette.neonMint,
    textAlign: 'center',
  },
});
