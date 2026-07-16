import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  decisionFeedStatus,
  PagedDecisionFeed,
  OUTCOME_REPLAY_SWIPE_CUES,
} from '@/components/explore/PagedDecisionFeed';
import { AppLaunchScreen } from '@/components/ui/AppLaunchScreen';
import { TabHeaderIconButton, TabScreenHeader } from '@/components/screen/TabScreenHeader';
import { ctaStyles } from '@/components/screen/ctaStyles';
import { GATEWAY_ORIGIN, apiGetJson } from '@/lib/api';
import { semantic, themeSurface } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { youScreenStyles as styles } from '@/app/(tabs)/you/components/youScreenStyles';

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
  const bottomOverlayExtra = Math.max(insets.bottom + 72, 88);

  if (query.isLoading && !query.data) {
    return <AppLaunchScreen detail="Loading Outcome Replay…" />;
  }

  if (query.error) {
    return (
      <View style={[styles.surface, localStyles.centered, { backgroundColor: surface.canvas }]}>
        <View
          style={[
            styles.focusCard,
            localStyles.stateCard,
            { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder },
          ]}>
          <Text style={[styles.focusTitle, { color: surface.textDisplay }]}>Couldn&apos;t load Replay</Text>
          <Text style={[styles.focusBody, { color: surface.textMuted, textAlign: 'center' }]}>
            Trying <Text style={localStyles.monoGlow}>{GATEWAY_ORIGIN}</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading Replay"
            onPress={() => query.refetch()}
            style={ctaStyles.primary}>
            <Text style={ctaStyles.primaryLabel}>Retry</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to previous screen"
            onPress={() => router.back()}
            style={({ pressed }) => [localStyles.ghostBtn, pressed && { opacity: 0.7 }]}>
            <Text style={[styles.cardBody, { color: semantic.actionPrimary, fontWeight: '700' }]}>
              Back
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.surface, { backgroundColor: surface.canvas }]}>
      <View style={{ paddingTop: Math.max(insets.top + 10, 28) }}>
        <TabScreenHeader
          title="Replay"
          subtitle="Review outcomes and calibrate your next decision."
          textDisplay={surface.textDisplay}
          textMuted={surface.textMuted}
          groupedSurface={surface.groupedSurface}
          hairline={surface.hairline}
          textPrimary={surface.textPrimary}
          action={
            <TabHeaderIconButton
              icon="compass-outline"
              accessibilityLabel="Back to Explore"
              onPress={() => router.replace('/(tabs)/explore')}
              groupedSurface={surface.groupedSurface}
              hairline={surface.hairline}
              iconColor={surface.textPrimary}
            />
          }
        />
      </View>

      {resolvedCards.length === 0 ? (
        <View style={[localStyles.emptyWrap, { paddingBottom: Math.max(insets.bottom + 96, 120) }]}>
          <View style={styles.sectionWrap}>
            <View
              style={[
                styles.focusCard,
                { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder },
              ]}>
              <Text style={[styles.sectionLabel, { color: surface.textMuted }]}>Outcome replay</Text>
              <Text style={[styles.focusTitle, { color: surface.textDisplay }]}>No outcome replays yet</Text>
              <Text style={[styles.focusBody, { color: surface.textMuted }]}>
                Hop back to Explore for live dilemmas, then return once outcomes close.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go to Explore"
                onPress={() => router.replace('/(tabs)/explore')}
                style={ctaStyles.primary}>
                <Text style={ctaStyles.primaryLabel}>Explore live decisions</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <PagedDecisionFeed
          cards={resolvedCards}
          headerChromeEstimate={44}
          bottomOverlayExtra={bottomOverlayExtra}
          swipeCues={OUTCOME_REPLAY_SWIPE_CUES}
          isFetching={query.isFetching}
          onRefresh={() => query.refetch()}
          quietPresentation
        />
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  stateCard: {
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  ghostBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  monoGlow: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: semantic.actionPrimary,
    fontWeight: '600',
  },
});
