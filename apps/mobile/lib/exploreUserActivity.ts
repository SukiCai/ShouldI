import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { z } from 'zod';

import { ExploreCardSchema, type ExploreCard } from '@shouldi/contracts';

const PARTICIPATED_KEY = 'shouldi/explore-participated';
const WATCHING_KEY = 'shouldi/explore-watching';

type Listener = () => void;

const listeners = new Set<Listener>();

let participatedCards: ExploreCard[] = [];
let watchingEntries: WatchingEntry[] = [];
let participatedHydratePromise: Promise<void> | null = null;
let watchingHydratePromise: Promise<void> | null = null;

const WatchingEntrySchema = z.object({
  card: ExploreCardSchema,
  saved: z.boolean(),
  followed: z.boolean(),
  updatedAt: z.number().int(),
});

export type WatchingEntry = z.infer<typeof WatchingEntrySchema>;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function ensureParticipatedHydrated() {
  if (!participatedHydratePromise) {
    participatedHydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(PARTICIPATED_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const cards = z.array(ExploreCardSchema).safeParse(parsed);
        if (cards.success) participatedCards = cards.data;
      } catch {
        // Ignore corrupt cache until API ships.
      } finally {
        emit();
      }
    })();
  }
  return participatedHydratePromise;
}

async function ensureWatchingHydrated() {
  if (!watchingHydratePromise) {
    watchingHydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(WATCHING_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const entries = z.array(WatchingEntrySchema).safeParse(parsed);
        if (entries.success) watchingEntries = entries.data;
      } catch {
        // Ignore corrupt cache until API ships.
      } finally {
        emit();
      }
    })();
  }
  return watchingHydratePromise;
}

async function persistParticipated() {
  try {
    await AsyncStorage.setItem(PARTICIPATED_KEY, JSON.stringify(participatedCards));
  } catch {
    // Non-fatal for demo/local tracking.
  }
}

async function persistWatching() {
  try {
    await AsyncStorage.setItem(WATCHING_KEY, JSON.stringify(watchingEntries));
  } catch {
    // Non-fatal for demo/local tracking.
  }
}

export function useParticipatedCards(): ExploreCard[] {
  React.useEffect(() => {
    void ensureParticipatedHydrated();
  }, []);
  return React.useSyncExternalStore(subscribe, () => participatedCards, () => participatedCards);
}

export function useWatchingEntries(): WatchingEntry[] {
  React.useEffect(() => {
    void ensureWatchingHydrated();
  }, []);
  return React.useSyncExternalStore(subscribe, () => watchingEntries, () => watchingEntries);
}

export function recordParticipation(card: ExploreCard, optionId: string) {
  const nextCard = ExploreCardSchema.parse({
    ...card,
    myVoteOptionId: optionId,
  });
  participatedCards = [nextCard, ...participatedCards.filter((entry) => entry.id !== card.id)];
  emit();
  void persistParticipated();
}

export function updateWatching(
  card: ExploreCard,
  flags: { saved?: boolean; followed?: boolean },
) {
  const existing = watchingEntries.find((entry) => entry.card.id === card.id);
  const saved = flags.saved ?? existing?.saved ?? false;
  const followed = flags.followed ?? existing?.followed ?? false;

  if (!saved && !followed) {
    watchingEntries = watchingEntries.filter((entry) => entry.card.id !== card.id);
  } else {
    const entry = WatchingEntrySchema.parse({
      card: ExploreCardSchema.parse({
        ...card,
        savedByMe: saved,
        followedByMe: followed,
      }),
      saved,
      followed,
      updatedAt: Date.now(),
    });
    watchingEntries = [entry, ...watchingEntries.filter((row) => row.card.id !== card.id)];
  }

  emit();
  void persistWatching();
}

export function formatActivityWhen(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return 'Recently';
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(timestamp));
  } catch {
    return 'Recently';
  }
}

export function activeThreadCount(participated: ExploreCard[], watching: WatchingEntry[]): number {
  const ids = new Set<string>();
  for (const card of participated) ids.add(card.id);
  for (const entry of watching) ids.add(entry.card.id);
  return ids.size;
}
