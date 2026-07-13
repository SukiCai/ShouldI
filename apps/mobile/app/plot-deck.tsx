import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  decisionFeedStatus,
  PagedDecisionFeed,
  OUTCOME_REPLAY_SWIPE_CUES,
} from '@/components/explore/PagedDecisionFeed';
import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import { Button } from '@/components/ui';
import { palette, screenContentGutter, semantic, themeSurface, typography } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetJson, GATEWAY_ORIGIN } from '@/lib/api';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

export default function PlotDeckScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);

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
    return <AppLaunchScreen detail="Loading Outcome Replay…" />;
  }

  if (query.error) {
    return (
      <View style={[styles.center, styles.errorPad, { backgroundColor: surface.canvas }]}>
        <Text style={[typography.title, styles.sheetHead, { color: surface.textDisplay }]}>Couldn’t load Outcome Replay</Text>
        <Text style={[typography.body, styles.centerText, { color: surface.textMuted }]}>
          Trying <Text style={styles.monoGlow}>{GATEWAY_ORIGIN}</Text>
        </Text>
        <Button accessibilityLabel="Retry loading Outcome Replay" onPress={() => query.refetch()}>
          <Text style={styles.buttonLabel}>Retry</Text>
        </Button>
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
    <View style={[styles.surface, { backgroundColor: surface.canvas }]}>
      <View
        style={[
          styles.headerRow,
          {
            paddingTop: Math.max(insets.top + 10, 28),
          },
        ]}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: surface.textDisplay }]}>Replay</Text>
          <Text style={[styles.subtitle, { color: surface.textMuted }]}>Review outcomes and calibrate your next decision.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Explore"
          onPress={() => router.replace('/(tabs)/explore')}
          style={[styles.iconCircle, { backgroundColor: surface.groupedSurface, borderColor: surface.hairline }]}>
          <Ionicons name="compass-outline" size={20} color={surface.textPrimary} />
        </Pressable>
      </View>

      {resolvedCards.length === 0 ? (
        <View style={styles.emptyFrame}>
          <Text style={[typography.title, styles.emptyTitle, { color: surface.textDisplay }]}>No outcome replays yet</Text>
          <Text style={[typography.body, styles.emptyBody, { color: surface.textMuted }]}>
            Hop back to Explore for live dilemmas, then return once outcomes close.
          </Text>
          <Button accessibilityLabel="Go to Explore" onPress={() => router.replace('/(tabs)/explore')}>
            <Text style={styles.buttonLabel}>Explore live decisions</Text>
          </Button>
        </View>
      ) : (
        <PagedDecisionFeed
          cards={resolvedCards}
          headerChromeEstimate={44}
          bottomOverlayExtra={24}
          swipeCues={OUTCOME_REPLAY_SWIPE_CUES}
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
    backgroundColor: '#f5f5f7',
    overflow: 'hidden',
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenContentGutter,
    marginBottom: 8,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  title: {
    ...typography.hero,
    color: '#0c0d10',
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.8,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.compact,
    color: 'rgba(60,60,67,0.72)',
    marginTop: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.2)',
  },
  emptyFrame: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  emptyTitle: {
    color: '#111113',
  },
  emptyBody: {
    color: 'rgba(60,60,67,0.72)',
    lineHeight: 23,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 20,
  },
  errorPad: {
    paddingHorizontal: 24,
  },
  centerText: {
    textAlign: 'center',
  },
  sheetHead: {
    color: '#111113',
    textAlign: 'center',
    marginBottom: 4,
  },
  mutedOnBlack: {
    color: 'rgba(60,60,67,0.72)',
  },
  monoGlow: {
    ...typography.caption,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: semantic.actionPrimary,
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
    color: semantic.actionPrimary,
    textAlign: 'center',
  },
});
