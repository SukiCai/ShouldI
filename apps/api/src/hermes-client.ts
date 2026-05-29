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

let probeCache: { at: number; live: boolean } | null = null;
const PROBE_TTL_MS = 15_000;

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
 * Non-streaming chat completion against Hermes api_server.
 * Uses X-Hermes-Session-Id when sessionId is set (requires API_SERVER_KEY on Hermes).
 */
export async function hermesChatCompletion(opts: {
  messages: HermesChatMessage[];
  sessionId?: string;
}): Promise<HermesChatResult> {
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

export function sessionToHermesMessages(
  bubbles: { role: 'user' | 'assistant'; text: string }[],
): HermesChatMessage[] {
  return bubbles.map((b) => ({ role: b.role, content: b.text }));
}
