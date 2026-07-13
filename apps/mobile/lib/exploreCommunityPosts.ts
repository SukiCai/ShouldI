import * as React from 'react';

import type { DecideDraft } from '@/app/(tabs)/decide/context';
import { ExploreCardSchema, type DecisionCategory, type ExploreCard } from '@shouldi/contracts';

type Listener = () => void;

const listeners = new Set<Listener>();

let postedCards: ExploreCard[] = [];
let pendingHighlightCardId: string | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePostedCommunityCards(): ExploreCard[] {
  return React.useSyncExternalStore(subscribe, () => postedCards, () => postedCards);
}

export function peekPendingHighlightCardId(): string | null {
  return pendingHighlightCardId;
}

export function clearPendingHighlightCardId() {
  if (!pendingHighlightCardId) return;
  pendingHighlightCardId = null;
  emit();
}

export function buildExploreCardFromDraft(draft: DecideDraft): ExploreCard {
  const id = `community-post-${Date.now()}`;
  const question = draft.communityChallengeQuestion.trim() || draft.title.trim();
  const options = draft.pollOptions.map((option) => ({
    id: option.id,
    label: option.label.trim(),
  }));
  const keyContext = draft.keyMoments
    .filter((moment) => moment.impact?.trim())
    .map((moment) => moment.impact!.trim())
    .slice(0, 4);

  return ExploreCardSchema.parse({
    id,
    category: draft.category as DecisionCategory,
    status: 'open',
    author: {
      id: 'me',
      name: 'You',
      avatarEmoji: '🙂',
    },
    question,
    options,
    distribution: options.map((option) => ({ optionId: option.id, votes: 0 })),
    discussionPreview: draft.discussionPreview ?? [],
    rewardPoints: draft.rewardPoints ?? 10,
    hook: draft.hook.trim(),
    tension: draft.tension.trim(),
    provenance: 'community_ai_validation',
    aiSuggestedOptionId: draft.aiSuggestedOptionId,
    aiValidation: {
      verdictLine: draft.communityAiVerdictLine.trim(),
      verdictBecause: draft.communityAiBecause.trim().slice(0, 400),
      agreeWithAiVotes: 0,
      disagreeWithAiVotes: 0,
      ...(draft.aiConfidenceScore != null ? { confidenceScore: draft.aiConfidenceScore } : {}),
      keyContext,
    },
    matchHint: 'Your community post',
  });
}

/** Demo/local publish until POST /requests is wired. */
export function publishCommunityCard(card: ExploreCard) {
  postedCards = [card, ...postedCards.filter((posted) => posted.id !== card.id)];
  pendingHighlightCardId = card.id;
  emit();
}
