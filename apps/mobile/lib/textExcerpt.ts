const DEFAULT_EXCERPT_LENGTH = 60;
const KEY_MOMENT_EXCERPT_LENGTH = 90;

/**
 * Truncates verbatim user text to a tag-sized excerpt, cutting at the last
 * word boundary before the limit rather than mid-word.
 */
export function excerptVerbatim(text: string, maxLength: number = DEFAULT_EXCERPT_LENGTH): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) return trimmed;

  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const boundary = lastSpace > maxLength * 0.6 ? lastSpace : maxLength;
  return `${cut.slice(0, boundary).trim()}…`;
}

/**
 * Builds a self-contained key-moment excerpt from the verbatim question +
 * answer pair — no AI rewrite, no interpretation, just enough of the
 * original question attached so the answer isn't ambiguous on its own
 * (e.g. "两者都很重要" reads fine once "跳槽机会 vs 感情稳定，哪个更重要" is attached).
 */
export function objectiveKeyMomentExcerpt(
  moment: { question?: string; answer?: string },
  maxLength: number = KEY_MOMENT_EXCERPT_LENGTH,
): string {
  const question = (moment.question ?? '').trim().replace(/[?？]+$/, '');
  const answer = (moment.answer ?? '').trim();
  if (!answer) return '';
  const combined = question ? `${question}：${answer}` : answer;
  return excerptVerbatim(combined, maxLength);
}

const TAG_EXCERPT_LENGTH = 70;

/**
 * Tag-sized text for a key moment. Prefers the model's `impact` field — now
 * scoped (see hermes-prompts.ts) to an objective, fact-only restatement that
 * preserves the user's own wording rather than an interpretive headline —
 * and falls back to the zero-AI question+answer template when `impact` is
 * missing (older records, or a synthesis call that dropped the field).
 */
export function keyMomentTagText(
  moment: { impact?: string; question?: string; answer?: string },
  maxLength: number = TAG_EXCERPT_LENGTH,
): string {
  const impact = (moment.impact ?? '').trim();
  if (impact) return excerptVerbatim(impact, maxLength);
  return objectiveKeyMomentExcerpt(moment, maxLength);
}
