import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { MOTION } from '@/constants/motion';
import { council, palette, screenContentGutter } from '@/constants/theme';
import type { DecideInterviewExpert } from '@shouldi/contracts';

import { formatSenderDisplay } from './threadHelpers';

export const councilStyles = StyleSheet.create({
  tallyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  tallyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  tallyChipText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chamberStrip: {
    marginBottom: 10,
    marginTop: 4,
  },
  chamberStripGrad: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  chamberStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chamberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chamberEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  chamberTitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
});

const threadPartStyles = StyleSheet.create({
  msgPadH: {
    paddingHorizontal: screenContentGutter,
  },
  expertGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  thinkingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  thinkingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  thinkingLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  headerStatusAvatarRing: {
    borderRadius: 99,
  },
  chamberJoinChatRow: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 12,
  },
  chamberJoinChatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '94%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chamberJoinChatTitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export function CouncilVoteTally({
  yes,
  no,
  total,
  isDark,
}: {
  yes: number;
  no: number;
  total: number;
  isDark: boolean;
}) {
  if (total === 0) return null;
  return (
    <View style={councilStyles.tallyRow}>
      <View style={[councilStyles.tallyChip, { backgroundColor: isDark ? 'rgba(45,212,191,0.18)' : 'rgba(16,185,129,0.14)' }]}>
        <Ionicons name="checkmark-circle" size={13} color={isDark ? '#5eead4' : '#059669'} />
        <Text style={[councilStyles.tallyChipText, { color: isDark ? '#5eead4' : '#047857' }]}>{yes} Yes</Text>
      </View>
      <View style={[councilStyles.tallyChip, { backgroundColor: isDark ? 'rgba(251,113,133,0.18)' : 'rgba(244,63,94,0.12)' }]}>
        <Ionicons name="close-circle" size={13} color={isDark ? '#fb7185' : '#e11d48'} />
        <Text style={[councilStyles.tallyChipText, { color: isDark ? '#fb7185' : '#be123c' }]}>{no} No</Text>
      </View>
      <View style={[councilStyles.tallyChip, { backgroundColor: isDark ? 'rgba(167,139,250,0.16)' : 'rgba(139,92,246,0.12)' }]}>
        <Ionicons name="people" size={13} color={council.violet} />
        <Text style={[councilStyles.tallyChipText, { color: council.violet }]}>{total} voices</Text>
      </View>
    </View>
  );
}

export function ThinkingRow({
  label = 'ShouldI is thinking…',
  accent,
  muted,
}: {
  label?: string;
  accent: string;
  muted: string;
}) {
  const dot1 = React.useRef(new Animated.Value(0.35)).current;
  const dot2 = React.useRef(new Animated.Value(0.35)).current;
  const dot3 = React.useRef(new Animated.Value(0.35)).current;

  React.useEffect(() => {
    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.35, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 140);
    const a3 = pulse(dot3, 280);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={[threadPartStyles.thinkingRow, threadPartStyles.msgPadH]}>
      <View style={threadPartStyles.thinkingDots}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[threadPartStyles.thinkingDot, { backgroundColor: accent, opacity: dot }]} />
        ))}
      </View>
      <Text style={[threadPartStyles.thinkingLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

export function ExpertGlyph({
  expert,
  fallbackColor,
  size = 30,
}: {
  expert?: Pick<DecideInterviewExpert, 'title' | 'icon' | 'color'> | null;
  fallbackColor: string;
  size?: number;
}) {
  const iconName = (expert?.icon ?? 'sparkles-outline') as keyof typeof Ionicons.glyphMap;
  const color = expert?.color ?? fallbackColor;
  return (
    <View
      accessibilityLabel={expert?.title ?? 'Decision expert'}
      style={[
        threadPartStyles.expertGlyph,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}22`,
          borderColor: `${color}55`,
        },
      ]}>
      <Ionicons name={iconName} size={Math.max(13, Math.floor(size * 0.52))} color={color} />
    </View>
  );
}

export function HeaderJoinAvatar({
  expert,
  isNew,
  fallbackColor,
}: {
  expert: DecideInterviewExpert;
  isNew: boolean;
  fallbackColor: string;
}) {
  const scale = React.useRef(new Animated.Value(isNew ? 0.35 : 1)).current;
  const opacity = React.useRef(new Animated.Value(isNew ? 0 : 1)).current;

  React.useEffect(() => {
    if (!isNew) return;
    scale.setValue(0.35);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        ...MOTION.card,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isNew, opacity, scale]);

  return (
    <Animated.View style={[threadPartStyles.headerStatusAvatarRing, { opacity, transform: [{ scale }] }]}>
      <ExpertGlyph expert={expert} fallbackColor={fallbackColor} size={18} />
    </Animated.View>
  );
}

const JOIN_CHAT_ENTER_MS = 280;

export function ChamberJoinChatRow({
  expert,
  isCouncil,
  colors,
}: {
  expert: DecideInterviewExpert;
  contextText?: string;
  isCouncil: boolean;
  isDark?: boolean;
  colors: { primaryTxt: string; muted: string; composerBorder: string; cardBg: string };
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: JOIN_CHAT_ENTER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [expert.id, opacity]);

  const accentColor = expert.color ?? palette.accent;

  return (
    <Animated.View
      style={[
        threadPartStyles.chamberJoinChatRow,
        threadPartStyles.msgPadH,
        { opacity },
      ]}>
      <View
        style={[
          threadPartStyles.chamberJoinChatPill,
          {
            borderColor: colors.composerBorder,
            backgroundColor: colors.cardBg,
          },
        ]}>
        <ExpertGlyph expert={expert} fallbackColor={accentColor} size={14} />
        <Text style={[threadPartStyles.chamberJoinChatTitle, { color: colors.muted }]} numberOfLines={2}>
          {formatSenderDisplay(expert.title)}
          {isCouncil ? ' joined' : ' added'}
        </Text>
      </View>
    </Animated.View>
  );
}
