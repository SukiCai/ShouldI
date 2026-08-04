import {
  DiscoveredExpertSchema,
  ViewerExpertsResponseSchema,
  type DiscoveredExpert,
  type DiscoveredExpertStatus,
} from '@shouldi/contracts';

import {
  expertById,
  listCatalogExperts,
  MAX_LINKED_DECISIONS,
  publicExpert,
  totalCollectibleLenses,
  type HarmenceExpert,
} from './harmence-experts.js';
import { verifyAuthHeader } from './auth.js';

function nowTs(): number {
  return Date.now();
}

type StoredDiscovery = DiscoveredExpert;

/** userId → expertId → discovery */
const discoveriesByUser = new Map<string, Map<string, StoredDiscovery>>();

function userStore(userId: string): Map<string, StoredDiscovery> {
  let store = discoveriesByUser.get(userId);
  if (!store) {
    store = new Map();
    discoveriesByUser.set(userId, store);
  }
  return store;
}

function toDiscoveredExpert(
  expert: HarmenceExpert,
  status: DiscoveredExpertStatus,
  sessionId: string,
  existing?: StoredDiscovery,
): StoredDiscovery {
  const ts = nowTs();
  return DiscoveredExpertSchema.parse({
    expertId: expert.id,
    expert: publicExpert(expert),
    frameworkLabel: expert.frameworkLabel,
    discoveryBlurb: expert.discoveryBlurb,
    activationInstruction: expert.activationInstruction,
    status,
    firstDiscoveredAt: existing?.firstDiscoveredAt ?? ts,
    lastUsedAt: ts,
    sessionCount: (existing?.sessionCount ?? 0) + (existing?.lastSessionId === sessionId ? 0 : 1),
    decisionRecordIds: existing?.decisionRecordIds ?? [],
    lastSessionId: sessionId,
  });
}

export function resolveUserIdFromAuth(authorization: string | undefined): string {
  return verifyAuthHeader(authorization) ?? 'anonymous-local';
}

export function listUserExperts(userId: string): DiscoveredExpert[] {
  const store = userStore(userId);
  return Array.from(store.values()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export function getUserExpert(userId: string, expertId: string): DiscoveredExpert | undefined {
  return userStore(userId).get(expertId);
}

export function viewerExpertsResponse(userId: string) {
  const experts = listUserExperts(userId);
  return ViewerExpertsResponseSchema.parse({
    experts,
    totalDiscovered: experts.length,
    totalCollectible: totalCollectibleLenses(),
  });
}

export function recordExpertDiscoveries(params: {
  userId: string;
  sessionId: string;
  experts: HarmenceExpert[];
}): DiscoveredExpert[] {
  if (params.experts.length === 0) return [];

  const store = userStore(params.userId);
  const delta: DiscoveredExpert[] = [];

  for (const expert of params.experts) {
    if (expert.id === 'general-decision') continue;

    const existing = store.get(expert.id);
    const isNew = !existing;
    const next = toDiscoveredExpert(expert, existing?.status ?? 'discovered', params.sessionId, existing);
    store.set(expert.id, next);
    if (isNew) delta.push(next);
  }

  return delta;
}

export function markExpertsApplied(params: {
  userId: string;
  sessionId: string;
  expertIds: string[];
  decisionRecordId: string;
}): void {
  if (params.expertIds.length === 0) return;

  const store = userStore(params.userId);
  const ts = nowTs();

  for (const expertId of params.expertIds) {
    const catalog = expertById(expertId);
    if (!catalog) continue;

    const existing = store.get(expertId);
    const decisionRecordIds = [...(existing?.decisionRecordIds ?? [])];
    if (!decisionRecordIds.includes(params.decisionRecordId)) {
      decisionRecordIds.unshift(params.decisionRecordId);
    }

    store.set(
      expertId,
      DiscoveredExpertSchema.parse({
        expertId,
        expert: publicExpert(catalog),
        frameworkLabel: catalog.frameworkLabel,
        discoveryBlurb: catalog.discoveryBlurb,
        activationInstruction: catalog.activationInstruction,
        status: 'applied',
        firstDiscoveredAt: existing?.firstDiscoveredAt ?? ts,
        lastUsedAt: ts,
        sessionCount: existing?.sessionCount ?? 1,
        decisionRecordIds: decisionRecordIds.slice(0, MAX_LINKED_DECISIONS),
        lastSessionId: params.sessionId,
      }),
    );
  }
}

export function discoveredExpertIdsForUser(userId: string): string[] {
  return listUserExperts(userId).map((row) => row.expertId);
}

export function expertCatalogResponse() {
  return { experts: listCatalogExperts() };
}

export function expertDetailForUser(userId: string, expertId: string): DiscoveredExpert | null {
  const row = getUserExpert(userId, expertId);
  if (row) return row;
  const catalog = expertById(expertId);
  if (!catalog) return null;
  return null;
}

/** Test helper */
export function resetExpertDiscoveryStore(): void {
  discoveriesByUser.clear();
}
