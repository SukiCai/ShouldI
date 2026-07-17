import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import JumpUpSheet from '@/components/ui/JumpUpSheet';
import { ExpertGlyph } from '@/app/(tabs)/decide/components/DecideThreadParts';
import { apiGetJson } from '@/lib/api';
import {
  buildLensLibrary,
  flattenLensSlots,
  type LensSlot,
} from '@/lib/lensLibrary';
import {
  PROFILE_DEMO_CATALOG,
  PROFILE_DEMO_LENS_EXPERTS,
  PROFILE_DEMO_TOTAL_COLLECTIBLE,
} from '@/lib/lensLibraryMockData';
import { radius, screenContentGutter, semantic, spacing } from '@/constants/theme';
import {
  DiscoveredExpertSchema,
  ExpertCatalogResponseSchema,
  ViewerExpertsResponseSchema,
  type DiscoveredExpert,
  type DiscoveredExpertStatus,
} from '@shouldi/contracts';

import { youScreenStyles as styles } from './youScreenStyles';

const PREVIEW_UNLOCKED = 2;

const perspectivePillStyle = {
  paddingHorizontal: 10,
  paddingVertical: 4,
  flexShrink: 0 as const,
};

function formatRelativeWhen(ts: number): string {
  const delta = Date.now() - ts;
  const days = Math.floor(delta / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(ts));
  } catch {
    return 'Recently';
  }
}

function unlockedPillCopy(status: DiscoveredExpertStatus): string {
  if (status === 'calibrated') return 'Calibrated';
  if (status === 'applied') return 'Applied';
  return 'Unlocked';
}

function UnlockedStatusPill({ status }: { status: DiscoveredExpertStatus }) {
  const isCalibrated = status === 'calibrated';
  const isApplied = status === 'applied';
  const color = isCalibrated ? semantic.actionAffirm : isApplied ? semantic.actionPrimary : semantic.actionAffirm;
  const bg = isCalibrated
    ? `${semantic.actionAffirm}18`
    : isApplied
      ? `${semantic.actionPrimary}18`
      : `${semantic.actionAffirm}14`;

  return (
    <View style={[styles.statusPill, perspectivePillStyle, { backgroundColor: bg }]}>
      <Text style={[styles.statusPillText, { color }]}>{unlockedPillCopy(status)}</Text>
    </View>
  );
}

function LockedPill({ textMuted, groupedBorder }: { textMuted: string; groupedBorder: string }) {
  return (
    <View
      style={[
        styles.statusPill,
        perspectivePillStyle,
        localStyles.lockedPill,
        { borderColor: groupedBorder },
      ]}>
      <Ionicons name="lock-closed-outline" size={11} color={textMuted} />
      <Text style={[styles.statusPillText, { color: textMuted }]}>Locked</Text>
    </View>
  );
}

function LockedSilhouetteIcon({
  catalog,
  groupedBorder,
  surfaceBg,
}: {
  catalog: LensSlot['catalog'];
  groupedBorder: string;
  surfaceBg: string;
}) {
  const accent = catalog.color ?? semantic.actionPrimary;
  const iconName = catalog.icon as keyof typeof Ionicons.glyphMap;

  return (
    <View style={localStyles.lockedIconShell}>
      <View
        style={[
          styles.recentIconWrap,
          localStyles.lockedIconWrap,
          { backgroundColor: `${accent}14`, borderColor: `${accent}28` },
        ]}>
        <Ionicons name={iconName} size={16} color={`${accent}88`} />
      </View>
      <View style={[localStyles.lockedIconBadge, { backgroundColor: surfaceBg, borderColor: groupedBorder }]}>
        <Ionicons name="lock-closed" size={9} color={accent} />
      </View>
    </View>
  );
}

function UnlockProgressBar({
  unlocked,
  total,
  trackColor,
  fillColor,
}: {
  unlocked: number;
  total: number;
  trackColor: string;
  fillColor: string;
}) {
  const ratio = total > 0 ? Math.min(1, unlocked / total) : 0;
  return (
    <View style={[localStyles.progressTrack, { backgroundColor: trackColor }]}>
      <View style={[localStyles.progressFill, { backgroundColor: fillColor, flex: ratio }]} />
      <View style={{ flex: 1 - ratio }} />
    </View>
  );
}

function UnlockedRow({
  row,
  textDisplay,
  textMuted,
  hairline,
  isLast,
  onPress,
  horizontalInset = 0,
}: {
  row: DiscoveredExpert;
  textDisplay: string;
  textMuted: string;
  hairline: string;
  isLast: boolean;
  onPress: () => void;
  horizontalInset?: number;
}) {
  const iconName = row.expert.icon as keyof typeof Ionicons.glyphMap;
  const iconColor = row.expert.color ?? semantic.actionPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${row.expert.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentDecisionRow,
        horizontalInset > 0 && { paddingHorizontal: horizontalInset },
        !isLast && { borderBottomColor: hairline, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { opacity: 0.88 },
      ]}>
      <View style={styles.recentDecisionRowLayout}>
        <View style={[styles.recentIconWrap, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={iconName} size={16} color={iconColor} />
        </View>
        <View style={styles.recentDecisionCopy}>
          <Text style={[styles.recentDecisionTitle, { color: textDisplay }]} numberOfLines={2}>
            {row.expert.title}
          </Text>
          <Text style={[styles.postFoot, { color: textMuted }]} numberOfLines={1}>
            {row.frameworkLabel} · {formatRelativeWhen(row.lastUsedAt)}
          </Text>
        </View>
        <UnlockedStatusPill status={row.status} />
      </View>
    </Pressable>
  );
}

function LockedRow({
  slot,
  textDisplay,
  textMuted,
  hairline,
  groupedBorder,
  groupedSurface,
  isLast,
  onPress,
  horizontalInset = 0,
}: {
  slot: LensSlot;
  textDisplay: string;
  textMuted: string;
  hairline: string;
  groupedBorder: string;
  groupedSurface: string;
  isLast: boolean;
  onPress: () => void;
  horizontalInset?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Locked perspective: ${slot.catalog.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentDecisionRow,
        horizontalInset > 0 && { paddingHorizontal: horizontalInset },
        !isLast && { borderBottomColor: hairline, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { opacity: 0.88 },
      ]}>
      <View style={styles.recentDecisionRowLayout}>
        <LockedSilhouetteIcon
          catalog={slot.catalog}
          groupedBorder={groupedBorder}
          surfaceBg={groupedSurface}
        />
        <View style={styles.recentDecisionCopy}>
          <Text style={[styles.recentDecisionTitle, { color: textDisplay }]} numberOfLines={2}>
            {slot.catalog.title}
          </Text>
          <Text style={[styles.postFoot, { color: textMuted }]} numberOfLines={1}>
            {slot.catalog.frameworkLabel} · Discover in Decide
          </Text>
        </View>
        <LockedPill textMuted={textMuted} groupedBorder={groupedBorder} />
      </View>
    </Pressable>
  );
}

function PerspectiveDetailSheet({
  visible,
  onClose,
  expert,
  backgroundColor,
  borderTopColor,
  bottomInset,
  grabColor,
  isDark,
  textDisplay,
  textPrimary,
  textMuted,
  groupedBorder,
}: {
  visible: boolean;
  onClose: () => void;
  expert: DiscoveredExpert | null;
  backgroundColor: string;
  borderTopColor: string;
  bottomInset: number;
  grabColor: string;
  isDark: boolean;
  textDisplay: string;
  textPrimary: string;
  textMuted: string;
  groupedBorder: string;
}) {
  if (!expert) return null;
  const accent = expert.expert.color ?? semantic.actionAffirm;

  return (
    <JumpUpSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={backgroundColor}
      borderTopColor={borderTopColor}
      bottomInset={bottomInset}
      grabColor={grabColor}
      maxHeight="78%">
      <View style={[localStyles.detailHeader, { borderBottomColor: groupedBorder }]}>
        <ExpertGlyph expert={expert.expert} fallbackColor={accent} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[localStyles.detailTitle, { color: textDisplay }]}>{expert.expert.title}</Text>
          <Text style={[localStyles.detailFramework, { color: textMuted }]}>{expert.frameworkLabel}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={onClose}
          style={[
            localStyles.closeBtn,
            {
              borderColor: groupedBorder,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
            },
          ]}>
          <Ionicons name="close" size={18} color={textMuted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={localStyles.detailBody} showsVerticalScrollIndicator={false}>
        <UnlockedStatusPill status={expert.status} />
        <Text style={[localStyles.detailBlurb, { color: textPrimary }]}>{expert.discoveryBlurb}</Text>
        {expert.decisionRecordIds[0] ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onClose();
              router.push({
                pathname: '/outcome-replay/[id]',
                params: { id: expert.decisionRecordIds[0]! },
              });
            }}
            style={[localStyles.linkedRow, { borderColor: groupedBorder }]}>
            <Text style={[localStyles.linkedRowText, { color: textPrimary }]}>View linked replay</Text>
            <Ionicons name="chevron-forward" size={14} color={textMuted} />
          </Pressable>
        ) : null}
      </ScrollView>
    </JumpUpSheet>
  );
}

function PerspectivesLibrarySheet({
  visible,
  onClose,
  unlocked,
  locked,
  onSelectUnlocked,
  backgroundColor,
  borderTopColor,
  bottomInset,
  grabColor,
  textDisplay,
  textMuted,
  groupedBorder,
}: {
  visible: boolean;
  onClose: () => void;
  unlocked: DiscoveredExpert[];
  locked: LensSlot[];
  onSelectUnlocked: (row: DiscoveredExpert) => void;
  backgroundColor: string;
  borderTopColor: string;
  bottomInset: number;
  grabColor: string;
  textDisplay: string;
  textMuted: string;
  groupedBorder: string;
}) {
  return (
    <JumpUpSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={backgroundColor}
      borderTopColor={borderTopColor}
      bottomInset={bottomInset}
      grabColor={grabColor}
      maxHeight="78%">
      <Text style={[localStyles.sheetTitle, { color: textDisplay }]}>Perspective library</Text>
      <Text style={[localStyles.sheetSub, { color: textMuted }]}>
        {unlocked.length} unlocked · {locked.length} still to discover in Decide
      </Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: screenContentGutter }}>
        {unlocked.map((row, index) => (
          <UnlockedRow
            key={row.expertId}
            row={row}
            textDisplay={textDisplay}
            textMuted={textMuted}
            hairline={groupedBorder}
            horizontalInset={screenContentGutter}
            isLast={index === unlocked.length - 1 && locked.length === 0}
            onPress={() => {
              onClose();
              onSelectUnlocked(row);
            }}
          />
        ))}
        {locked.length > 0 ? (
          <>
            <Text style={[localStyles.sheetSection, { color: textMuted }]}>Still locked</Text>
            {locked.map((slot, index) => (
              <LockedRow
                key={slot.expertId}
                slot={slot}
                textDisplay={textDisplay}
                textMuted={textMuted}
                hairline={groupedBorder}
                groupedBorder={groupedBorder}
                groupedSurface={backgroundColor}
                horizontalInset={screenContentGutter}
                isLast={index === locked.length - 1}
                onPress={() => {
                  onClose();
                  router.replace('/(tabs)/decide');
                }}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </JumpUpSheet>
  );
}

type ProfilePerspectivesSectionProps = {
  lensLibraryUnlocked: boolean;
  useDemo: boolean;
  textDisplay: string;
  textPrimary: string;
  textMuted: string;
  groupedSurface: string;
  groupedBorder: string;
  hairline: string;
  modalBg: string;
  isDark: boolean;
  bottomInset: number;
};

export function ProfilePerspectivesSection({
  lensLibraryUnlocked,
  useDemo,
  textDisplay,
  textPrimary,
  textMuted,
  groupedSurface,
  groupedBorder,
  hairline,
  modalBg,
  isDark,
  bottomInset,
}: ProfilePerspectivesSectionProps) {
  const [selectedExpert, setSelectedExpert] = React.useState<DiscoveredExpert | null>(null);
  const [libraryOpen, setLibraryOpen] = React.useState(false);

  const catalogQuery = useQuery({
    queryKey: ['experts-catalog'],
    queryFn: async () => {
      const data = await apiGetJson('/v1/experts/catalog');
      return ExpertCatalogResponseSchema.parse(data).experts;
    },
    staleTime: 60_000 * 30,
  });

  const expertsQuery = useQuery({
    queryKey: ['me-experts'],
    enabled: !useDemo,
    queryFn: async () => {
      const data = await apiGetJson('/v1/me/experts');
      return ViewerExpertsResponseSchema.parse(data);
    },
  });

  const discovered = (
    useDemo ? PROFILE_DEMO_LENS_EXPERTS : (expertsQuery.data?.experts ?? [])
  ).map((row) => DiscoveredExpertSchema.parse(row));

  const catalog = useDemo ? PROFILE_DEMO_CATALOG : (catalogQuery.data ?? []);
  const library = React.useMemo(
    () => (catalog.length > 0 ? buildLensLibrary(catalog, discovered) : null),
    [catalog, discovered],
  );

  const allSlots = library ? flattenLensSlots(library) : [];
  const lockedSlots = allSlots.filter((slot) => slot.tier === 'locked');
  const unlockedTotal = library?.overallEncountered ?? discovered.length;
  const collectibleTotal = useDemo
    ? PROFILE_DEMO_TOTAL_COLLECTIBLE
    : (library?.overallTotal ?? expertsQuery.data?.totalCollectible ?? collectibleTotalFallback(catalog));

  const loading = !useDemo && (catalogQuery.isLoading || expertsQuery.isLoading);
  const grabColor = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(15,23,42,0.22)';

  if (loading && lensLibraryUnlocked) {
    return (
      <View style={styles.sectionWrap}>
        <View
          style={[
            styles.insightFeedCard,
            styles.insightCardShell,
            { backgroundColor: groupedSurface, borderColor: groupedBorder },
          ]}>
          <ActivityIndicator color={semantic.actionPrimary} style={{ paddingVertical: 20 }} />
        </View>
      </View>
    );
  }

  if (!lensLibraryUnlocked) {
    return (
      <View style={styles.sectionWrap}>
        <View
          style={[
            styles.insightFeedCard,
            styles.insightCardShell,
            { backgroundColor: groupedSurface, borderColor: groupedBorder, gap: 10 },
          ]}>
          <View style={styles.insightCardHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={[styles.insightCardTitle, { color: textDisplay }]}>My perspectives</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${semantic.actionCaution}14` }]}>
              <Text style={[styles.statusPillText, { color: semantic.actionCaution }]}>Locked</Text>
            </View>
          </View>
          <Text style={[styles.cardBody, { color: textMuted, lineHeight: 20 }]}>
            Complete your first Decide session to unlock specialist perspectives.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a decision"
            onPress={() => router.replace('/(tabs)/decide')}
            style={[
              styles.ghostBtn,
              styles.cardListFooterBtn,
              { borderColor: groupedBorder },
            ]}>
            <Text style={[styles.ghostBtnText, { color: textPrimary }]}>Start a decision</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (discovered.length === 0 && lockedSlots.length === 0) return null;

  const previewUnlocked = discovered
    .slice()
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, PREVIEW_UNLOCKED);
  const previewLocked = lockedSlots.slice(0, 1);
  const showLibraryLink = unlockedTotal + lockedSlots.length > PREVIEW_UNLOCKED + previewLocked.length;

  return (
    <View style={styles.sectionWrap}>
      <View
        style={[
          styles.insightFeedCard,
          styles.insightCardShell,
          { backgroundColor: groupedSurface, borderColor: groupedBorder, gap: 0 },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open perspective library"
          onPress={() => setLibraryOpen(true)}
          style={styles.insightCardHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={[styles.insightCardTitle, { color: textDisplay }]}>My perspectives</Text>
            <Text style={[styles.postFoot, { color: textMuted }]}>
              {unlockedTotal} of {collectibleTotal} unlocked
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={textMuted} />
        </Pressable>

        <View style={localStyles.progressBlock}>
          <UnlockProgressBar
            unlocked={unlockedTotal}
            total={collectibleTotal}
            trackColor={hairline}
            fillColor={semantic.actionAffirm}
          />
        </View>

        {previewUnlocked.map((row, index) => (
          <UnlockedRow
            key={row.expertId}
            row={row}
            textDisplay={textDisplay}
            textMuted={textMuted}
            hairline={hairline}
            isLast={index === previewUnlocked.length - 1 && previewLocked.length === 0 && !showLibraryLink}
            onPress={() => setSelectedExpert(row)}
          />
        ))}

        {previewLocked.map((slot, index) => (
          <LockedRow
            key={slot.expertId}
            slot={slot}
            textDisplay={textDisplay}
            textMuted={textMuted}
            hairline={hairline}
            groupedBorder={groupedBorder}
            groupedSurface={groupedSurface}
            isLast={index === previewLocked.length - 1 && !showLibraryLink}
            onPress={() => router.replace('/(tabs)/decide')}
          />
        ))}

        {showLibraryLink ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open perspective library"
            onPress={() => setLibraryOpen(true)}
            style={[
              styles.ghostBtn,
              styles.cardListFooterBtn,
              { borderColor: groupedBorder },
            ]}>
            <Text style={[styles.ghostBtnText, { color: textPrimary }]}>
              View library ({collectibleTotal})
            </Text>
          </Pressable>
        ) : null}
      </View>

      <PerspectivesLibrarySheet
        visible={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        unlocked={discovered.slice().sort((a, b) => b.lastUsedAt - a.lastUsedAt)}
        locked={lockedSlots}
        onSelectUnlocked={setSelectedExpert}
        backgroundColor={modalBg}
        borderTopColor={groupedBorder}
        bottomInset={bottomInset}
        grabColor={grabColor}
        textDisplay={textDisplay}
        textMuted={textMuted}
        groupedBorder={groupedBorder}
      />

      <PerspectiveDetailSheet
        visible={selectedExpert != null}
        onClose={() => setSelectedExpert(null)}
        expert={selectedExpert}
        backgroundColor={modalBg}
        borderTopColor={groupedBorder}
        bottomInset={bottomInset}
        grabColor={grabColor}
        isDark={isDark}
        textDisplay={textDisplay}
        textPrimary={textPrimary}
        textMuted={textMuted}
        groupedBorder={groupedBorder}
      />
    </View>
  );
}

function collectibleTotalFallback(
  catalog: { lensDomain: string }[],
): number {
  return catalog.filter((entry) => entry.lensDomain !== 'general').length || 6;
}

const localStyles = StyleSheet.create({
  lockedIconShell: {
    width: 36,
    height: 36,
    flexShrink: 0,
  },
  lockedIconWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  lockedIconBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
  },
  progressBlock: {
    paddingBottom: 8,
    gap: 6,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 2,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    paddingHorizontal: screenContentGutter,
    paddingBottom: 4,
  },
  sheetSub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    paddingHorizontal: screenContentGutter,
    paddingBottom: 12,
  },
  sheetSection: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingHorizontal: screenContentGutter,
    paddingTop: 12,
    paddingBottom: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: screenContentGutter,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  detailFramework: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
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
  detailBody: {
    paddingHorizontal: screenContentGutter,
    paddingTop: 14,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  detailBlurb: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  linkedRowText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
