import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard, GradientHero, PillTag, SectionHeader } from '@/components/ui/Premium';
import Screen from '@/components/ui/Screen';
import { palette, spacing, typography } from '@/constants/theme';
import { apiGetJson } from '@/lib/api';
import type { ExploreCard } from '@shouldi/contracts';
import { ExploreCardSchema } from '@shouldi/contracts';
import { useQuery } from '@tanstack/react-query';

function totalVotes(card: ExploreCard): number {
  return card.distribution.reduce((sum, item) => sum + item.votes, 0);
}

export default function DecisionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [followed, setFollowed] = useState(false);

  const query = useQuery({
    enabled: !!id,
    queryKey: ['decision-detail', id],
    queryFn: async () => {
      const json = await apiGetJson(`/v1/explore/${id}`);
      return ExploreCardSchema.parse(json);
    },
  });

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
  const total = totalVotes(card);
  const effectivePicked = card.myVoteOptionId ?? null;
  const followOn = followed || card.followedByMe;
  const rewardEligible =
    card.status === 'resolved' &&
    !!effectivePicked &&
    !!card.rewardEligibleOptionId &&
    effectivePicked === card.rewardEligibleOptionId;

  return (
    <Screen padded scroll>
      <GradientHero
        eyebrow="Community decision"
        title={card.question}
        subtitle="Discussion, context, and follow/reward status."
        right={<PillTag label={`${total} votes`} tone="brand" />}
      />

      <SectionHeader title="Discussion highlights" />
      <GlassCard style={{ gap: 8 }}>
        {card.discussionPreview.map((line, idx) => (
          <Text key={`${line}-${idx}`} style={styles.discuss}>• {line}</Text>
        ))}
      </GlassCard>

      {card.matchHint ? (
        <>
          <SectionHeader title="Sounds like your situation?" />
          <GlassCard style={{ gap: 10 }}>
            <Text style={typography.body}>{card.matchHint}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Decide to work through your own choice"
              onPress={() => router.push('/(tabs)/decide')}
              style={({ pressed }) => [styles.decideLink, pressed && styles.decideLinkPressed]}
            >
              <Text style={styles.decideLinkText}>Structure your decision in Decide →</Text>
            </Pressable>
          </GlassCard>
        </>
      ) : null}

      <SectionHeader title="Follow & rewards" />
      <GlassCard style={{ gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Follow this decision"
          onPress={() => setFollowed((v: boolean) => !v)}
          style={[styles.followBtn, followOn && styles.followBtnOn]}
        >
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
      <GlassCard style={{ gap: 6 }}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
