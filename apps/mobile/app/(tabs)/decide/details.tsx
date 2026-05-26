import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import PrimaryButton from '@/components/ui/PrimaryButton';
import Screen from '@/components/ui/Screen';
import { useColorScheme } from '@/components/useColorScheme';
import {
  palette,
  profileLight,
  profileNeutralStroke,
  profileTypography,
  radius,
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
  const ph = profileTypography.subdued;

  return (
    <Screen padded scroll>
      <Text style={[typography.title, { color: surface.textDisplay }]}>Describe your decision</Text>
      <Text style={[typography.body, { marginTop: 8, color: surface.textMuted }]}>
        Be specific. Better detail means better recommendation quality.
      </Text>
      <Text style={[typography.caption, { marginTop: 8, color: surface.textMuted }]}>Step 2 of 3</Text>
      <Text
        style={[
          typography.compact,
          styles.labelBase,
          { marginTop: 16, color: surface.textMuted },
        ]}
        accessibilityLabel="Decision headline input">
        Decision statement
      </Text>
      <TextInput
        editable
        multiline
        textAlignVertical="top"
        value={draft.title}
        accessibilityLabel="Headline describing your dilemma"
        onChangeText={(text) => updateDraft({ title: text })}
        placeholder="Example: Take the remote role with lower pay to reduce burnout."
        placeholderTextColor={ph}
        style={[
          styles.inputLarge,
          { borderColor: profileNeutralStroke(0.14), color: surface.textDisplay },
        ]}
      />
      <Text style={[typography.compact, styles.labelBase, { marginTop: 16, color: surface.textMuted }]}>
        Concrete constraints
      </Text>
      <TextInput
        multiline
        textAlignVertical="top"
        value={draft.constraints}
        accessibilityHint="Deadline, dependents, runway, sensitivities."
        accessibilityLabel="Constraints field"
        onChangeText={(text) => updateDraft({ constraints: text })}
        placeholder="Timeline, runway, dependents, team risk, contractual limits..."
        placeholderTextColor={ph}
        style={[styles.input, { borderColor: profileNeutralStroke(0.14), color: surface.textDisplay }]}
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
          <Text style={[typography.compact, styles.labelBase, { marginTop: 16, color: surface.textMuted }]}>
            Success signal (optional)
          </Text>
          <TextInput
            multiline
            textAlignVertical="top"
            accessibilityLabel="Success criteria input"
            value={draft.successCriteria}
            onChangeText={(text) => updateDraft({ successCriteria: text })}
            placeholder="Name the subjective win in one or two sentences."
            placeholderTextColor={ph}
            style={[styles.input, { borderColor: profileNeutralStroke(0.14), color: surface.textDisplay }]}
          />
        </>
      )}
      <View style={{ marginTop: spacing.lg }}>
        <PrimaryButton
          disabled={!draft.title.trim()}
          accessibilityLabel="Review decision recap"
          onPress={() => router.push('/(tabs)/decide/confirm')}
        >
          <Text style={styles.button}>Review</Text>
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  labelBase: {
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '600',
    fontSize: 12,
  },
  expand: {
    marginTop: 12,
    color: profileLight.sky,
    fontWeight: '600',
  },
  input: {
    marginTop: 8,
    minHeight: 110,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: palette.sheet,
    padding: 14,
  },
  inputLarge: {
    marginTop: 8,
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: palette.sheet,
    padding: 14,
  },
  button: {
    fontWeight: '600',
    color: palette.white,
    fontSize: 16,
  },
});
