import { StyleSheet, Text, View } from 'react-native';

import { pmfText, usePmfSurface } from '@/components/screen/pmfChrome';
import { semantic, typography } from '@/constants/theme';
import type { Provenance } from '@shouldi/contracts';

const labelMap: Record<Provenance, string> = {
  community_story: 'Community outcome',
  ai_framework: 'AI lens',
  curated_digest: 'Curated insight',
  community_ai_validation: 'Validate AI',
};

type Props = { provenance: Provenance };

export default function ProvenanceChip({ provenance }: Props) {
  const surface = usePmfSurface();
  const text = pmfText(surface);
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={labelMap[provenance]}
      style={[
        styles.shell,
        { backgroundColor: surface.groupedSurface, borderColor: surface.hairline },
      ]}>
      <Text style={[typography.caption, styles.text, text.primary]}>{labelMap[provenance]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    color: semantic.actionPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
});
