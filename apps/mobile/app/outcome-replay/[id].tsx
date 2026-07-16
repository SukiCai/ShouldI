import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ctaStyles } from '@/components/screen/ctaStyles';
import { youScreenStyles as styles } from '@/app/(tabs)/you/components/youScreenStyles';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetJson, apiPostJson } from '@/lib/api';
import { trackProductEvent } from '@/lib/analytics';
import { radius, screenContentGutter, themeSurface } from '@/constants/theme';
import { OutcomeReplaySchema } from '@shouldi/contracts';

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
