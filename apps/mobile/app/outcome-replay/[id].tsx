import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpertGlyph } from '@/app/(tabs)/decide/components/DecideThreadParts';
import { ctaStyles } from '@/components/screen/ctaStyles';
import { youScreenStyles as styles } from '@/app/(tabs)/you/components/youScreenStyles';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetJson, apiPostJson } from '@/lib/api';
import { trackProductEvent } from '@/lib/analytics';
import { radius, screenContentGutter, semantic, themeSurface } from '@/constants/theme';
import {
  DecisionRecordSchema,
  ExpertCatalogResponseSchema,
  OutcomeReplaySchema,
} from '@shouldi/contracts';

type ReplayPayload = {
  predictionText?: string;
  outcomeText?: string;
  reflection?: string;
};

function ReplayField({
  label,
  value,
  textMuted,
}: {
  label: string;
  value: string;
  textMuted: string;
}) {
  return (
    <View style={localStyles.fieldRow}>
      <Text style={[styles.sectionLabel, { color: textMuted, textTransform: 'none', letterSpacing: 0 }]}>
        {label}
      </Text>
      <Text style={[styles.cardBody, { color: textMuted }]}>{value}</Text>
    </View>
  );
}

export default function OutcomeReplayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const insets = useSafeAreaInsets();
  const [predictionText, setPredictionText] = React.useState('');
  const [outcomeText, setOutcomeText] = React.useState('');
  const [reflectionText, setReflectionText] = React.useState('');

  const replayQuery = useQuery({
    queryKey: ['outcome-replay', id],
    enabled: !!id,
    queryFn: async () => {
      const data = await apiGetJson(`/v1/decisions/${id}/replay`);
      return OutcomeReplaySchema.parse(data);
    },
  });

  const decisionQuery = useQuery({
    queryKey: ['decision', id],
    enabled: !!id,
    queryFn: async () => {
      const data = await apiGetJson(`/v1/decisions/${id}`);
      return DecisionRecordSchema.parse(data);
    },
  });

  const catalogQuery = useQuery({
    queryKey: ['experts-catalog'],
    queryFn: async () => {
      const data = await apiGetJson('/v1/experts/catalog');
      return ExpertCatalogResponseSchema.parse(data);
    },
    staleTime: 60_000 * 30,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ReplayPayload) => {
      if (!id) return;
      if (payload.predictionText?.trim()) {
        await apiPostJson(`/v1/decisions/${id}/prediction`, {
          predictionText: payload.predictionText.trim(),
          predictedProbability: 0.5,
        });
      }
      if (payload.outcomeText?.trim()) {
        await apiPostJson(`/v1/decisions/${id}/outcome`, {
          outcomeText: payload.outcomeText.trim(),
        });
      }
      if (payload.reflection?.trim()) {
        await apiPostJson(`/v1/decisions/${id}/reflection`, {
          reflection: payload.reflection.trim(),
        });
      }
      return apiGetJson(`/v1/decisions/${id}/replay`);
    },
    onSuccess: () => {
      void trackProductEvent({
        name: 'outcome_replayed',
        decisionRecordId: id,
        metadata: { screen: 'outcome-replay-detail' },
      });
      void replayQuery.refetch();
      setPredictionText('');
      setOutcomeText('');
      setReflectionText('');
    },
  });

  const replay = replayQuery.data;
  const decision = decisionQuery.data;
  const catalogById = React.useMemo(() => {
    const map = new Map<string, NonNullable<typeof catalogQuery.data>['experts'][number]>();
    for (const row of catalogQuery.data?.experts ?? []) {
      map.set(row.id, row);
    }
    return map;
  }, [catalogQuery.data]);
  const perspectivesUsed = (decision?.expertIdsUsed ?? [])
    .map((expertId) => catalogById.get(expertId))
    .filter((row): row is NonNullable<typeof row> => !!row && row.id !== 'general-decision');
  const calibrationLabel =
    replay?.calibrationDelta != null ? replay.calibrationDelta.toFixed(2) : 'Not enough data';

  return (
    <View style={[styles.surface, { backgroundColor: surface.canvas }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: screenContentGutter,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom + 32, 40),
          gap: 12,
        }}>
        <Text style={[styles.subtitle, { color: surface.textMuted, marginTop: 0 }]}>
          Compare prediction vs reality, then capture calibration notes for your next decision.
        </Text>
        <Text style={[styles.cardBody, { color: surface.textMuted, fontSize: 12, lineHeight: 16 }]}>
          ShouldI supports your decision quality. Final judgment always stays with you.
        </Text>

        <View
          style={[
            styles.insightFeedCard,
            styles.insightCardShell,
            { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder },
          ]}>
          <Text style={[styles.insightCardTitle, { color: surface.textDisplay }]}>Current replay state</Text>
          <ReplayField
            label="Prediction"
            value={replay?.prediction?.predictionText ?? 'Not logged'}
            textMuted={surface.textMuted}
          />
          <ReplayField
            label="Outcome"
            value={replay?.actual?.outcomeText ?? 'Not logged'}
            textMuted={surface.textMuted}
          />
          <ReplayField label="Calibration delta" value={calibrationLabel} textMuted={surface.textMuted} />
          <ReplayField
            label="Reflection"
            value={replay?.reflection ?? 'Not logged'}
            textMuted={surface.textMuted}
          />
        </View>

        {perspectivesUsed.length > 0 ? (
          <View
            style={[
              styles.insightFeedCard,
              styles.insightCardShell,
              { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder, gap: 10 },
            ]}>
            <Text style={[styles.insightCardTitle, { color: surface.textDisplay }]}>Perspectives used</Text>
            <Text style={[styles.cardBody, { color: surface.textMuted, lineHeight: 18 }]}>
              Specialist lenses that shaped this decision.
            </Text>
            <View style={localStyles.perspectiveRow}>
              {perspectivesUsed.map((expert) => (
                <View
                  key={expert.id}
                  style={[
                    localStyles.perspectiveChip,
                    {
                      borderColor: `${expert.color}33`,
                      backgroundColor: surface.canvas,
                    },
                  ]}>
                  <ExpertGlyph expert={expert} fallbackColor={semantic.actionAffirm} size={28} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[localStyles.perspectiveChipTitle, { color: surface.textDisplay }]} numberOfLines={1}>
                      {expert.title}
                    </Text>
                    <Text style={[localStyles.perspectiveChipFramework, { color: expert.color }]} numberOfLines={1}>
                      {expert.frameworkLabel}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.insightFeedCard,
            styles.insightCardShell,
            { backgroundColor: surface.groupedSurface, borderColor: surface.groupedBorder, gap: 10 },
          ]}>
          <Text style={[styles.insightCardTitle, { color: surface.textDisplay }]}>Add replay inputs</Text>
          <TextInput
            value={predictionText}
            onChangeText={setPredictionText}
            placeholder="What did you predict before acting?"
            placeholderTextColor={surface.textMuted}
            style={[
              localStyles.input,
              {
                color: surface.textPrimary,
                borderColor: surface.hairline,
                backgroundColor: surface.canvas,
              },
            ]}
          />
          <TextInput
            value={outcomeText}
            onChangeText={setOutcomeText}
            placeholder="What actually happened?"
            placeholderTextColor={surface.textMuted}
            style={[
              localStyles.input,
              {
                color: surface.textPrimary,
                borderColor: surface.hairline,
                backgroundColor: surface.canvas,
              },
            ]}
          />
          <TextInput
            value={reflectionText}
            onChangeText={setReflectionText}
            placeholder="What will you adjust next time?"
            placeholderTextColor={surface.textMuted}
            style={[
              localStyles.input,
              localStyles.inputMulti,
              {
                color: surface.textPrimary,
                borderColor: surface.hairline,
                backgroundColor: surface.canvas,
              },
            ]}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save Outcome Replay"
            disabled={saveMutation.isPending}
            onPress={() =>
              saveMutation.mutate({
                predictionText,
                outcomeText,
                reflection: reflectionText,
              })
            }
            style={[ctaStyles.primary, { opacity: saveMutation.isPending ? 0.7 : 1 }]}>
            <Text style={ctaStyles.primaryLabel}>
              {saveMutation.isPending ? 'Saving…' : 'Save Outcome Replay'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  fieldRow: {
    gap: 2,
    marginTop: 4,
  },
  perspectiveRow: {
    gap: 8,
  },
  perspectiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  perspectiveChipTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  perspectiveChipFramework: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    fontSize: 15,
    lineHeight: 20,
  },
  inputMulti: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
