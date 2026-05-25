/**
 * Harmence interview loop — conversational intake surfaced to Decide step 1.
 * Hermes linkage is signalling until a full inference loop ships server-side.
 */

import {
  DecideInterviewBubbleSchema,
  DecideInterviewDraftHintsSchema,
  DecideInterviewTurnResponseSchema,
  type DecideInterviewBubble,
  type DecideInterviewDraftHints,
  type DecideInterviewTurnResponse,
} from '@shouldi/contracts';
import { randomUUID } from 'crypto';

import { resolveHermesRepoRoot } from './hermes-resolve.js';

type Session = {
  id: string;
  bubbles: DecideInterviewBubble[];
  updatedAt: number;
};

const STORE = new Map<string, Session>();
const FOLLOWUPS = [
  {
    key: 'background',
    text: `Next — **your background**\nAnything that rewires how this choice lands: schooling, visa, dependents, geography, tenure, caretaking.`,
  },
  {
    key: 'risk_tolerance',
    text: `**Risk appetite**\nComfort with volatility / regret / reputational swings on a brutal 1→10.`,
  },
  {
    key: 'long_horizon',
    text: `**Long-term compass**\nWhat's the optimistic but believable storyline in ~3 years if you pick boldly?`,
  },
  {
    key: 'emotional_state',
    text: `**Emotional runway**\nStress, burnout, grief, jealousy, pride — what's loud in your body right now?`,
  },
  {
    key: 'financial_lens',
    text: `**Financial reality**\nRunway months, runway partners, sunk costs… numbers + vibes both ok.`,
  },
  {
    key: 'constraints',
    text: `**Hard rails**\nDates, bosses, visas, dependents, optics — what legally/morally/psychologically cannot bend?`,
  },
  {
    key: 'hidden_factors',
    text: `**Hidden levers**\nPolitics at work, undisclosed stakes, vibes you won't post online — spill safely.`,
  },
] as const;

const OPEN_GREETING =
  `I'm **Harmence** — tethered to the Hermes toolchain on ShouldI Gateway.\n` +
  `I'll keep probing until we've mapped:\n\n` +
  `• Background\n• Risk stance\n• Long-term aim\n• Emotional load\n• Financial picture\n• Hard constraints\n• Hidden factors\n\n` +
  `Drop the dilemma in **one chunky sentence**. Messy verbs welcome.`;

const WRAP_TAIL =
  `\n\n---\nIf this tracks, slide to **review** and I'll sync the draft chips. Ping me anytime to reopen this thread → Harmence remembers this session via gateway.`;

const WRAP_LEAD = `That's plenty for now — distilled what I heard.`;

function bubble(role: DecideInterviewBubble['role'], text: string): DecideInterviewBubble {
  return DecideInterviewBubbleSchema.parse({
    id: `${role}-${randomUUID()}`,
    role,
    text,
    at: Date.now(),
  });
}

function userLines(session: Session): string[] {
  return session.bubbles.filter((m) => m.role === 'user').map((m) => m.text.trim()).filter(Boolean);
}

function summarizeDraft(users: string[]): DecideInterviewDraftHints {
  const title = users[0] ?? '(untitled tension)';
  const body = users.slice(1).join('\n\n');
  return DecideInterviewDraftHintsSchema.parse({
    title,
    constraints: body.length > 0 ? body : undefined,
    successCriteria: undefined,
    category: inferCategory(users.join('\n')),
  });
}

function inferCategory(blob: string): DecideInterviewDraftHints['category'] {
  const t = blob.toLowerCase();
  if (t.includes('money') || t.includes('finance') || t.includes('loan') || t.includes('budget')) return 'money';
  if (
    t.includes('partner') ||
    t.includes('relationship') ||
    t.includes('marriage') ||
    t.includes('breakup')
  )
    return 'relationship';
  if (t.includes('job') || t.includes('offer') || t.includes('salary') || t.includes('career')) return 'career';
  return 'life';
}

export function listInterviewSessions(limit = 60): Session[] {
  return Array.from(STORE.values())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function getInterviewSession(id: string): Session | null {
  return STORE.get(id) ?? null;
}

export function summarizeSessionsForMobile(): {
  sessions: { id: string; preview: string; updatedAt: number; messageCount: number }[];
} {
  return {
    sessions: listInterviewSessions().map((s) => ({
      id: s.id,
      preview: pickPreview(s.bubbles),
      updatedAt: s.updatedAt,
      messageCount: s.bubbles.length,
    })),
  };
}

export function summarizeSessionDetail(id: string): {
  id: string;
  updatedAt: number;
  bubbles: DecideInterviewBubble[];
  phase: string;
  isComplete: boolean;
  hermesIntegrated: boolean;
} | null {
  const session = STORE.get(id);
  if (!session) return null;
  const users = userLines(session);
  const hermesIntegrated = !!resolveHermesRepoRoot();

  let phase = 'opening';
  let isComplete = false;
  if (users.length === 0) {
    phase = 'opening';
  } else if (users.length <= FOLLOWUPS.length) {
    phase = FOLLOWUPS[users.length - 1]!.key;
  } else {
    phase = 'complete';
    isComplete = session.bubbles.some(
      (b) =>
        b.role === 'assistant' &&
        (b.text.includes(`That's plenty for now`) || b.text.includes('distilled what I heard')),
    );
  }

  return {
    id: session.id,
    updatedAt: session.updatedAt,
    bubbles: [...session.bubbles],
    phase,
    isComplete,
    hermesIntegrated,
  };
}

function pickPreview(messages: DecideInterviewBubble[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'fresh Harmence intake';
  return firstUser.text.slice(0, 120).replace(/\s+/g, ' ');
}

/** Drive one conversational turn (+ optional bootstrap with empty body). */
export function handleInterviewTurn(
  sessionId: string | undefined | null,
  userTextRaw: string,
): DecideInterviewTurnResponse {
  const hermesIntegrated = !!resolveHermesRepoRoot();
  let session: Session | null = sessionId ? (STORE.get(sessionId) ?? null) : null;
  let created = false;
  const userText = (userTextRaw ?? '').trim();

  if (!session) {
    if (sessionId) {
      throw new Error('UNKNOWN_SESSION');
    }
    session = {
      id: randomUUID(),
      bubbles: [],
      updatedAt: Date.now(),
    };
    STORE.set(session.id, session);
    session.bubbles.push(bubble('assistant', OPEN_GREETING));
    created = true;
  }

  session.updatedAt = Date.now();

  if (created && !userText) {
    const lastBubble = session.bubbles[session.bubbles.length - 1]!;
    return DecideInterviewTurnResponseSchema.parse({
      sessionId: session.id,
      bubbles: [lastBubble],
      phase: 'opening',
      isComplete: false,
      hermesIntegrated,
      suggestedDraftHints: undefined,
    });
  }

  if (!created && sessionId && !userText && session.bubbles.length > 0) {
    const last =
      [...session.bubbles].filter((m) => m.role === 'assistant').at(-1) ?? session.bubbles.at(-1)!;
    const u = userLines(session);
    const phaseGuess =
      u.length === 0
        ? 'opening'
        : u.length <= FOLLOWUPS.length
          ? FOLLOWUPS[u.length - 1]!.key
          : 'complete';
    return DecideInterviewTurnResponseSchema.parse({
      sessionId: session.id,
      bubbles: [last],
      phase: phaseGuess,
      isComplete: session.bubbles.some((b) => b.role === 'assistant' && b.text.includes('distilled')),
      hermesIntegrated,
      suggestedDraftHints: undefined,
    });
  }

  if (!userText) {
    const last = session.bubbles.at(-1)!;
    return DecideInterviewTurnResponseSchema.parse({
      sessionId: session.id,
      bubbles: [last],
      phase: 'awaiting_voice',
      isComplete: false,
      hermesIntegrated,
      suggestedDraftHints: undefined,
    });
  }

  session.bubbles.push(bubble('user', userText));

  const answers = userLines(session);
  const depth = answers.length;

  if (depth <= FOLLOWUPS.length) {
    const idx = depth - 1;
    const next = FOLLOWUPS[idx]!;
    const tail = hermesIntegrated
      ? `\n_(Hermes repo plumbed — inference path still Gateway stub)_`
      : `\n_(Add hermes-agent-private to unlock the fuller agent harness)_`;
    session.bubbles.push(bubble('assistant', `${next.text}${tail}`));
    return DecideInterviewTurnResponseSchema.parse({
      sessionId: session.id,
      bubbles: session.bubbles.slice(-2),
      phase: next.key,
      isComplete: false,
      hermesIntegrated,
      suggestedDraftHints: undefined,
    });
  }

  const hints = summarizeDraft(answers);
  const recap = [
    WRAP_LEAD,
    `• Decision spine: ${hints.title}`,
    hints.category ? `• Category heuristic: ${hints.category}` : '',
    hints.constraints ? `• Notes:\n${hints.constraints.slice(0, 1200)}` : '',
    WRAP_TAIL,
  ]
    .filter(Boolean)
    .join('\n\n');

  session.bubbles.push(bubble('assistant', recap));

  return DecideInterviewTurnResponseSchema.parse({
    sessionId: session.id,
    bubbles: session.bubbles.slice(-2),
    phase: 'complete',
    isComplete: true,
    hermesIntegrated,
    suggestedDraftHints: hints,
  });
}
