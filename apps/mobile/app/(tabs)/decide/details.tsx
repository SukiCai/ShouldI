import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import Screen from '@/components/ui/Screen';
import { useColorScheme } from '@/components/useColorScheme';
import {
  profileLight,
  spacing,
  themeSurface,
  typography,
} from '@/constants/theme';

import { useDecideWizard } from './context';

export default function DecideDetailsScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const { draft, updateDraft } = useDecideWizard();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Screen variant="plain" padded scroll>
      <Text style={[typography.title, { color: surface.textDisplay }]}>Describe your decision</Text>
      <Text style={[typography.body, { marginTop: 8, color: surface.textMuted }]}>
        Be specific. Better detail means better recommendation quality.
      </Text>
      <Text style={[typography.caption, { marginTop: 8, color: surface.textMuted }]}>Step 2 of 3</Text>
      <TextField
        label="Decision statement"
        multiline
        value={draft.title}
        accessibilityLabel="Headline describing your dilemma"
        onChangeText={(text) => updateDraft({ title: text })}
        placeholder="Example: Take the remote role with lower pay to reduce burnout."
        containerStyle={{ marginTop: 16 }}
      />
      <TextField
        label="Concrete constraints"
        multiline
        value={draft.constraints}
        accessibilityHint="Deadline, dependents, runway, sensitivities."
        accessibilityLabel="Constraints field"
        onChangeText={(text) => updateDraft({ constraints: text })}
        placeholder="Timeline, runway, dependents, team risk, contractual limits..."
        containerStyle={{ marginTop: 16 }}
      />

      {!showAdvanced ? (
        <Text
          accessibilityRole="button"
          accessibilityLabel="Reveal optional outcome statement"
          onPress={() => setShowAdvanced(true)}
          style={[typography.compact, styles.expand]}>
          + Add success criteria
        </Text>
      ) : (
        <>
          <TextField
            label="Success signal (optional)"
            multiline
            accessibilityLabel="Success criteria input"
            value={draft.successCriteria}
            onChangeText={(text) => updateDraft({ successCriteria: text })}
            placeholder="Name the subjective win in one or two sentences."
            containerStyle={{ marginTop: 16 }}
          />
        </>
      )}
      <View style={{ marginTop: spacing.lg }}>
        <Button
          label="Review"
          disabled={!draft.title.trim()}
          accessibilityLabel="Review decision recap"
          onPress={() => router.push('/(tabs)/decide/confirm')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  expand: {
    marginTop: 12,
    color: profileLight.sky,
    fontWeight: '600',
  },
});
