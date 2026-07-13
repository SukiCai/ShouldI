import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, themeSurface, typography } from '@/constants/theme';

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
  const activeBg = isDark ? palette.heroInk : '#111113';
  const activeText = '#ffffff';
  const inactiveText = surface.textMuted;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Single expert mode"
        accessibilityState={{ selected: mode === 'single' }}
        onPress={onSelectSingle}
        style={[styles.chip, mode === 'single' && { backgroundColor: activeBg }]}>
        <Text
          style={[
            styles.chipLabel,
            { color: mode === 'single' ? activeText : inactiveText },
            mode === 'single' && styles.chipLabelActive,
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
        style={[styles.chip, mode === 'complex' && { backgroundColor: activeBg }]}>
        <View style={styles.chipInner}>
          <Text
            style={[
              styles.chipLabel,
              { color: mode === 'complex' ? activeText : inactiveText },
              mode === 'complex' && styles.chipLabelActive,
            ]}>
            Council
          </Text>
          {!isPremium && mode !== 'complex' ? (
            <View style={[styles.costPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)' }]}>
              {!canAccessCouncil ? (
                <Ionicons name="lock-closed" size={9} color={inactiveText} />
              ) : (
                <Text style={[styles.costText, { color: inactiveText }]}>{`${councilSessionCost}p`}</Text>
              )}
            </View>
          ) : isPremium && mode === 'complex' ? (
            <Ionicons name="star" size={10} color={activeText} />
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
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipLabel: {
    ...typography.compact,
    fontWeight: '600',
  },
  chipLabelActive: {
    fontWeight: '700',
  },
  costPill: {
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  costText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
