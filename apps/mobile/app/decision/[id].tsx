import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard, GradientHero, PillTag, SectionHeader } from '@/components/ui/Premium';
import ProvenanceChip from '@/components/ui/ProvenanceChip';
import Screen from '@/components/ui/Screen';
import {
  parseReelCategoryParam,
  REEL_SURFACE_LOCATIONS,
  reelSurfaceGradientCoarse,
} from '@/constants/reelSurfaceGradients';
import { palette, spacing, typography } from '@/constants/theme';
import { apiGetJson } from '@/lib/api';
import type { DecisionCategory, ExploreCard } from '@shouldi/contracts';
import { ExploreCardSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';

function totalVotes(card: ExploreCard): number {
  return card.distribution.reduce((sum, item) => sum + item.votes, 0);
}

function categoryLabel(cat: DecisionCategory): string {
  return (
    ({
      life: 'Life',
      career: 'Career',
      relationship: 'Relationship',
      money: 'Money',
    }) as Record<DecisionCategory, string>
  )[cat];
}

function optionLabel(card: ExploreCard, optionId: string | undefined): string | null {
  if (!optionId) return null;
  return card.options.find((o) => o.id === optionId)?.label ?? null;
}

const HEADER_CONTENT_OFFSET_IOS = 44;
const HEADER_CONTENT_OFFSET_ANDROID = 56;

type DecisionSectionsProps = {
  card: ExploreCard;
  reelPresentation: boolean;
};

function DecisionSections({ card, reelPresentation }: DecisionSectionsProps) {
  const [followed, setFollowed] = React.useState(false);
  const total = totalVotes(card);
  const effectivePicked = card.myVoteOptionId ?? null;
  const followOn = followed || card.followedByMe;
  const aiLeaningLabel = card.aiSuggestedOptionId
    ? optionLabel(card, card.aiSuggestedOptionId)
    : null;
  const rewardEligible =
    card.status === 'resolved' &&
    !!effectivePicked &&
    !!card.rewardEligibleOptionId &&
    effectivePicked === card.rewardEligibleOptionId;

  return (
    <>
      {reelPresentation ? (
        <View style={styles.threadHeroCard}>
          <Text style={styles.threadEyebrow}>Community decision</Text>
          <Text style={styles.threadTitle}>{card.question}</Text>
          <Text style={styles.threadSub}>{total.toLocaleString()} votes · Discussion & rewards</Text>
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <PillTag label={card.status === 'open' ? 'Open' : 'Resolved'} tone={card.status === 'open' ? 'brand' : 'good'} />
          </View>
        </View>
      ) : (
        <GradientHero
          eyebrow="Community decision"
          title={card.question}
          subtitle="Discussion, context, and follow/reward status."
          right={<PillTag label={`${total} votes`} tone="brand" />}
        />
      )}

      <SectionHeader title="Discussion highlights" />
      <GlassCard style={[styles.topicCard, reelPresentation && styles.frostPanel]}>
        {card.discussionPreview.map((line, idx) => (
          <Text key={`${line}-${idx}`} style={styles.discuss}>
            • {line}
          </Text>
        ))}
      </GlassCard>

      {aiLeaningLabel ? (
        <>
          <SectionHeader title="ShouldI AI leaning" />
          <GlassCard style={[styles.topicCard, reelPresentation && styles.frostPanel]}>
            <Text style={typography.body}>
              Suggested option: <Text style={styles.aiSuggestedEmphasis}>{aiLeaningLabel}</Text>
            </Text>
            {card.aiSuggestionNote ? (
              <Text style={styles.aiSuggestionNoteDetail}>{card.aiSuggestionNote}</Text>
            ) : null}
          </GlassCard>
        </>
      ) : null}

      {card.matchHint ? (
        <>
          <SectionHeader title="Sounds like your situation?" />
          <GlassCard style={[styles.topicCard, reelPresentation && styles.frostPanel]}>
            <Text style={typography.body}>{card.matchHint}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Decide to work through your own choice"
              onPress={() => router.push('/(tabs)/decide')}
              style={({ pressed }) => [styles.decideLink, pressed && styles.decideLinkPressed]}>
              <Text style={styles.decideLinkText}>Structure your decision in Decide →</Text>
            </Pressable>
          </GlassCard>
        </>
      ) : null}

      <SectionHeader title="Follow & rewards" />
      <GlassCard style={[styles.topicCard, reelPresentation && styles.frostPanel]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Follow this decision"
          onPress={() => setFollowed((v: boolean) => !v)}
          style={[styles.followBtn, followOn && styles.followBtnOn]}>
          <Text style={[styles.followLabel, followOn && styles.followLabelOn]}>
            {followOn ? 'Following for updates' : 'Follow this decision'}
          </Text>
        </Pressable>
        {card.status === 'open' ? (
          <Text style={typography.body}>
            Followed users get notified when the author posts the final outcome.
          </Text>
        ) : rewardEligible ? (
          <Text style={styles.rewardGood}>You picked the winning decision. Reward unlocked 🎉</Text>
        ) : (
          <Text style={typography.body}>Reward goes to users whose vote matched the winning outcome.</Text>
        )}
      </GlassCard>

      <SectionHeader title="Case context" />
      <GlassCard style={[styles.topicCard, reelPresentation && styles.frostPanel]}>
        <View style={styles.metaRow}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{categoryLabel(card.category)}</Text>
          </View>
          <View style={styles.provenanceShrink}>
            <ProvenanceChip provenance={card.provenance} />
          </View>
          <PillTag label={card.status === 'open' ? 'Open' : 'Resolved'} tone={card.status === 'open' ? 'brand' : 'good'} style={styles.statusTag} />
        </View>
        <Text style={styles.label}>Tension</Text>
        <Text style={typography.body}>{card.tension}</Text>
        {card.status === 'resolved' ? (
          <>
            <Text style={styles.label}>Outcome</Text>
            <Text style={typography.body}>{card.outcome}</Text>
            <Text style={styles.label}>Takeaway</Text>
            <Text style={typography.body}>{card.takeaway}</Text>
          </>
        ) : (
          <Text style={typography.body}>Outcome and lesson will appear once the author closes this decision.</Text>
        )}
      </GlassCard>
      <View style={{ height: 28 }} />
    </>
  );
}

export default function DecisionDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string | string[]; fromReel?: string | string[]; reelCategory?: string | string[] }>();

  const idRaw = params.id;
  const id = typeof idRaw === 'string' ? idRaw : Array.isArray(idRaw) ? idRaw[0] : '';
  const fromReelParam = typeof params.fromReel === 'string' ? params.fromReel : Array.isArray(params.fromReel) ? params.fromReel[0] : undefined;
  const fromReel = fromReelParam === '1' || fromReelParam === 'true';
  const categorySeed = parseReelCategoryParam(params.reelCategory);

  const expand = useSharedValue(fromReel ? 0 : 1);

  const query = useQuery({
    enabled: !!id,
    queryKey: ['decision-detail', id],
    queryFn: async () => {
      const json = await apiGetJson(`/v1/explore/${id}`);
      return ExploreCardSchema.parse(json);
    },
  });

  const categoryBg: DecisionCategory = query.data?.category ?? categorySeed ?? 'life';
  const gradient = reelSurfaceGradientCoarse(categoryBg);

  React.useEffect(() => {
    if (!fromReel) {
      expand.value = 1;
      return;
    }
    expand.value = 0;
    expand.value = withSpring(1, { damping: 18, stiffness: 186, mass: 0.8 });
  }, [expand, fromReel, id]);

  React.useLayoutEffect(() => {
    if (fromReel) {
      navigation.setOptions({
        title: '',
        headerTransparent: true,
        headerShadowVisible: false,
        headerTintColor: palette.slate950,
        headerBackTitleVisible: false,
        animation: 'fade',
      } as object);
      return;
    }

    navigation.setOptions({
      title: 'Decision details',
      headerTransparent: false,
      headerShadowVisible: true,
      headerTintColor: palette.accent,
    } as object);
  }, [navigation, fromReel]);

  const shellStyle = useAnimatedStyle(() => {
    const horizontal = interpolate(expand.value, [0, 1], [22, 0], Extrapolation.CLAMP);
    const vertical = interpolate(expand.value, [0, 1], [28, 0], Extrapolation.CLAMP);
    const radius = interpolate(expand.value, [0, 1], [28, 0], Extrapolation.CLAMP);
    const scale = interpolate(expand.value, [0, 1], [0.94, 1], Extrapolation.CLAMP);
    return {
      flex: 1,
      overflow: 'hidden',
      marginHorizontal: horizontal,
      marginTop: vertical,
      marginBottom: vertical,
      borderRadius: radius,
      transform: [{ scale }],
    };
  });

  const approxHeaderPad =
    insets.top + (Platform.OS === 'ios' ? HEADER_CONTENT_OFFSET_IOS : HEADER_CONTENT_OFFSET_ANDROID);

  if (!fromReel) {
    if (query.isLoading) {
      return (
        <Screen padded>
          <Text style={typography.body}>Loading decision…</Text>
        </Screen>
      );
    }
    if (query.error || !query.data) {
      return (
        <Screen padded>
          <Text style={typography.title}>Decision not found</Text>
        </Screen>
      );
    }

    const card = query.data;
    return (
      <Screen padded scroll>
        <DecisionSections card={card} reelPresentation={false} />
      </Screen>
    );
  }

  if (query.error || (!query.isLoading && !query.data)) {
    return (
      <View style={styles.reelOuter}>
        <Animated.View style={[shellStyle, styles.fill]}>
          <LinearGradient colors={[...gradient]} locations={[...REEL_SURFACE_LOCATIONS]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
            <View style={[styles.edgePad, { paddingTop: approxHeaderPad + 8 }]}>
              <Text style={styles.onGradientTitle}>Decision not found</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  }

  if (query.isLoading || !query.data) {
    return (
      <View style={styles.reelOuter}>
        <Animated.View style={[shellStyle, styles.fill]}>
          <LinearGradient colors={[...gradient]} locations={[...REEL_SURFACE_LOCATIONS]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
            <View style={[styles.centerLoader, { paddingTop: approxHeaderPad }]}>
              <ActivityIndicator size="large" color={palette.slate950} />
              <Text style={styles.loaderLabel}>Opening thread…</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  }

  const card = query.data;

  return (
    <View style={styles.reelOuter}>
      <Animated.View style={[shellStyle, styles.fill]}>
        <LinearGradient colors={[...gradient]} locations={[...REEL_SURFACE_LOCATIONS]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
          <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
            <View style={[styles.edgePad, { paddingTop: approxHeaderPad + 10 }]}>
              <DecisionSections card={card} reelPresentation />
            </View>
          </ScrollView>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  reelOuter: {
    flex: 1,
    backgroundColor: palette.mist,
  },
  fill: {
    flex: 1,
  },
  edgePad: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 32,
  },
  centerLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loaderLabel: {
    ...typography.body,
    color: 'rgba(11,18,36,0.85)',
    fontWeight: '600',
  },
  onGradientTitle: {
    ...typography.title,
    color: palette.slate950,
  },
  frostPanel: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderColor: 'rgba(255,255,255,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  topicCard: {
    gap: 8,
  },
  threadHeroCard: {
    backgroundColor: 'rgba(253,253,253,0.58)',
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.72)',
    marginBottom: 4,
    gap: 6,
  },
  threadEyebrow: {
    ...typography.caption,
    color: palette.accent,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontSize: 11,
  },
  threadTitle: {
    ...typography.hero,
    color: palette.slate950,
    marginTop: 2,
    letterSpacing: -0.3,
    lineHeight: 36,
    fontWeight: '700',
    fontSize: 26,
  },
  threadSub: {
    ...typography.compact,
    color: palette.slate800,
    opacity: 0.95,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  categoryPill: {
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cdd9ff',
    justifyContent: 'center',
  },
  categoryPillText: {
    ...typography.caption,
    color: palette.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  provenanceShrink: {
    flexShrink: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  statusTag: {
    alignSelf: 'center',
  },
  decideLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cdd9ff',
    backgroundColor: palette.accentSoft,
  },
  decideLinkPressed: {
    opacity: 0.9,
  },
  decideLinkText: {
    ...typography.compact,
    color: palette.accent,
    fontWeight: '700',
  },
  discuss: {
    ...typography.body,
    color: palette.slate900,
  },
  label: {
    ...typography.caption,
    marginTop: spacing.xs,
    color: palette.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  followBtn: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cad6ff',
    backgroundColor: '#eef3ff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  followBtnOn: {
    borderColor: '#bfe4d1',
    backgroundColor: '#e9f8f2',
  },
  followLabel: {
    ...typography.compact,
    color: palette.accent,
    fontWeight: '700',
  },
  followLabelOn: {
    color: palette.mint,
  },
  rewardGood: {
    ...typography.body,
    color: palette.mint,
    fontWeight: '700',
  },
  aiSuggestedEmphasis: {
    fontWeight: '800',
    color: palette.accent,
  },
  aiSuggestionNoteDetail: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: palette.slate500,
    lineHeight: 18,
  },
});
