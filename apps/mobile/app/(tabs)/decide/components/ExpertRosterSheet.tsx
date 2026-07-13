import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import JumpUpSheet from '@/components/ui/JumpUpSheet';
import { council, palette, spacing, screenContentGutter } from '@/constants/theme';
import type { DecideInterviewExpert } from '@shouldi/contracts';

import { ExpertGlyph } from './DecideThreadParts';

type ExpertRosterSheetProps = {
  visible: boolean;
  onClose: () => void;
  backgroundColor: string;
  borderTopColor: string;
  bottomInset: number;
  grabColor: string;
  isCouncil: boolean;
  isDark: boolean;
  primaryTxt: string;
  muted: string;
  composerBorder: string;
  accentColor: string;
  activeExperts: DecideInterviewExpert[];
};

export function ExpertRosterSheet({
  visible,
  onClose,
  backgroundColor,
  borderTopColor,
  bottomInset,
  grabColor,
  isCouncil,
  isDark,
  primaryTxt,
  muted,
  composerBorder,
  accentColor,
  activeExperts,
}: ExpertRosterSheetProps) {
  return (
    <JumpUpSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={backgroundColor}
      borderTopColor={borderTopColor}
      bottomInset={bottomInset}
      grabColor={grabColor}>
      {isCouncil ? (
        <>
          <View style={[styles.councilSheetHeader, { borderBottomColor: composerBorder }]}>
            <View style={styles.councilSheetHeaderMain}>
              <View style={[styles.councilSheetIconWrap, { backgroundColor: `${council.violet}18` }]}>
                <Ionicons name="people-circle" size={24} color={council.violet} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.councilSheetTitle, { color: primaryTxt }]}>Council chamber</Text>
                <Text style={[styles.councilSheetSub, { color: muted }]}>
                  {activeExperts.length} specialist{activeExperts.length === 1 ? '' : 's'} consulted on this decision
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close council roster"
              hitSlop={10}
              onPress={onClose}
              style={[
                styles.councilSheetClose,
                {
                  borderColor: composerBorder,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                },
              ]}>
              <Ionicons name="close" size={18} color={muted} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.councilExpertList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {activeExperts.map((expert) => (
              <View
                key={expert.id}
                style={[
                  styles.councilExpertCard,
                  {
                    borderColor: `${expert.color ?? council.violet}33`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : palette.white,
                  },
                ]}>
                <View style={[styles.councilExpertAccent, { backgroundColor: expert.color ?? council.violet }]} />
                <ExpertGlyph expert={expert} fallbackColor={council.violet} size={42} />
                <View style={styles.councilExpertBody}>
                  <Text style={[styles.councilExpertTitle, { color: primaryTxt }]}>{expert.title}</Text>
                  {expert.subtitle ? (
                    <Text style={[styles.councilExpertSub, { color: muted }]} numberOfLines={3}>
                      {expert.subtitle}
                    </Text>
                  ) : expert.skillName ? (
                    <Text style={[styles.councilExpertSub, { color: muted }]} numberOfLines={2}>
                      {expert.skillName}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      ) : (
        <>
          <View style={styles.sheetHeadRow}>
            <Text style={[styles.sheetTitle, { color: primaryTxt }]}>Experts</Text>
            <Pressable
              hitSlop={12}
              onPress={onClose}
              accessibilityRole="button"
              style={[
                styles.councilSheetClose,
                {
                  borderColor: composerBorder,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                },
              ]}>
              <Ionicons name="close" size={18} color={muted} />
            </Pressable>
          </View>
          <Text style={[styles.sheetHint, { color: muted }]}>
            The specialist helping with your decision.
          </Text>
          <ScrollView contentContainerStyle={styles.sheetList} keyboardShouldPersistTaps="handled">
            {activeExperts.map((expert) => (
              <View key={expert.id} style={[styles.sheetRow, { borderBottomColor: composerBorder }]}>
                <ExpertGlyph expert={expert} fallbackColor={accentColor} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.sheetRowTitle, { color: primaryTxt }]}>{expert.title}</Text>
                  {expert.subtitle ? (
                    <Text style={[styles.sheetRowTs, { color: muted }]} numberOfLines={2}>
                      {expert.subtitle}
                    </Text>
                  ) : expert.skillName ? (
                    <Text style={[styles.sheetRowTs, { color: muted }]} numberOfLines={1}>
                      {expert.skillName}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </JumpUpSheet>
  );
}

const styles = StyleSheet.create({
  sheetHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenContentGutter,
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.25,
  },
  sheetHint: {
    fontSize: 12,
    paddingHorizontal: screenContentGutter,
    marginBottom: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  sheetList: {
    paddingHorizontal: screenContentGutter,
    paddingBottom: spacing.sm,
    gap: 0,
  },
  sheetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheetRowTs: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
  },
  councilSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: screenContentGutter,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  councilSheetHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  councilSheetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  councilSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  councilSheetSub: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  councilSheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  councilExpertList: {
    paddingHorizontal: screenContentGutter,
    paddingTop: 14,
    paddingBottom: spacing.sm,
    gap: 10,
  },
  councilExpertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: 14,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  councilExpertAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  councilExpertBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  councilExpertTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  councilExpertSub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
