/**
 * Boundary for Hermes integration. Embedded repo resolves to the monorepo root folder
 * {@code hermes-agent-private/}; LLM/agent loop wiring still lands here behind a tightened tool
 * boundary for mobile gateways.
 */

import { ChatRequestSchema, type ChatResponse } from '@shouldi/contracts';
import { randomUUID } from 'crypto';

import { resolveHermesRepoRoot } from './hermes-resolve.js';

export function summarizeRequest(
  input: unknown,
): { ok: true; data: ChatResponse } | { ok: false } {
  const parsed = ChatRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false };
  }

  const { category, title, constraints, successCriteria } = parsed.data;

  const hermes = resolveHermesRepoRoot();
  const hermesStatus = hermes ? 'embedded' : 'stub';

  const bodyContext = [
    `Category: ${category}`,
    constraints?.trim() ? `Constraints:\n${constraints.trim()}` : '',
    successCriteria?.trim() ? `Success looks like:\n${successCriteria.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const hermesLine = hermes
    ? `Hermes checkout (${hermes.source}): ${hermes.root} — whole agent tree is in-repo; inference loop not executed in this MVP response.`
    : `Hermes tree not detected. Run git submodule update --init --recursive so hermes-agent-private/ contains run_agent.py, or set HERMES_ROOT.`;

  const data: ChatResponse = {
    threadId: randomUUID(),
    sections: [
      {
        id: 'exec',
        title: 'Executive summary',
        body: [
          hermesLine,
          ``,
          `Your prompt:`,
          `“${title}”`,
          ``,
          bodyContext,
        ].join('\n'),
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
    disclaimer:
      'Informational guidance only—not legal, medical, investment, or other professional advice. Consult qualified professionals where needed.',
    hermesStatus,
  };
  return { ok: true, data };
}
