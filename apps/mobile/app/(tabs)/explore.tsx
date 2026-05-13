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
import { palette, typography } from '@/constants/theme';
import { apiGetJson, GATEWAY_ORIGIN } from '@/lib/api';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.center, styles.errorPad]}>
        <Text style={typography.title}>Couldn’t connect to ShouldI API</Text>
        <Text style={[typography.body, styles.centerText, styles.muted]}>
          Trying <Text style={styles.mono}>{GATEWAY_ORIGIN}</Text>
        </Text>
        <Text style={[typography.caption, styles.centerText, styles.muted]}>
          Start API: npm run api or docker compose up
        </Text>
        <PrimaryButton accessibilityLabel="Retry loading explore cards" onPress={() => query.refetch()}>
          <Text style={styles.buttonLabel}>Retry</Text>
        </PrimaryButton>
      </View>
    );
  }

  return (
    <View style={styles.surface}>
      <View style={[styles.headerWrap, { paddingTop: Math.max(10, insets.top + 6) }]}>
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
          <Text style={[typography.title, styles.emptyTitle]}>You’re caught up</Text>
          <Text style={[typography.body, styles.emptyBody]}>
            No live dilemmas in the reel right now. Flip to the Plot Deck for resolved arcs—or pull to refresh later.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/plot-deck')} style={styles.plotDeckGhost}>
            <Text style={styles.plotDeckGhostText}>Open Plot Deck</Text>
            <Text style={styles.plotDeckGhostArrow}>→</Text>
          </Pressable>
        </View>
      ) : (
        <PagedDecisionFeed
          cards={openCards}
          headerChromeEstimate={124}
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
    backgroundColor: palette.mist,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 4,
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
    color: palette.slate900,
    textAlign: 'center',
  },
  emptyBody: {
    color: palette.slate800,
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
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cdd9ff',
    backgroundColor: palette.accentSoft,
  },
  plotDeckGhostText: {
    ...typography.compact,
    color: palette.accent,
    fontWeight: '700',
  },
  plotDeckGhostArrow: {
    ...typography.compact,
    color: palette.accent,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: palette.mist,
  },
  errorPad: {
    paddingHorizontal: 24,
  },
  centerText: {
    textAlign: 'center',
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
  },
});
