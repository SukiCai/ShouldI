import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import PrimaryButton from '@/components/ui/PrimaryButton';
import Screen from '@/components/ui/Screen';
import { palette, radius, spacing, typography } from '@/constants/theme';

import { useDecideWizard } from './context';

export default function DecideDetailsScreen() {
  const { draft, updateDraft } = useDecideWizard();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Screen padded scroll>
      <Text style={typography.title}>Describe your decision</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Be specific. Better detail means better recommendation quality.
      </Text>
      <Text style={[typography.caption, styles.progress]}>Step 2 of 3</Text>
      <Text style={[typography.compact, styles.label]} accessibilityLabel="Decision headline input">
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
        placeholderTextColor={palette.slate500}
        style={styles.inputLarge}
      />
      <Text style={[typography.compact, styles.label]}>Concrete constraints</Text>
      <TextInput
        multiline
        textAlignVertical="top"
        value={draft.constraints}
        accessibilityHint="Deadline, dependents, runway, sensitivities."
        accessibilityLabel="Constraints field"
        onChangeText={(text) => updateDraft({ constraints: text })}
        placeholder="Timeline, runway, dependents, team risk, contractual limits..."
        placeholderTextColor={palette.slate500}
        style={styles.input}
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
          <Text style={[typography.compact, styles.label]}>Success signal (optional)</Text>
          <TextInput
            multiline
            textAlignVertical="top"
            accessibilityLabel="Success criteria input"
            value={draft.successCriteria}
            onChangeText={(text) => updateDraft({ successCriteria: text })}
            placeholder="Name the subjective win in one or two sentences."
            placeholderTextColor={palette.slate500}
            style={styles.input}
          />
        </>
      )}
      <View style={{ marginTop: spacing.lg }}>
        <PrimaryButton
          disabled={!draft.title.trim()}
          accessibilityLabel="Review decision recap"
          onPress={() => router.push('/decide/confirm')}
        >
          <Text style={styles.button}>Review</Text>
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 8,
    color: palette.slate500,
  },
  progress: {
    marginTop: 8,
    color: palette.slate500,
  },
  label: {
    marginTop: 16,
    color: palette.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '600',
    fontSize: 12,
  },
  expand: {
    marginTop: 12,
    color: palette.accent,
    fontWeight: '600',
  },
  input: {
    marginTop: 8,
    minHeight: 110,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d9e3ff',
    backgroundColor: palette.white,
    padding: 14,
    color: palette.slate950,
  },
  inputLarge: {
    marginTop: 8,
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d9e3ff',
    backgroundColor: palette.white,
    padding: 14,
    color: palette.slate950,
  },
  button: {
    fontWeight: '600',
    color: palette.white,
    fontSize: 16,
  },
});
