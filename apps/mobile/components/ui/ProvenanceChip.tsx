import { StyleSheet, Text, View } from 'react-native';

import { palette, typography } from '@/constants/theme';
import type { Provenance } from '@shouldi/contracts';

const labelMap: Record<Provenance, string> = {
  community_story: 'Community outcome',
  ai_framework: 'AI lens',
  curated_digest: 'Curated insight',
};

type Props = { provenance: Provenance };

export default function ProvenanceChip({ provenance }: Props) {
  return (
    <View accessibilityRole="text" accessibilityLabel={labelMap[provenance]} style={styles.shell}>
      <Text style={[typography.caption, styles.text]}>{labelMap[provenance]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cad6ff',
  },
  text: {
    color: palette.slate900,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
