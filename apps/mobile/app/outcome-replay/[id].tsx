import * as React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';

import Screen from '@/components/ui/Screen';
import { Button, Card } from '@/components/ui';
import { apiGetJson, apiPostJson } from '@/lib/api';
import { trackProductEvent } from '@/lib/analytics';
import { radius, spacing, themeSurface, typography } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { OutcomeReplaySchema } from '@shouldi/contracts';

type ReplayPayload = {
  predictionText?: string;
  outcomeText?: string;
  reflection?: string;
};

export default function OutcomeReplayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
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

  return (
    <Screen variant="plain" padded>
      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Text style={[typography.title, { color: surface.textPrimary }]}>Outcome Replay</Text>
        <Text style={[typography.compact, { color: surface.textMuted }]}>
          Compare prediction vs reality, then capture calibration notes for your next decision.
        </Text>
        <Text style={[typography.caption, { color: surface.textMuted }]}>
          ShouldI supports your decision quality. Final judgment always stays with you.
        </Text>

        <Card style={styles.section}>
          <Text style={[typography.subhead, { color: surface.textPrimary }]}>Current replay state</Text>
          <Text style={[typography.compact, { color: surface.textMuted }]}>
            Prediction: {replay?.prediction?.predictionText ?? 'Not logged'}
          </Text>
          <Text style={[typography.compact, { color: surface.textMuted }]}>
            Outcome: {replay?.actual?.outcomeText ?? 'Not logged'}
          </Text>
          <Text style={[typography.compact, { color: surface.textMuted }]}>
            Calibration delta: {replay?.calibrationDelta != null ? replay.calibrationDelta.toFixed(2) : 'N/A'}
          </Text>
          <Text style={[typography.compact, { color: surface.textMuted }]}>
            Reflection: {replay?.reflection ?? 'Not logged'}
          </Text>
        </Card>

        <Card style={styles.section}>
          <Text style={[typography.subhead, { color: surface.textPrimary }]}>Add replay inputs</Text>
          <TextInput
            value={predictionText}
            onChangeText={setPredictionText}
            placeholder="What did you predict before acting?"
            placeholderTextColor={surface.textMuted}
            style={[styles.input, { color: surface.textPrimary, borderColor: surface.hairline }]}
          />
          <TextInput
            value={outcomeText}
            onChangeText={setOutcomeText}
            placeholder="What actually happened?"
            placeholderTextColor={surface.textMuted}
            style={[styles.input, { color: surface.textPrimary, borderColor: surface.hairline }]}
          />
          <TextInput
            value={reflectionText}
            onChangeText={setReflectionText}
            placeholder="What will you adjust next time?"
            placeholderTextColor={surface.textMuted}
            style={[styles.input, styles.inputMulti, { color: surface.textPrimary, borderColor: surface.hairline }]}
            multiline
          />
          <Button
            label={saveMutation.isPending ? 'Saving…' : 'Save Outcome Replay'}
            onPress={() =>
              saveMutation.mutate({
                predictionText,
                outcomeText,
                reflection: reflectionText,
              })
            }
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  inputMulti: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
});
