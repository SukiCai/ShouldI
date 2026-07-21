import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import JumpUpSheet from '@/components/ui/JumpUpSheet';
import { council, palette, radius, screenContentGutter, semantic, spacing } from '@/constants/theme';
import type { DiscoveredExpert } from '@shouldi/contracts';

import { ExpertGlyph } from './DecideThreadParts';

type ExpertDiscoverySheetProps = {
  visible: boolean;
  onClose: () => void;
  discoveries: DiscoveredExpert[];
  backgroundColor: string;
  borderTopColor: string;
  bottomInset: number;
  grabColor: string;
  isDark: boolean;
  primaryTxt: string;
  muted: string;
  composerBorder: string;
  joinContext?: string;
  collectionProgress?: string;
};

function DiscoveryCard({
  row,
  primaryTxt,
  muted,
  composerBorder,
  isDark,
  joinContext,
}: {
  row: DiscoveredExpert;
  primaryTxt: string;
  muted: string;
  composerBorder: string;
  isDark: boolean;
  joinContext?: string;
}) {
  const accent = row.expert.color ?? semantic.actionAffirm;
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: `${accent}33`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : palette.white,
        },
      ]}>
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />
      <ExpertGlyph expert={row.expert} fallbackColor={semantic.actionAffirm} size={44} />
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: primaryTxt }]}>{row.expert.title}</Text>
        <Text style={[styles.frameworkTag, { color: accent }]}>
          {row.frameworkLabel} · Perspective lens
        </Text>
        <Text style={[styles.cardBlurb, { color: muted }]} numberOfLines={3}>
          {row.discoveryBlurb}
        </Text>
        {joinContext ? (
          <Text style={[styles.joinContext, { color: muted, borderTopColor: composerBorder }]}>
            {joinContext}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function ExpertDiscoverySheet({
  visible,
  onClose,
  discoveries,
  backgroundColor,
  borderTopColor,
  bottomInset,
  grabColor,
  isDark,
  primaryTxt,
  muted,
  composerBorder,
  joinContext,
  collectionProgress,
}: ExpertDiscoverySheetProps) {
  const openPerspectives = React.useCallback(() => {
    onClose();
    router.replace('/(tabs)/you');
  }, [onClose]);

  if (discoveries.length === 0) return null;

  return (
    <JumpUpSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={backgroundColor}
      borderTopColor={borderTopColor}
      bottomInset={bottomInset}
      grabColor={grabColor}
      maxHeight="72%">
      <View style={[styles.header, { borderBottomColor: composerBorder }]}>
        <View style={[styles.headerIcon, { backgroundColor: `${semantic.actionAffirm}18` }]}>
          <Ionicons name="sparkles-outline" size={22} color={semantic.actionAffirm} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.headerTitle, { color: primaryTxt }]}>New perspective unlocked</Text>
          <Text style={[styles.headerSub, { color: muted }]}>
            {discoveries.length === 1
              ? 'A specialist lens joined your session.'
              : `${discoveries.length} specialist lenses joined your session.`}
            {collectionProgress ? ` · ${collectionProgress}` : ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss discovery"
          hitSlop={10}
          onPress={onClose}
          style={[
            styles.closeBtn,
            {
              borderColor: composerBorder,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
            },
          ]}>
          <Ionicons name="close" size={18} color={muted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {discoveries.map((row) => (
          <DiscoveryCard
            key={row.expertId}
            row={row}
            primaryTxt={primaryTxt}
            muted={muted}
            composerBorder={composerBorder}
            isDark={isDark}
            joinContext={
              joinContext
                ? `Joined because your question touched ${joinContext}.`
                : undefined
            }
          />
        ))}
      </ScrollView>

      <View style={[styles.actions, { borderTopColor: composerBorder }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue decision"
          onPress={onClose}
          style={[styles.primaryBtn, { backgroundColor: council.violet }]}>
          <Text style={styles.primaryBtnText}>Continue decision</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View in My Perspectives"
          onPress={openPerspectives}
          style={[styles.secondaryBtn, { borderColor: composerBorder }]}>
          <Text style={[styles.secondaryBtnText, { color: primaryTxt }]}>View in My Perspectives</Text>
        </Pressable>
      </View>
    </JumpUpSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: screenContentGutter,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  list: {
    paddingHorizontal: screenContentGutter,
    paddingTop: 14,
    paddingBottom: spacing.sm,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: 14,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  cardAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  frameworkTag: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  cardBlurb: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 2,
  },
  joinContext: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  actions: {
    paddingHorizontal: screenContentGutter,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
