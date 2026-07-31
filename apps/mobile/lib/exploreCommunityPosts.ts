import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { z } from 'zod';

import type { DecideDraft } from '@/app/(tabs)/decide/context';
import { ExploreCardSchema, type DecisionCategory, type ExploreCard } from '@shouldi/contracts';

const STORAGE_KEY = 'shouldi/community-posts';

type Listener = () => void;
type HighlightSource = 'publish' | 'view';

const listeners = new Set<Listener>();

let postedCards: ExploreCard[] = [];
let pendingHighlightCardId: string | null = null;
let pendingHighlightSource: HighlightSource = 'publish';
let hydratePromise: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function ensureHydrated() {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const cards = z.array(ExploreCardSchema).safeParse(parsed);
        if (cards.success) {
          postedCards = cards.data;
        }
      } catch {
        // Ignore corrupt local cache until POST /requests is wired.
      } finally {
        emit();
      }
    })();
  }
  return hydratePromise;
}

async function persistPostedCards() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(postedCards));
  } catch {
    // Non-fatal for demo/local publish.
  }
}

export function usePostedCommunityCards(): ExploreCard[] {
  React.useEffect(() => {
    void ensureHydrated();
  }, []);

  return React.useSyncExternalStore(subscribe, () => postedCards, () => postedCards);
}

export function consumeHighlightRequest(): { id: string; source: HighlightSource } | null {
  if (!pendingHighlightCardId) return null;
  const request = {
    id: pendingHighlightCardId,
    source: pendingHighlightSource,
  };
  pendingHighlightCardId = null;
  emit();
  return request;
}

export function requestHighlightCard(cardId: string) {
  pendingHighlightCardId = cardId;
  pendingHighlightSource = 'view';
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
  const expertVerdicts = draft.expertVerdicts.map((verdict) => ({
    expertTitle: verdict.expertTitle,
    verdictLine: verdict.verdictLine,
  }));

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
      expertVerdicts,
    },
    matchHint: 'Your community post',
  });
}

/** Demo/local publish until POST /requests is wired. */
export function publishCommunityCard(card: ExploreCard) {
  postedCards = [card, ...postedCards.filter((posted) => posted.id !== card.id)];
  pendingHighlightCardId = card.id;
  pendingHighlightSource = 'publish';
  emit();
  void persistPostedCards();
}

export function formatCommunityPostWhen(cardId: string): string {
  const match = cardId.match(/community-post-(\d+)/);
  if (!match) return 'Recently';
  const postedAt = Number(match[1]);
  if (!Number.isFinite(postedAt)) return 'Recently';

  const deltaMs = Date.now() - postedAt;
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(postedAt));
  } catch {
    return 'Recently';
  }
}

export function totalVotesForCard(card: ExploreCard): number {
  return card.distribution.reduce((sum, row) => sum + row.votes, 0);
}
