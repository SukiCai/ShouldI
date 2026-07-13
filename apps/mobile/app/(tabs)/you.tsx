import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import Screen from '@/components/ui/Screen';
import { Button, Card } from '@/components/ui';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetJson } from '@/lib/api';
import { themeSurface, typography, spacing, radius, screenContentGutter } from '@/constants/theme';
import { DecisionDnaProfileSchema, DecisionRecordSchema } from '@shouldi/contracts';

type DecisionsListResponse = { decisions: Array<unknown> };

export default function YouScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();

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

  const latestDecision = decisionsQuery.data?.[0];

  return (
    <Screen variant="plain" padded={false} scroll={false}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 16, 28), paddingBottom: Math.max(insets.bottom + 96, 112) },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: surface.textDisplay }]}>You</Text>
            <Text style={[styles.subtitle, { color: surface.textMuted }]}>
              Decision Lens and Outcome Replay for your personal decision quality.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            style={[
              styles.iconBtn,
              {
                borderColor: surface.hairline,
                backgroundColor: surface.groupedSurface,
              },
            ]}>
            <Ionicons name="settings-outline" size={18} color={surface.textPrimary} />
          </Pressable>
        </View>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: surface.textPrimary }]}>Decision Lens</Text>
          <Text style={[styles.cardBody, { color: surface.textMuted }]}>
            {dnaQuery.data
              ? `Calibration score: ${Math.round(dnaQuery.data.calibrationScore)}/100`
              : 'Your first Decision Lens appears after a meaningful completed decision.'}
          </Text>
          <Text style={[styles.cardBody, { color: surface.textMuted }]}>
            {dnaQuery.data?.blindSpots?.length
              ? `Current pattern focus: ${dnaQuery.data.blindSpots.slice(0, 2).join(' · ')}`
              : 'No stable pattern yet. Keep logging Outcome Replay reflections.'}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: surface.textPrimary }]}>Latest Decision</Text>
          {latestDecision ? (
            <>
              <Text style={[styles.cardBodyStrong, { color: surface.textPrimary }]} numberOfLines={2}>
                {latestDecision.question}
              </Text>
              <Text style={[styles.cardBody, { color: surface.textMuted }]}>
                Recommendation confidence: {latestDecision.confidenceScore}/100
              </Text>
              <Button
                label="Open Outcome Replay"
                onPress={() => router.push({ pathname: '/outcome-replay/[id]', params: { id: latestDecision.id } })}
              />
            </>
          ) : (
            <>
              <Text style={[styles.cardBody, { color: surface.textMuted }]}>
                No completed decisions yet. Start with Decide and return here after action.
              </Text>
              <Button label="Start Decide" onPress={() => router.replace('/(tabs)/decide')} />
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: surface.textPrimary }]}>Governance Reminder</Text>
          <Text style={[styles.cardBody, { color: surface.textMuted }]}>
            ShouldI supports recommendation quality. Final decision ownership remains with you.
          </Text>
          <View style={styles.inlineRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Explore tab"
              onPress={() => router.replace('/(tabs)/explore')}
              style={[styles.inlinePill, { borderColor: surface.hairline }]}>
              <Text style={[styles.inlinePillText, { color: surface.textPrimary }]}>Explore</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Replay tab"
              onPress={() => router.replace('/(tabs)/replay')}
              style={[styles.inlinePill, { borderColor: surface.hairline }]}>
              <Text style={[styles.inlinePillText, { color: surface.textPrimary }]}>Replay</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenContentGutter,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.hero,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    ...typography.compact,
    marginTop: 4,
    lineHeight: 21,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f7',
  },
  card: {
    gap: 10,
  },
  cardTitle: {
    ...typography.titleSm,
    fontWeight: '700',
  },
  cardBody: {
    ...typography.compact,
    lineHeight: 20,
  },
  cardBodyStrong: {
    ...typography.bodySm,
    fontWeight: '700',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlinePill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inlinePillText: {
    ...typography.compact,
    fontWeight: '700',
  },
});

