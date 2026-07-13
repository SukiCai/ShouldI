import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import JumpUpSheet from '@/components/ui/JumpUpSheet';
import { spacing, screenContentGutter } from '@/constants/theme';
import { PAST_SESSIONS_HINT } from '@/lib/userFacingErrors';

type SessionRow = { id: string; preview: string; updatedAt: number };

type DecideSessionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  backgroundColor: string;
  borderTopColor: string;
  bottomInset: number;
  grabColor: string;
  listLoading: boolean;
  sessions: SessionRow[];
  primaryTxt: string;
  muted: string;
  composerBorder: string;
  composerBg: string;
  accentColor: string;
  onActivateSession: (sessionId: string) => void;
};

export function DecideSessionsSheet({
  visible,
  onClose,
  backgroundColor,
  borderTopColor,
  bottomInset,
  grabColor,
  listLoading,
  sessions,
  primaryTxt,
  muted,
  composerBorder,
  composerBg,
  accentColor,
  onActivateSession,
}: DecideSessionsSheetProps) {
  return (
    <JumpUpSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={backgroundColor}
      borderTopColor={borderTopColor}
      bottomInset={bottomInset}
      grabColor={grabColor}>
      <View style={styles.sheetHeadRow}>
        <Text style={[styles.sheetTitle, { color: primaryTxt }]}>Past sessions</Text>
        <Pressable
          hitSlop={12}
          onPress={onClose}
          accessibilityRole="button"
          style={[styles.sheetCloseBtn, { borderColor: composerBorder, backgroundColor: composerBg }]}>
          <Ionicons name="close" size={16} color={muted} />
        </Pressable>
      </View>
      <Text style={[styles.sheetHint, { color: muted }]}>{PAST_SESSIONS_HINT}</Text>
      {listLoading ? (
        <ActivityIndicator color={accentColor} style={{ marginVertical: spacing.lg }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetList}
          ListEmptyComponent={
            <Text style={[styles.emptyList, { color: muted }]}>No past conversations.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open chat ${item.preview}`}
              onPress={() => void onActivateSession(item.id)}
              style={[styles.sheetRow, { borderBottomColor: composerBorder }]}>
              <View style={[styles.sheetRowGlyph, { backgroundColor: composerBg }]}>
                <Ionicons name="chatbubbles-outline" size={17} color={accentColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={[styles.sheetRowTitle, { color: primaryTxt }]}>
                  {item.preview || 'New intake'}
                </Text>
                <Text style={[styles.sheetRowTs, { color: muted }]}>
                  {new Date(item.updatedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={muted} />
            </Pressable>
          )}
        />
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
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyList: {
    paddingVertical: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
  },
  sheetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
});
