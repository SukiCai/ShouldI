import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import JumpUpSheet from '@/components/ui/JumpUpSheet';
import { screenContentGutter, spacing, typography } from '@/constants/theme';

export type SocialStatKey = 'followers' | 'following' | 'likes';

export type DemoPerson = {
  id: string;
  name: string;
  handle: string;
  subtitle: string;
};

export type LikesBreakdownRow = {
  id: string;
  label: string;
  count: number;
};

const SHEET_COPY: Record<
  SocialStatKey,
  { title: string; hint: string; empty: string }
> = {
  followers: {
    title: 'Followers',
    hint: 'People who follow your decisions and updates.',
    empty: 'No followers yet — share a thread to grow your orbit.',
  },
  following: {
    title: 'Following',
    hint: 'Accounts you follow for new threads and votes.',
    empty: 'Not following anyone yet — explore threads to find voices.',
  },
  likes: {
    title: 'Likes received',
    hint: 'How others engaged with your activity.',
    empty: 'No likes yet — post a decision to start collecting signal.',
  },
};

type ProfileStatSheetProps = {
  visible: boolean;
  kind: SocialStatKey;
  onClose: () => void;
  backgroundColor: string;
  borderTopColor: string;
  bottomInset: number;
  grabColor: string;
  primaryTxt: string;
  muted: string;
  accentColor: string;
  hairline: string;
  total: number;
  people: DemoPerson[];
  likesBreakdown: LikesBreakdownRow[];
};

export function ProfileStatSheet({
  visible,
  kind,
  onClose,
  backgroundColor,
  borderTopColor,
  bottomInset,
  grabColor,
  primaryTxt,
  muted,
  accentColor,
  hairline,
  total,
  people,
  likesBreakdown,
}: ProfileStatSheetProps) {
  const copy = SHEET_COPY[kind];
  const isLikes = kind === 'likes';

  return (
    <JumpUpSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={backgroundColor}
      borderTopColor={borderTopColor}
      bottomInset={bottomInset}
      grabColor={grabColor}
      maxHeight="78%">
      <View style={styles.headRow}>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: primaryTxt }]}>{copy.title}</Text>
          <Text style={[styles.total, { color: accentColor }]}>{total.toLocaleString()}</Text>
        </View>
        <Pressable hitSlop={12} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.done, { color: muted }]}>Done</Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: muted }]}>{copy.hint}</Text>

      {isLikes ? (
        <View style={styles.likesBody}>
          {likesBreakdown.map((row, index) => (
            <View
              key={row.id}
              style={[
                styles.likesRow,
                { borderBottomColor: hairline },
                index === likesBreakdown.length - 1 && styles.likesRowLast,
              ]}>
              <View style={[styles.likesGlyph, { backgroundColor: `${accentColor}18` }]}>
                <Ionicons name="heart" size={14} color={accentColor} />
              </View>
              <Text style={[styles.likesLabel, { color: primaryTxt }]}>{row.label}</Text>
              <Text style={[styles.likesCount, { color: accentColor }]}>{row.count.toLocaleString()}</Text>
            </View>
          ))}
          <Text style={[styles.demoNote, { color: muted }]}>
            Full activity feed ships with the profile API.
          </Text>
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={[styles.empty, { color: muted }]}>{copy.empty}</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.handle}`}
              style={({ pressed }) => [
                styles.personRow,
                { borderBottomColor: hairline },
                pressed && { opacity: 0.88 },
              ]}>
              <View style={[styles.avatar, { backgroundColor: `${accentColor}22` }]}>
                <Text style={[styles.avatarInitial, { color: accentColor }]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.personText}>
                <Text style={[styles.personName, { color: primaryTxt }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.personHandle, { color: muted }]} numberOfLines={1}>
                  {item.handle}
                </Text>
                <Text style={[styles.personSubtitle, { color: muted }]} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={muted} />
            </Pressable>
          )}
        />
      )}
    </JumpUpSheet>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: screenContentGutter,
    marginBottom: 4,
    gap: 12,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...typography.titleSm,
    fontWeight: '600',
    letterSpacing: -0.25,
  },
  total: {
    ...typography.hero,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  done: {
    ...typography.titleSm,
    fontWeight: '600',
    paddingTop: 2,
  },
  hint: {
    ...typography.caption,
    paddingHorizontal: screenContentGutter,
    marginBottom: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: screenContentGutter,
    paddingBottom: spacing.sm,
  },
  empty: {
    paddingVertical: 28,
    textAlign: 'center',
    ...typography.bodySm,
    fontWeight: '500',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.body,
    fontWeight: '800',
  },
  personText: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    ...typography.bodySm,
    fontWeight: '600',
  },
  personHandle: {
    ...typography.caption,
    fontWeight: '500',
    marginTop: 1,
  },
  personSubtitle: {
    ...typography.label,
    fontWeight: '500',
    marginTop: 3,
  },
  likesBody: {
    paddingHorizontal: screenContentGutter,
    paddingBottom: spacing.sm,
  },
  likesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  likesRowLast: {
    borderBottomWidth: 0,
  },
  likesGlyph: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likesLabel: {
    flex: 1,
    ...typography.compact,
    fontWeight: '600',
    minWidth: 0,
  },
  likesCount: {
    ...typography.bodySm,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  demoNote: {
    ...typography.label,
    fontWeight: '500',
    marginTop: spacing.sm,
  },
});
