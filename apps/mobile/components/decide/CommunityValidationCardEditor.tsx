import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, profileLight, profileNeutralStroke, radius, spacing, themeSurface, typography } from '@/constants/theme';

export type CommunityCardFields = {
  aiVerdictLine: string;
  aiBecause: string;
  challengeQuestion: string;
};

type Props = {
  labels: CommunityCardFields;
  onChange(patch: Partial<CommunityCardFields>): void;
};

/**
 * Matches Explore AI-validation reels; theme-aware so it sits on OLED canvas without a “floating Word doc”.
 */
export function CommunityValidationCardEditor({ labels, onChange }: Props) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';

  const ph = isDark ? 'rgba(247,247,247,0.35)' : profileNeutralStroke(0.38);
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : '#f4f7f9';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : profileNeutralStroke(0.12);
  const panelBorder = surface.hairline;
  const panelBg = isDark ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.94)';
  const chipBg = isDark ? 'rgba(61,255,184,0.1)' : `${profileLight.sky}12`;
  const chipBorder = isDark ? 'rgba(61,255,184,0.22)' : `${profileLight.sky}40`;
  const pipBorder = isDark ? palette.neonSky : profileLight.sky;
  const thumbsIconColor = isDark ? palette.neonMint : profileLight.mint;

  return (
    <View style={[styles.sheet, { backgroundColor: panelBg, borderColor: panelBorder }]} accessibilityLabel="Community validation card preview">
      <View style={styles.brandRow}>
        <View style={[styles.pip, { borderColor: pipBorder }]}>
          <FontAwesome name="users" size={12} color={pipBorder} />
        </View>
        <Text style={[styles.brandText, { color: surface.textMuted }]}>Community validation preview</Text>
      </View>
      <Text style={[styles.title, { color: surface.textPrimary }]}>What Explore will show</Text>
      <Text style={[styles.microExplainer, { color: surface.textMuted }]}>
        Peers rate Harmence&apos;s lean, then answer your sharpened yes/no prompt.
      </Text>

      <Label text="AI leaning" muted={surface.textMuted} />
      <TextInput
        value={labels.aiVerdictLine}
        onChangeText={(t) => onChange({ aiVerdictLine: t })}
        placeholder='Short headline, e.g. "Lean yes — trial internship first"'
        placeholderTextColor={ph}
        multiline
        style={[styles.input, styles.verdictInput, { backgroundColor: inputBg, borderColor: inputBorder, color: surface.textPrimary }]}
      />

      <Label text="Reasoning peers see" muted={surface.textMuted} />
      <TextInput
        value={labels.aiBecause}
        onChangeText={(t) => onChange({ aiBecause: t })}
        placeholder="Tradeoffs, risks, and constraints — keep it readable in a reel."
        placeholderTextColor={ph}
        multiline
        style={[styles.input, styles.becauseInput, { backgroundColor: inputBg, borderColor: inputBorder, color: surface.textPrimary }]}
        textAlignVertical="top"
      />

      <View style={[styles.thumbsExplain, { backgroundColor: chipBg, borderColor: chipBorder }]}>
        <FontAwesome name="check-circle" size={14} color={thumbsIconColor} />
        <Text style={[styles.thumbGhostLbl, { color: surface.textMuted }]}>
          Thumbs ↑↓ on Harmence • then poll below answers your challenge question
        </Text>
      </View>

      <Label text="Your yes/no for the crowd" muted={surface.textMuted} />
      <TextInput
        value={labels.challengeQuestion}
        onChangeText={(t) => onChange({ challengeQuestion: t })}
        placeholder="One decisive question strangers can vote on."
        placeholderTextColor={ph}
        multiline
        style={[styles.input, styles.challengeInput, { backgroundColor: inputBg, borderColor: inputBorder, color: surface.textPrimary }]}
        textAlignVertical="top"
      />
    </View>
  );
}

function Label({ text, muted }: { text: string; muted: string }) {
  return (
    <Text style={[styles.fieldLabel, { color: muted }]} accessibilityRole="header">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md + 2,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(84,220,255,0.09)',
  },
  brandText: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.35,
    marginTop: 4,
  },
  microExplainer: {
    ...typography.compact,
    lineHeight: 20,
    marginBottom: 4,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: -2,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    lineHeight: 22,
  },
  verdictInput: {
    minHeight: 48,
    fontWeight: '600',
  },
  becauseInput: {
    minHeight: 112,
    maxHeight: 200,
  },
  challengeInput: {
    minHeight: 88,
    maxHeight: 160,
    fontWeight: '500',
  },
  thumbsExplain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  thumbGhostLbl: {
    ...typography.compact,
    fontWeight: '600',
    lineHeight: 19,
    flex: 1,
  },
});
