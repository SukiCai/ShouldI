/**
 * OpenAI-compatible client for the Hermes gateway api_server (default :8642).
 * See hermes-agent-private/website/docs/user-guide/features/api-server.md
 */

import { resolveHermesRepoRoot } from './hermes-resolve.js';

export type HermesChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type HermesAgentStatus = {
  repoPresent: boolean;
  repoRoot: string | null;
  apiUrl: string;
  apiLive: boolean;
  apiKeyConfigured: boolean;
};

function hermesApiBaseUrl(): string {
  const fromEnv = process.env.HERMES_API_URL?.trim() || process.env.SHOULDI_HERMES_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'http://127.0.0.1:8642';
}

function hermesApiKey(): string {
  return (
    process.env.HERMES_API_KEY?.trim() ||
    process.env.SHOULDI_HERMES_API_KEY?.trim() ||
    process.env.API_SERVER_KEY?.trim() ||
    ''
  );
}

function requestTimeoutMs(): number {
  const raw = process.env.HERMES_REQUEST_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : 180_000;
  return Number.isFinite(n) && n > 0 ? n : 180_000;
}

/**
 * Phase 6/7 internal per-turn subprocess RPC service (hermes-agent-private/
 * gateway/internal_rpc.py), default :8643. Per-user HERMES_HOME isolation —
 * preferred over the shared api_server below when live; the shared
 * api_server path is kept permanently as a fallback, not a transitional
 * shim (see docs/engineering/user-account-isolation-plan.md Phase 6/7).
 */
function internalRpcBaseUrl(): string {
  const fromEnv = process.env.HERMES_INTERNAL_RPC_URL?.trim() || process.env.SHOULDI_HERMES_INTERNAL_RPC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'http://127.0.0.1:8643';
}

let probeCache: { at: number; live: boolean } | null = null;
let internalRpcProbeCache: { at: number; live: boolean } | null = null;
const PROBE_TTL_MS = 15_000;

/** GET /health on the internal RPC service (cached briefly). */
export async function probeInternalRpc(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && internalRpcProbeCache && now - internalRpcProbeCache.at < PROBE_TTL_MS) {
    return internalRpcProbeCache.live;
  }
  const url = `${internalRpcBaseUrl()}/health`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(4_000),
    });
    const live = res.ok;
    internalRpcProbeCache = { at: now, live };
    return live;
  } catch {
    internalRpcProbeCache = { at: now, live: false };
    return false;
  }
}

export function getHermesAgentStatus(): HermesAgentStatus {
  const resolved = resolveHermesRepoRoot();
  const key = hermesApiKey();
  return {
    repoPresent: !!resolved,
    repoRoot: resolved?.root ?? null,
    apiUrl: hermesApiBaseUrl(),
    apiLive: probeCache?.live ?? false,
    apiKeyConfigured: key.length > 0,
  };
}

/** GET /health on the Hermes api_server (cached briefly). */
export async function probeHermesApi(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && probeCache && now - probeCache.at < PROBE_TTL_MS) {
    return probeCache.live;
  }
  const url = `${hermesApiBaseUrl()}/health`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(4_000),
    });
    const live = res.ok;
    probeCache = { at: now, live };
    return live;
  } catch {
    probeCache = { at: now, live: false };
    return false;
  }
}

export async function isHermesAgentLive(): Promise<boolean> {
  return probeHermesApi();
}

export type HermesChatResult =
  | { ok: true; content: string }
  | { ok: false; reason: 'unreachable' | 'http_error' | 'empty' };

/**
 * POST /v1/turn on the internal per-turn RPC service. Returns null (never
 * throws) on any failure so the caller can transparently fall back to the
 * shared api_server path — this is the Phase 7 cutover point, and the
 * fallback is permanent, not just for the rollout window.
 */
async function internalRpcTurn(opts: {
  messages: HermesChatMessage[];
  sessionId?: string;
  sessionKey?: string;
}): Promise<HermesChatResult | null> {
  const url = `${internalRpcBaseUrl()}/v1/turn`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const key = hermesApiKey();
  if (key) headers.authorization = `Bearer ${key}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: opts.sessionKey,
        sessionId: opts.sessionId,
        messages: opts.messages,
      }),
      signal: AbortSignal.timeout(requestTimeoutMs()),
    });
  } catch {
    internalRpcProbeCache = { at: Date.now(), live: false };
    return null;
  }
  if (!res.ok) return null;

  let json: { content?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return null;
  }
  const content = json.content?.trim();
  return content ? { ok: true, content } : null;
}

/**
 * Non-streaming chat completion. Tries the internal per-user-HERMES_HOME RPC
 * service first (Phase 7) when it's live and a sessionKey (real userId) is
 * available to scope the home by; transparently falls back to the shared
 * api_server on any failure — see docs/engineering/user-account-isolation-plan.md.
 *
 * Uses X-Hermes-Session-Id when sessionId is set (requires API_SERVER_KEY on Hermes).
 * Uses X-Hermes-Session-Key when sessionKey is set — a stable per-ShouldI-user
 * identifier (their real userId) so Hermes-side memory providers (user_model)
 * can scope long-term memory per account instead of one shared identity.
 */
export async function hermesChatCompletion(opts: {
  messages: HermesChatMessage[];
  sessionId?: string;
  sessionKey?: string;
}): Promise<HermesChatResult> {
  if (opts.sessionKey?.trim() && (await probeInternalRpc())) {
    const internalResult = await internalRpcTurn(opts);
    if (internalResult) return internalResult;
    // Any internal-path failure (timeout, subprocess crash, malformed
    // response) falls through to the shared api_server path below.
  }

  const live = await probeHermesApi();
  if (!live) {
    return { ok: false, reason: 'unreachable' };
  }

  const url = `${hermesApiBaseUrl()}/v1/chat/completions`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  const key = hermesApiKey();
  if (key) {
    headers.authorization = `Bearer ${key}`;
  }
  if (opts.sessionId?.trim()) {
    headers['x-hermes-session-id'] = opts.sessionId.trim();
  }
  if (opts.sessionKey?.trim()) {
    headers['x-hermes-session-key'] = opts.sessionKey.trim();
  }

  const model = process.env.HERMES_API_MODEL?.trim() || 'hermes-agent';

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: opts.messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(requestTimeoutMs()),
    });
  } catch {
    probeCache = { at: Date.now(), live: false };
    return { ok: false, reason: 'unreachable' };
  }

  if (!res.ok) {
    return { ok: false, reason: 'http_error' };
  }

  let json: {
    choices?: { message?: { content?: string } }[];
  };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, reason: 'empty' };
  }

  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { ok: false, reason: 'empty' };
  }
  return { ok: true, content };
}

/**
 * Best-effort call to Hermes's POST /v1/user-model/seed — idempotently
 * creates the user_models row for a ShouldI userId at signup, so the
 * X-Hermes-Session-Key-scoped memory provider has something to look up
 * instead of silently no-op'ing on an unseeded user_id for the account's
 * entire lifetime. Never throws; callers should not await this to block
 * the signup response.
 */
export async function seedHermesUserModel(userId: string, profile: Record<string, unknown> = {}): Promise<void> {
  const live = await probeHermesApi();
  if (!live) return;

  const url = `${hermesApiBaseUrl()}/v1/user-model/seed`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const key = hermesApiKey();
  if (key) headers.authorization = `Bearer ${key}`;

  try {
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: userId, profile }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Best-effort — a failed seed just means memory personalization stays
    // off for this user until the next successful call; never block signup.
  }
}

/**
 * Best-effort call to the internal RPC service's POST /v1/provision —
 * creates /opt/data/users/<userId>/ at signup so it's already there by the
 * time the account's first conversation turn arrives (avoids a lazy-create
 * race on the first request). internal_rpc.py's /v1/turn also auto-provisions
 * on demand if this never ran, so a failure here is not user-visible.
 */
export async function provisionHermesUserHome(userId: string): Promise<void> {
  const live = await probeInternalRpc();
  if (!live) return;

  const url = `${internalRpcBaseUrl()}/v1/provision`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const key = hermesApiKey();
  if (key) headers.authorization = `Bearer ${key}`;

  try {
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Best-effort — /v1/turn provisions lazily on first use if this fails.
  }
}

export function sessionToHermesMessages(
  bubbles: { role: 'user' | 'assistant'; text: string }[],
): HermesChatMessage[] {
  return bubbles.map((b) => ({ role: b.role, content: b.text }));
}
