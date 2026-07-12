import type {
  DecideInterviewBubble,
  DecideInterviewChoicePrompt,
  DecideInterviewExpert,
} from '@shouldi/contracts';

export function bubbleKey(b: DecideInterviewBubble) {
  return b.id;
}

const HARMENCE_INTRO_SHORT =
  "What's the decision you're wrestling with? I'll ask follow-ups until we reach a clear verdict.";

export function formatBubbleText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}

export function displayAssistantText(item: DecideInterviewBubble, allMessages: DecideInterviewBubble[]): string {
  const text = formatBubbleText(item.text);
  if (item.role !== 'assistant') return text;
  const firstAssistantIdx = allMessages.findIndex((m) => m.role === 'assistant');
  const itemIdx = allMessages.indexOf(item);
  if (
    itemIdx === firstAssistantIdx &&
    itemIdx >= 0 &&
    (text.includes("I'm Harmence") || text.length > 120)
  ) {
    return HARMENCE_INTRO_SHORT;
  }
  return text;
}

export function isMetaChoiceCopy(text: string): boolean {
  return /wants to check the highest-leverage unknown|before the council recommends/i.test(
    formatBubbleText(text),
  );
}

export function resolveQuestionHeadline(question: string, title?: string): string {
  const trimmed = formatBubbleText(question).trim();
  if (trimmed && !isMetaChoiceCopy(trimmed)) return trimmed;
  if (title?.trim()) {
    return `What best describes the ${title.trim().toLowerCase()}?`;
  }
  return 'Which of these fits your situation?';
}

export function choicePromptHeadline(prompt: DecideInterviewChoicePrompt): string {
  return resolveQuestionHeadline(prompt.question, prompt.title);
}

export function assistantBubbleBody(
  item: DecideInterviewBubble,
  allMessages: DecideInterviewBubble[],
  choicePrompt: DecideInterviewChoicePrompt | null,
  isActiveChoice: boolean,
): string {
  if (isActiveChoice && choicePrompt) {
    return choicePromptHeadline(choicePrompt);
  }
  if (item.question?.trim()) {
    return resolveQuestionHeadline(item.question, item.expertTitle);
  }
  const text = displayAssistantText(item, allMessages);
  if (isMetaChoiceCopy(text)) {
    return resolveQuestionHeadline(text, item.expertTitle);
  }
  const expertTitle = item.expertTitle?.trim();
  if (expertTitle && text.startsWith(`${expertTitle}:`)) {
    return text.slice(expertTitle.length + 1).trim();
  }
  return text;
}

export function expertCouncilSummary(verdicts: Array<{ verdictLine: string }>): string | null {
  if (verdicts.length === 0) return null;
  const yes = verdicts.filter((v) => /^yes\b/i.test(v.verdictLine.trim())).length;
  const no = verdicts.filter((v) => /^no\b/i.test(v.verdictLine.trim())).length;
  if (yes === 0 && no === 0) return `${verdicts.length} expert views`;
  return `${verdicts.length} experts · ${yes} yes, ${no} no`;
}

export function councilVoteTally(verdicts: Array<{ verdictLine: string }>) {
  const yes = verdicts.filter((v) => /^yes\b/i.test(v.verdictLine.trim())).length;
  const no = verdicts.filter((v) => /^no\b/i.test(v.verdictLine.trim())).length;
  return { yes, no, total: verdicts.length };
}

export function councilVoteStamp(line: string): 'YES' | 'NO' | 'MIX' {
  const normalized = line.trim().toLowerCase();
  if (normalized.startsWith('yes') || normalized.includes('lean yes')) return 'YES';
  if (normalized.startsWith('no') || normalized.includes('lean no')) return 'NO';
  return 'MIX';
}

export function mergeDeduped(messages: DecideInterviewBubble[], additions: DecideInterviewBubble[]) {
  const map = new Map<string, DecideInterviewBubble>();
  for (const m of messages) map.set(bubbleKey(m), m);
  for (const m of additions) map.set(bubbleKey(m), m);
  return Array.from(map.values()).sort((a, b) => a.at - b.at);
}

export type ExpertJoinRow = {
  id: string;
  expert: DecideInterviewExpert;
  at: number;
  contextText?: string;
};

export type DecideThreadItem =
  | { kind: 'message'; id: string; at: number; bubble: DecideInterviewBubble; messageIndex: number }
  | { kind: 'expert-join'; id: string; at: number; expert: DecideInterviewExpert; contextText?: string };

export function threadItemKey(item: DecideThreadItem): string {
  return item.id;
}

export function buildThreadItems(messages: DecideInterviewBubble[], expertJoinRows: ExpertJoinRow[]): DecideThreadItem[] {
  const rows: DecideThreadItem[] = messages.map((bubble, messageIndex) => ({
    kind: 'message',
    id: bubble.id,
    at: bubble.at,
    bubble,
    messageIndex,
  }));
  for (const join of expertJoinRows) {
    rows.push({
      kind: 'expert-join',
      id: join.id,
      at: join.at,
      expert: join.expert,
      contextText: join.contextText,
    });
  }
  rows.sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    if (a.kind === 'expert-join' && b.kind === 'message') return -1;
    if (a.kind === 'message' && b.kind === 'expert-join') return 1;
    return 0;
  });
  return rows;
}

export function joinAnchorAt(merged: DecideInterviewBubble[]): number {
  const lastUser = [...merged].filter((message) => message.role === 'user').at(-1);
  const newestAssistant = [...merged].filter((message) => message.role === 'assistant').at(-1);
  if (lastUser && newestAssistant && lastUser.at < newestAssistant.at) {
    const midpoint = lastUser.at + (newestAssistant.at - lastUser.at) / 2;
    return midpoint > lastUser.at ? midpoint : lastUser.at + 0.5;
  }
  if (lastUser) return lastUser.at + 0.5;
  return (newestAssistant?.at ?? Date.now()) - 0.5;
}

export function joinContextForExpert(
  _expert: DecideInterviewExpert,
  _choicePrompt: DecideInterviewChoicePrompt | null | undefined,
  triggerText?: string,
): string | undefined {
  const trimmed = triggerText?.trim();
  if (trimmed) return `Weighing in on “${trimmed}”`;
  return undefined;
}

export function appendExpertJoinRows(
  prev: ExpertJoinRow[],
  experts: DecideInterviewExpert[],
  anchorAt: number,
  contextByExpertId: Map<string, string | undefined>,
): ExpertJoinRow[] {
  const seen = new Set(prev.map((row) => row.expert.id));
  const additions = experts
    .filter((expert) => !seen.has(expert.id))
    .map((expert, idx) => ({
      id: `join-${expert.id}-${anchorAt}-${idx}`,
      expert,
      at: anchorAt - idx * 0.01,
      contextText: contextByExpertId.get(expert.id),
    }));
  return additions.length > 0 ? [...prev, ...additions] : prev;
}
