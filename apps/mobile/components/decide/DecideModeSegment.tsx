import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ctaStyles } from '@/components/screen/ctaStyles';
import { palette, radius, semantic, themeSurface, typography } from '@/constants/theme';

type Props = {
  mode: 'single' | 'complex';
  isDark: boolean;
  isPremium: boolean;
  canAccessCouncil: boolean;
  councilSessionCost: number;
  onSelectSingle: () => void;
  onSelectCouncil: () => void;
};

export function DecideModeSegment({
  mode,
  isDark,
  isPremium,
  canAccessCouncil,
  councilSessionCost,
  onSelectSingle,
  onSelectCouncil,
}: Props) {
  const surface = themeSurface(isDark ? 'dark' : 'light');
  const activeBg = semantic.actionPrimary;
  const activeText = palette.sheet;
  const inactiveText = surface.textMuted;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Single expert mode"
        accessibilityState={{ selected: mode === 'single' }}
        onPress={onSelectSingle}
        style={[ctaStyles.segmentChip, mode === 'single' && { backgroundColor: activeBg }]}>
        <Text
          style={[
            ctaStyles.segmentChipLabel,
            { color: mode === 'single' ? activeText : inactiveText },
            mode === 'single' && ctaStyles.segmentChipLabelActive,
          ]}>
          Single
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isPremium
            ? 'Expert council mode (Premium)'
            : canAccessCouncil
              ? `Expert council mode, ${councilSessionCost} points per session`
              : 'Expert council mode (Premium or points required)'
        }
        accessibilityState={{ selected: mode === 'complex' }}
        onPress={onSelectCouncil}
        style={[ctaStyles.segmentChip, mode === 'complex' && { backgroundColor: activeBg }]}>
        <View style={styles.chipInner}>
          <Text
            style={[
              ctaStyles.segmentChipLabel,
              { color: mode === 'complex' ? activeText : inactiveText },
              mode === 'complex' && ctaStyles.segmentChipLabelActive,
            ]}>
            Council
          </Text>
          {!isPremium && mode !== 'complex' ? (
            <View
              style={[
                styles.costPill,
                { backgroundColor: isDark ? surface.pressedOverlay : surface.pressedOverlay },
              ]}>
              {!canAccessCouncil ? (
                <Ionicons name="lock-closed" size={10} color={inactiveText} />
              ) : (
                <Text style={[styles.costText, { color: inactiveText }]}>{`${councilSessionCost}p`}</Text>
              )}
            </View>
          ) : isPremium && mode === 'complex' ? (
            <Ionicons name="star" size={11} color={activeText} />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  costPill: {
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  costText: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
