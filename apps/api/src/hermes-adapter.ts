/**
 * Boundary for Hermes integration — proxies /v1/chat to Hermes api_server when live.
 */

import { ChatRequestSchema, type ChatResponse } from '@shouldi/contracts';
import { randomUUID } from 'crypto';

import { hermesChatCompletion, isHermesAgentLive } from './hermes-client.js';
import {
  BRIEFING_SYSTEM_PROMPT,
  buildBriefingUserMessage,
  parseBriefingMarkdown,
} from './hermes-prompts.js';
import { resolveHermesRepoRoot } from './hermes-resolve.js';

const DISCLAIMER =
  'Informational guidance only—not legal, medical, investment, or other professional advice. Consult qualified professionals where needed.';

function stubBriefing(parsed: {
  category: string;
  title: string;
  constraints?: string;
  successCriteria?: string;
}): ChatResponse {
  const hermes = resolveHermesRepoRoot();
  const hermesStatus = hermes ? 'embedded' : 'stub';

  const bodyContext = [
    `Category: ${parsed.category}`,
    parsed.constraints?.trim() ? `Constraints:\n${parsed.constraints.trim()}` : '',
    parsed.successCriteria?.trim() ? `Success looks like:\n${parsed.successCriteria.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const hermesLine = hermes
    ? `Hermes checkout (${hermes.source}): ${hermes.root} — start \`hermes gateway\` with API_SERVER_ENABLED to reach the live agent.`
    : `Hermes tree not detected. Run git submodule update --init --recursive so hermes-agent-private/ contains run_agent.py, or set HERMES_ROOT.`;

  return {
    threadId: randomUUID(),
    sections: [
      {
        id: 'exec',
        title: 'Executive summary',
        body: [`${hermesLine}`, ``, `Your prompt:`, `“${parsed.title}”`, ``, bodyContext].join('\n'),
      },
      {
        id: 'tradeoffs',
        title: 'Likely trade-offs to verify',
        body: [
          `What you optimize for immediately (stress relief vs long-term trajectory).`,
          `Reversibility: can you unwind this choice in weeks, quarters, years?`,
          `Second-order effects on relationships or identity that won’t appear in spreadsheets.`,
        ].join('\n\n'),
      },
      {
        id: 'risk',
        title: 'Risks and blind spots',
        body: `Single-source advice (even high quality) misses your local constraints unless you cite numbers, deadlines, obligations, or values conflicts explicitly.`,
      },
      {
        id: 'next',
        title: 'Suggested next actions',
        body: `Write one-page decision memo answering: best case, worst case, cost to reverse, deadline, and whose input you’d trust at the end.`,
      },
    ],
    disclaimer: DISCLAIMER,
    hermesStatus,
  };
}

export async function summarizeRequest(
  input: unknown,
): Promise<{ ok: true; data: ChatResponse } | { ok: false }> {
  const parsed = ChatRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false };
  }

  const { category, title, constraints, successCriteria } = parsed.data;
  const live = await isHermesAgentLive();

  if (!live) {
    return { ok: true, data: stubBriefing(parsed.data) };
  }

  const userMessage = buildBriefingUserMessage({
    category,
    title,
    constraints,
    successCriteria,
  });

  const result = await hermesChatCompletion({
    messages: [
      { role: 'system', content: BRIEFING_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });

  if (!result.ok) {
    const fallback = stubBriefing(parsed.data);
    return { ok: true, data: { ...fallback, hermesStatus: 'error' } };
  }

  const sections = parseBriefingMarkdown(result.content);
  return {
    ok: true,
    data: {
      threadId: randomUUID(),
      sections,
      disclaimer: DISCLAIMER,
      hermesStatus: 'ready',
    },
  };
}
