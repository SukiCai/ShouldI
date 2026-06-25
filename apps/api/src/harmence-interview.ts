/**
 * Harmence interview loop — Decide step 1 chat.
 * Uses Hermes api_server when live; falls back to scripted probes otherwise.
 */

import {
  DecideInterviewBubbleSchema,
  DecideInterviewChoicePromptSchema,
  DecideInterviewDraftHintsSchema,
  DecideInterviewFinalDecisionSchema,
  DecideInterviewPreviewCardSchema,
  DecideInterviewTurnResponseSchema,
  type DecideInterviewBubble,
  type DecideInterviewChoiceOption,
  type DecideInterviewChoicePrompt,
  type DecideInterviewDraftHints,
  type DecideInterviewExpert,
  type DecideInterviewFinalDecision,
  type DecideInterviewPreviewCard,
  type DecideInterviewTurnResponse,
} from '@shouldi/contracts';
import { randomUUID } from 'crypto';

import {
  expertById,
  expertBySkillName,
  expertPrelude,
  mergeExpertIds,
  publicExpert,
  publicExperts,
  selectExpertsFromText,
  type HarmenceExpert,
} from './harmence-experts.js';
import {
  hermesChatCompletion,
  isHermesAgentLive,
} from './hermes-client.js';
import {
  CHALLENGE_MODE_INSTRUCTIONS,
  HARMENCE_CHOICE_SYSTEM_PROMPT,
  HARMENCE_EXPERT_FINAL_PROMPT,
  HARMENCE_EXPERT_INDIVIDUAL_FINAL_PROMPT,
  HARMENCE_EXPERT_ROUTER_PROMPT,
  HARMENCE_FINAL_SYSTEM_PROMPT,
  HARMENCE_SMART_TALK_DRIVER_PROMPT,
  HARMENCE_SMART_TALK_SYNTHESIS_PROMPT,
} from './hermes-prompts.js';

type OfferContext = {
  company: string;
  durationLabel: string;
  durationDisplay: string;
  offerPhrase: string;
  rawQuestion: string;
};

type MomentEntry = {
  round: number;
  promptId: string;
  question: string;
  answer: string;
  ambiguityBefore: number;
  ambiguityAfter: number;
  delta: number;
  dimensionMoved: string;
  scoreDelta: { intent: number; reality: number; signal: number; stakes: number };
  expertsJoined: string[];
};

type SmartTalkState = {
  rounds: number;
  scores: { intent: number; reality: number; signal: number; stakes: number };
  ambiguity: number;
  dimensionDepths: { intent: number; reality: number; signal: number; stakes: number };
  challengeModesUsed: ('contrarian' | 'simplifier' | 'reframer')[];
  domainSkillsInvoked: string[];
  momentumLog: MomentEntry[];
};

function defaultSmartTalkState(): SmartTalkState {
  return {
    rounds: 0,
    scores: { intent: 0, reality: 0, signal: 0, stakes: 0 },
    ambiguity: 1.0,
    dimensionDepths: { intent: 0, reality: 0, signal: 0, stakes: 0 },
    challengeModesUsed: [],
    domainSkillsInvoked: [],
    momentumLog: [],
  };
}

function computeAmbiguity(scores: SmartTalkState['scores']): number {
  const weighted = scores.intent * 0.35 + scores.reality * 0.25 + scores.signal * 0.25 + scores.stakes * 0.15;
  return Math.min(1, Math.max(0, 1 - weighted));
}

function buildChallengeInstruction(state: SmartTalkState): 'contrarian' | 'simplifier' | 'reframer' | '' {
  const { rounds, challengeModesUsed, ambiguity } = state;
  if (rounds >= 8 && ambiguity > 0.30 && !challengeModesUsed.includes('reframer')) return 'reframer';
  if (rounds >= 6 && !challengeModesUsed.includes('simplifier')) return 'simplifier';
  if (rounds >= 4 && !challengeModesUsed.includes('contrarian')) return 'contrarian';
  return '';
}

type Session = {
  id: string;
  bubbles: DecideInterviewBubble[];
  answers: InterviewAnswer[];
  playbookId?: string;
  activeExpertIds: string[];
  offerContext?: OfferContext;
  lastPrompt?: DecideInterviewChoicePrompt;
  isComplete: boolean;
  finalDecision?: DecideInterviewFinalDecision;
  updatedAt: number;
  mode: 'single' | 'complex';
  smartTalkState: SmartTalkState;
};

type InterviewAnswer = {
  promptId: string;
  question: string;
  optionId: string;
  label: string;
  description?: string;
};

type VerdictPolicy = 'binary' | 'comparative' | 'wait_allowed';

type RiskFlag = {
  id: string;
  label: string;
  when: (answers: Map<string, InterviewAnswer>) => boolean;
};

type ChoicePromptTemplate = {
  id: string;
  title: string;
  question: string;
  helperText?: string;
  specialistLabel?: string;
  speakerExpertId?: string;
  supportingExpertIds?: readonly string[];
  whyItMatters?: string;
  progress?: DecideInterviewChoicePrompt['progress'];
  options: readonly DecideInterviewChoiceOption[];
  allowCustomAnswer?: boolean;
};

type DecisionPlaybook = {
  id: string;
  specialistLabel: string;
  category: NonNullable<DecideInterviewDraftHints['category']>;
  triggerPatterns: RegExp[];
  requiredSlots: readonly ChoicePromptTemplate[];
  riskFlags: RiskFlag[];
  verdictPolicy: VerdictPolicy;
  progressLabel: string;
  openingLine: string;
  transitions: Partial<Record<string, string>>;
};

const STORE = new Map<string, Session>();

const CHOICE_STEPS = [
  {
    id: 'real_question',
    title: 'Core dilemma',
    question: 'What kind of answer would help most with this decision?',
    helperText: 'Harmence inferred the topic from your question; this narrows the decision shape.',
    options: [
      { id: 'choose_between_two', label: 'Choose between two paths', description: 'A vs B, both plausible.' },
      { id: 'go_or_no_go', label: 'Go / no-go', description: 'Whether to commit, leave, buy, move, publish.' },
      { id: 'timing', label: 'Timing call', description: 'Do it now, wait, or sequence it differently.' },
      { id: 'boundary', label: 'Boundary or tradeoff', description: 'What to protect, say no to, or negotiate.' },
    ],
    allowCustomAnswer: true,
  },
  {
    id: 'stakes',
    title: 'Stakes',
    question: 'What feels most at stake if you get this wrong?',
    options: [
      { id: 'future_self', label: 'Future-self regret', description: 'Losing momentum, identity, or a rare window.' },
      { id: 'stability', label: 'Stability', description: 'Money, housing, visa, job security, health.' },
      { id: 'relationships', label: 'People impact', description: 'Trust, care obligations, social fallout.' },
      { id: 'reputation', label: 'Reputation', description: 'How others judge your competence or values.' },
    ],
    allowCustomAnswer: true,
  },
  {
    id: 'risk_appetite',
    title: 'Risk stance',
    question: 'How much uncertainty can you honestly tolerate here?',
    options: [
      { id: 'low', label: 'Low', description: 'I need a stable, reversible path.' },
      { id: 'medium', label: 'Medium', description: 'I can handle some wobble if the upside is clear.' },
      { id: 'high', label: 'High', description: 'I can take a swing and absorb fallout.' },
      { id: 'unknown', label: 'Not sure', description: 'My tolerance changes depending on the detail.' },
    ],
    allowCustomAnswer: true,
  },
  {
    id: 'constraint',
    title: 'Hard constraint',
    question: 'Which constraint should Harmence treat as least bendable?',
    options: [
      { id: 'money', label: 'Money / runway', description: 'Budget, debt, income, savings, opportunity cost.' },
      { id: 'time', label: 'Time / deadline', description: 'A deadline, season, contract, school or visa clock.' },
      { id: 'people', label: 'People obligations', description: 'Partner, family, team, care, promises.' },
      { id: 'values', label: 'Values / identity', description: 'What you refuse to betray even if it costs you.' },
    ],
    allowCustomAnswer: true,
  },
  {
    id: 'decision_style',
    title: 'Decision style',
    question: 'What kind of final answer would be most useful?',
    options: [
      { id: 'direct', label: 'A direct recommendation', description: 'Tell me what you would do and why.' },
      { id: 'conditions', label: 'Conditional verdict', description: 'Tell me what must be true for each path.' },
      { id: 'risk_map', label: 'Risk map', description: 'Show the downside and mitigation plan.' },
      { id: 'community_test', label: 'Community test', description: 'Frame it for people with lived experience.' },
    ],
    allowCustomAnswer: true,
  },
] as const;

const CAREER_COOP_STEPS = [
  {
    id: 'coop_program_stage',
    title: 'School and co-op stage',
    question: 'Where are you in your program right now?',
    helperText: 'For a co-op offer, Harmence needs your academic stage before judging upside or risk.',
    options: [
      { id: 'undergrad_first_coop', label: 'Undergrad, first co-op', description: 'This would be your first formal placement.' },
      { id: 'undergrad_repeat_coop', label: 'Undergrad, not first co-op', description: 'You already have co-op/internship experience.' },
      { id: 'masters', label: 'Master\'s student', description: 'This fits into a graduate program timeline.' },
      { id: 'phd_or_research', label: 'PhD / research track', description: 'Research direction and advisor expectations may matter.' },
      { id: 'other_stage', label: 'Other / mixed', description: 'Bootcamp, new grad, gap term, transfer, or unusual path.' },
    ],
    allowCustomAnswer: true,
  },
  {
    id: 'coop_work_authorization',
    title: 'Work authorization',
    question: 'What is your work authorization situation for this co-op?',
    helperText: 'Immigration and eligibility constraints can dominate a {durationCoop} decision.',
    options: [
      { id: 'citizen_pr', label: 'Citizen or PR', description: 'No major work-permit constraint for this role.' },
      { id: 'study_permit_coop', label: 'Study permit + co-op permit', description: 'The offer must fit school and permit rules.' },
      { id: 'need_sponsorship', label: 'Need sponsorship / unsure', description: 'Visa timing or employer support may be a risk.' },
      { id: 'not_comfortable', label: 'Prefer not to say', description: 'Use a privacy-safe constraint instead.' },
    ],
    allowCustomAnswer: true,
  },
  {
    id: 'coop_offer_quality',
    title: 'Offer quality',
    question: 'What is strongest about the {offer}?',
    options: [
      { id: 'brand_signal', label: 'Brand / resume signal', description: 'A recognizable company could help future recruiting.' },
      { id: 'technical_growth', label: 'Technical growth', description: 'Team, stack, mentorship, and project depth look strong.' },
      { id: 'pay_stability', label: 'Pay / stability', description: 'Compensation or financial stability matters most.' },
      { id: 'only_offer', label: 'It is my only offer', description: 'The alternative may be continuing the search.' },
      { id: 'unclear_quality', label: 'Not sure yet', description: 'Need to inspect team, role, manager, or project.' },
    ],
    allowCustomAnswer: true,
  },
  {
    id: 'coop_offer_risk',
    title: 'Main risk',
    question: 'What worries you most about accepting this offer?',
    options: [
      { id: 'too_long', label: 'Term feels too long', description: 'It may crowd out school, other internships, or recruiting cycles.' },
      { id: 'company_reputation', label: 'Company reputation', description: 'You worry how {company} is perceived by future employers.' },
      { id: 'role_mismatch', label: 'Role or team mismatch', description: 'The work may not build the skills you want.' },
      { id: 'immigration_school', label: 'School or permit constraints', description: 'Eligibility, timing, or graduation may be affected.' },
      { id: 'personal_cost', label: 'Personal cost', description: 'Location, stress, family, housing, or mental health.' },
    ],
    allowCustomAnswer: true,
  },
  {
    id: 'coop_alternatives',
    title: 'Alternatives',
    question: 'What is your realistic alternative if you do not take it?',
    options: [
      { id: 'strong_other_offer', label: 'Another strong offer', description: 'You can compare concrete paths.' },
      { id: 'keep_recruiting', label: 'Keep recruiting', description: 'You have time and a plausible pipeline.' },
      { id: 'school_research', label: 'School / research / project', description: 'You would invest in coursework, lab work, or portfolio.' },
      { id: 'no_clear_backup', label: 'No clear backup', description: 'Rejecting means meaningful uncertainty.' },
    ],
    allowCustomAnswer: true,
  },
  {
    id: 'coop_decision_threshold',
    title: 'Decision threshold',
    question: 'What would make this a clear yes?',
    options: [
      { id: 'good_team_project', label: 'Strong team and project', description: 'The work is aligned enough to justify the commitment.' },
      { id: 'future_doors', label: 'Opens future doors', description: 'It improves future co-op, full-time, or grad opportunities.' },
      { id: 'safe_and_eligible', label: 'School/permit fit is safe', description: 'The administrative risk is low.' },
      { id: 'better_than_backup', label: 'Clearly beats my backup', description: 'It is better than the realistic alternative.' },
    ],
    allowCustomAnswer: true,
  },
] as const;

const CAREER_COOP_BRANCH_STEPS = {
  coop_permit_plan: {
    id: 'coop_permit_plan',
    title: 'Eligibility proof',
    question: 'What proof do you already have that this {durationCoop} is eligible?',
    helperText: 'If eligibility is unclear, the recommendation should slow down even when the offer looks strong.',
    options: [
      { id: 'school_confirmed', label: 'School confirmed in writing', description: 'The co-op office says this term and employer fit.' },
      { id: 'employer_confirmed', label: 'Employer says it is fine', description: 'The company has handled this status before.' },
      { id: 'only_assuming', label: 'I am assuming it works', description: 'No written confirmation yet.' },
      { id: 'looks_risky', label: 'It may not be eligible', description: 'Timing, length, employer, or status may be a problem.' },
    ],
    allowCustomAnswer: true,
  },
  coop_role_details: {
    id: 'coop_role_details',
    title: 'Actual work',
    question: 'How clear is the actual team, project, and mentorship at {company}?',
    helperText: 'A strong co-op is mostly the work you do and who supervises it, not the offer letter.',
    options: [
      { id: 'clear_strong', label: 'Clear and strong', description: 'Team, stack, manager, and project look aligned.' },
      { id: 'clear_but_mixed', label: 'Clear but mixed', description: 'Some useful work, some risk of low-signal tasks.' },
      { id: 'unclear', label: 'Still unclear', description: 'I do not know the team/project/manager yet.' },
      { id: 'weak_fit', label: 'Likely weak fit', description: 'The role may not build my target skills.' },
    ],
    allowCustomAnswer: true,
  },
  coop_recruiting_window: {
    id: 'coop_recruiting_window',
    title: 'Opportunity cost',
    question: 'What would this {durationCoop} block or delay?',
    helperText: 'Longer placements can be worth it, but only if they do not close better recruiting or school windows.',
    options: [
      { id: 'nothing_major', label: 'Nothing major', description: 'It fits my school and recruiting calendar.' },
      { id: 'next_recruiting_cycle', label: 'A recruiting cycle', description: 'It could block other internships or full-time recruiting.' },
      { id: 'graduation_or_courses', label: 'Graduation / courses', description: 'It may delay school progress.' },
      { id: 'personal_constraints', label: 'Personal constraints', description: 'Location, housing, family, or health costs are significant.' },
    ],
    allowCustomAnswer: true,
  },
  coop_reputation_context: {
    id: 'coop_reputation_context',
    title: 'Future audience',
    question: 'Who are you most worried will judge the {company} signal?',
    helperText: 'Reputation risk depends on the future employers, countries, and roles you want next.',
    options: [
      { id: 'big_tech', label: 'Big tech recruiters', description: 'I want another major tech company later.' },
      { id: 'government_sensitive', label: 'Government / sensitive work', description: 'Security, policy, defense, or regulated paths may matter.' },
      { id: 'local_market', label: 'Local employers', description: 'I mainly care how nearby employers view it.' },
      { id: 'not_worried', label: 'Not very worried', description: 'I think the signal is mostly positive or neutral.' },
    ],
    allowCustomAnswer: true,
  },
} as const;

const CAREER_COOP_PLAYBOOK: DecisionPlaybook = {
  id: 'career.coop_offer',
  specialistLabel: 'Career Co-op Specialist',
  category: 'career',
  triggerPatterns: [/\bco-?op\b/i, /\bintern(ship)?\b/i, /\bplacement\b/i],
  requiredSlots: CAREER_COOP_STEPS,
  riskFlags: [
    {
      id: 'work_authorization_unclear',
      label: 'work authorization or school eligibility is not clearly safe',
      when: (answers) => {
        const authorization = answers.get('coop_work_authorization')?.label.toLowerCase() ?? '';
        return authorization.includes('unsure') || authorization.includes('sponsorship');
      },
    },
    {
      id: 'company_reputation_sensitive',
      label: 'company reputation or geopolitics may affect future recruiting',
      when: (answers) => {
        const risk = answers.get('coop_offer_risk')?.label.toLowerCase() ?? '';
        return risk.includes('reputation') || risk.includes('geopolitics');
      },
    },
  ],
  verdictPolicy: 'binary',
  progressLabel: 'professional checks',
  openingLine: 'I loaded a Career Co-op Specialist. First I need the context most students forget to mention.',
  transitions: {
    coop_program_stage: 'I loaded a Career Co-op Specialist. First I need the context most students forget to mention.',
    coop_work_authorization: 'Important detail. Now I need to check the constraint that can override the whole offer.',
    coop_offer_quality: "Good, now let's separate the {company} brand signal from the actual career value.",
    coop_offer_risk: 'That helps. Now let’s name the risk that could make a yes become a no.',
    coop_permit_plan: 'That answer changes the risk profile. I need proof, not vibes, on eligibility.',
    coop_role_details: 'Now I need to know whether the offer is a real growth role or just a logo.',
    coop_recruiting_window: 'Let’s check the opportunity cost before treating this as a clean yes.',
    coop_reputation_context: 'Reputation risk depends on who you need to impress next.',
    coop_alternatives: 'Useful. The recommendation depends on what saying no realistically costs you.',
    coop_decision_threshold: 'Last professional check: define what would make this clearly worth accepting.',
  },
};

const COOP_WHY_IT_MATTERS: Record<string, string> = {
  coop_program_stage:
    'First co-op, later co-op, and graduate-level experience carry very different resume signal and opportunity cost.',
  coop_work_authorization:
    'A {durationCoop} is only a good option if your school and work authorization can safely support the full window.',
  coop_offer_quality:
    'The brand name matters less than whether the team, project, and learning curve open better future doors.',
  coop_offer_risk:
    'The best decision depends on the risk that could still hurt you after the offer looks attractive on paper.',
  coop_permit_plan:
    'Written confirmation can turn a risky offer into a safe one; assumptions are not enough for permit-sensitive decisions.',
  coop_role_details:
    'The same company can produce very different outcomes depending on team, manager, project, and mentorship.',
  coop_recruiting_window:
    'The real cost is not only time in the role; it is what school or recruiting options you give up.',
  coop_reputation_context:
    'A company signal is judged by a future audience, so the next audience matters more than generic prestige.',
  coop_alternatives:
    'A yes/no answer changes if your backup is a strong pipeline versus real uncertainty.',
  coop_decision_threshold:
    'A clear threshold prevents the decision from becoming just fear, status, or sunk-cost pressure.',
};

const OPEN_GREETING =
  `I'm **Harmence**. Ask your decision in your own words first — I'll infer the topic, pick the right decision lens, then ask only the follow-ups needed for a final recommendation and community-safe preview card.`;

const KNOWN_COMPANIES = [
  'amazon',
  'google',
  'meta',
  'microsoft',
  'apple',
  'huawei',
  'netflix',
  'tesla',
  'shopify',
  'stripe',
  'uber',
  'airbnb',
  'salesforce',
  'oracle',
  'ibm',
  'intel',
  'nvidia',
  'openai',
  'anthropic',
  'bytedance',
  'tiktok',
  'spotify',
  'adobe',
  'linkedin',
  'twitter',
  'x',
  'samsung',
  'qualcomm',
  'amd',
  'coinbase',
  'robinhood',
  'deloitte',
  'kpmg',
  'pwc',
  'ey',
  'accenture',
] as const;

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function extractOfferContext(question: string): OfferContext {
  const trimmed = question.trim();
  const lower = trimmed.toLowerCase();

  let durationLabel = 'this';
  let durationDisplay = '';
  const durationMatch = lower.match(/\b(\d+)\s*[- ]?\s*months?\b/);
  if (durationMatch) {
    durationLabel = `${durationMatch[1]}-month`;
    durationDisplay = `${durationMatch[1]} months`;
  }

  let company = 'this company';
  for (const name of KNOWN_COMPANIES) {
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)) {
      company = titleCaseWords(name);
      break;
    }
  }

  if (company === 'this company') {
    const afterVerb = trimmed.match(
      /\b(?:take|accept|at|from|with|join)\s+([a-z][a-z0-9&.-]*(?:\s+[a-z][a-z0-9&.-]*)?)\b/i,
    );
    const candidate = afterVerb?.[1]?.trim();
    if (candidate && !/^(the|a|an|my|this|that|it|one)$/i.test(candidate)) {
      company = titleCaseWords(candidate.split(/\s+/).slice(0, 2).join(' '));
    }
  }

  const offerPhrase =
    durationLabel !== 'this' ? `${company} ${durationLabel} co-op offer` : `${company} co-op offer`;

  return {
    company,
    durationLabel,
    durationDisplay,
    offerPhrase,
    rawQuestion: trimmed,
  };
}

function applyOfferTemplate(text: string, ctx: OfferContext): string {
  const durationCoop = ctx.durationLabel === 'this' ? 'co-op' : `${ctx.durationLabel} co-op`;
  const durationTerm = ctx.durationDisplay || 'the placement length';
  return text
    .replace(/\{company\}/g, ctx.company)
    .replace(/\{offer\}/g, ctx.offerPhrase)
    .replace(/\{durationCoop\}/g, durationCoop)
    .replace(/\{durationTerm\}/g, durationTerm)
    .replace(/\{duration\}/g, ctx.durationLabel === 'this' ? '' : ctx.durationLabel)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function offerContextFor(session: Session): OfferContext {
  if (session.offerContext) return session.offerContext;
  return extractOfferContext(initialQuestionFor(session) || 'this co-op offer');
}

function contextualizeCoopStep(step: ChoicePromptTemplate, ctx: OfferContext): DecideInterviewChoicePrompt {
  const template = (value: string) => applyOfferTemplate(value, ctx);
  return DecideInterviewChoicePromptSchema.parse({
    ...step,
    question: template(step.question),
    helperText: step.helperText ? template(step.helperText) : undefined,
    options: step.options.map((option) => ({
      ...option,
      label: template(option.label),
      description: option.description ? template(option.description) : undefined,
    })),
  });
}

function bubble(
  role: DecideInterviewBubble['role'],
  text: string,
  meta: Partial<Pick<DecideInterviewBubble, 'expertId' | 'expertTitle' | 'expertIcon' | 'expertColor' | 'supportingExpertIds'>> = {},
): DecideInterviewBubble {
  return DecideInterviewBubbleSchema.parse({
    id: `${role}-${randomUUID()}`,
    role,
    text,
    at: Date.now(),
    ...meta,
  });
}

function answerLines(session: Session): string[] {
  return session.answers.map((a) => `${a.question}: ${a.label}${a.description ? ` (${a.description})` : ''}`);
}

function summarizeDraft(session: Session, previewCard?: DecideInterviewPreviewCard): DecideInterviewDraftHints {
  const answers = answerLines(session);
  const first = session.answers[1]?.label ?? session.answers[0]?.label ?? '(untitled tension)';
  const title = previewCard?.question ?? first;
  const body = answers.join('\n');
  return DecideInterviewDraftHintsSchema.parse({
    title,
    constraints: body.length > 0 ? body : undefined,
    successCriteria: undefined,
    category: previewCard?.category ?? inferCategory(answers.join('\n')),
    communityChallengeQuestion: previewCard?.question,
    communityAiVerdictLine: previewCard?.aiVerdictLine,
    communityAiBecause: previewCard?.aiBecause,
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

async function hermesIntegratedFlag(): Promise<boolean> {
  return isHermesAgentLive();
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function collectedSummary(session: Session): string {
  return answerLines(session).join('\n') || 'No answers yet.';
}

function recordInitialQuestion(session: Session, question: string): void {
  const alreadyRecorded = session.answers.some((a) => a.promptId === 'initial_question');
  if (alreadyRecorded || !question.trim()) return;
  session.answers.push({
    promptId: 'initial_question',
    question: 'Original user question',
    optionId: 'free_text_question',
    label: question.trim(),
  });
  session.offerContext = extractOfferContext(question.trim());
}

function fallbackPrompt(index: number): DecideInterviewChoicePrompt | undefined {
  return CHOICE_STEPS[index] ? DecideInterviewChoicePromptSchema.parse(CHOICE_STEPS[index]) : undefined;
}

function decoratePlaybookPrompt(
  playbook: DecisionPlaybook,
  step: ChoicePromptTemplate,
  session: Session,
): DecideInterviewChoicePrompt | undefined {
  const ctx = offerContextFor(session);
  const checked = session.answers.filter((a) => a.promptId !== 'initial_question').length;
  const contextualized =
    playbook.id === CAREER_COOP_PLAYBOOK.id
      ? contextualizeCoopStep(step, ctx)
      : DecideInterviewChoicePromptSchema.parse(step);
  return DecideInterviewChoicePromptSchema.parse({
    ...contextualized,
    specialistLabel: playbook.specialistLabel,
    whyItMatters: applyOfferTemplate(COOP_WHY_IT_MATTERS[step.id] ?? step.helperText ?? '', ctx),
    progress: {
      checked,
      label: playbook.progressLabel,
      mode: 'adaptive',
    },
  });
}

function playbookPrompt(
  playbook: DecisionPlaybook,
  index: number,
  session: Session,
): DecideInterviewChoicePrompt | undefined {
  const step = playbook.requiredSlots[index];
  if (!step) return undefined;
  return decoratePlaybookPrompt(playbook, step, session);
}

function isSpecialistPrompt(prompt: DecideInterviewChoicePrompt): boolean {
  return !!prompt.specialistLabel;
}

function specialistTransition(prompt: DecideInterviewChoicePrompt, session: Session): string {
  if (prompt.specialistLabel === CAREER_COOP_PLAYBOOK.specialistLabel) {
    const ctx = offerContextFor(session);
    const raw = CAREER_COOP_PLAYBOOK.transitions[prompt.id] ?? CAREER_COOP_PLAYBOOK.openingLine;
    return applyOfferTemplate(raw, ctx);
  }
  return `Got it. Next, let's sharpen the frame.`;
}

function initialQuestionFor(session: Session): string {
  return session.answers.find((a) => a.promptId === 'initial_question')?.label ?? '';
}

function isCoopOrInternshipOffer(text: string): boolean {
  const lower = text.toLowerCase();
  const hasCoopSignal = /\bco-?op\b|\bintern(ship)?\b|\bplacement\b/.test(lower);
  const hasDecisionSignal = /\boffer\b|\baccept\b|\btake\b|\bshould i\b|\bjoin\b/.test(lower);
  return hasCoopSignal && hasDecisionSignal;
}

function selectPlaybook(initialQuestion: string): DecisionPlaybook | undefined {
  if (isCoopOrInternshipOffer(initialQuestion)) return CAREER_COOP_PLAYBOOK;
  return undefined;
}

function playbookForSession(session: Session): DecisionPlaybook | undefined {
  if (session.playbookId === CAREER_COOP_PLAYBOOK.id) return CAREER_COOP_PLAYBOOK;
  return selectPlaybook(initialQuestionFor(session));
}

function answerMap(session: Session): Map<string, InterviewAnswer> {
  return new Map(session.answers.map((answer) => [answer.promptId, answer]));
}

function answerOption(session: Session, promptId: string): string | undefined {
  return answerMap(session).get(promptId)?.optionId;
}

function hasAnswer(session: Session, promptId: string): boolean {
  return answerMap(session).has(promptId);
}

function coopStep(id: string): ChoicePromptTemplate {
  const step = [...CAREER_COOP_STEPS, ...Object.values(CAREER_COOP_BRANCH_STEPS)].find((candidate) => candidate.id === id);
  if (!step) throw new Error(`Unknown co-op step: ${id}`);
  return step;
}

function adaptiveCoopPrompt(session: Session): DecideInterviewChoicePrompt | undefined {
  const playbook = CAREER_COOP_PLAYBOOK;
  const ask = (id: string) => decoratePlaybookPrompt(playbook, coopStep(id), session)!;
  const askedCount = session.answers.filter((a) => a.promptId !== 'initial_question').length;

  if (!hasAnswer(session, 'coop_program_stage')) return ask('coop_program_stage');
  if (!hasAnswer(session, 'coop_work_authorization')) return ask('coop_work_authorization');

  const authorization = answerOption(session, 'coop_work_authorization');
  if ((authorization === 'need_sponsorship' || authorization === 'not_comfortable') && !hasAnswer(session, 'coop_permit_plan')) {
    return ask('coop_permit_plan');
  }

  if (!hasAnswer(session, 'coop_offer_quality')) return ask('coop_offer_quality');

  const quality = answerOption(session, 'coop_offer_quality');
  if ((quality === 'technical_growth' || quality === 'unclear_quality') && !hasAnswer(session, 'coop_role_details')) {
    return ask('coop_role_details');
  }
  if (quality === 'brand_signal' && !hasAnswer(session, 'coop_reputation_context')) {
    return ask('coop_reputation_context');
  }

  if (!hasAnswer(session, 'coop_offer_risk')) return ask('coop_offer_risk');

  const risk = answerOption(session, 'coop_offer_risk');
  if (risk === 'too_long' && !hasAnswer(session, 'coop_recruiting_window')) return ask('coop_recruiting_window');
  if (risk === 'company_reputation' && !hasAnswer(session, 'coop_reputation_context')) {
    return ask('coop_reputation_context');
  }
  if (risk === 'role_mismatch' && !hasAnswer(session, 'coop_role_details')) return ask('coop_role_details');
  if (risk === 'immigration_school' && !hasAnswer(session, 'coop_permit_plan')) return ask('coop_permit_plan');

  if (!hasAnswer(session, 'coop_alternatives')) return ask('coop_alternatives');

  const alternative = answerOption(session, 'coop_alternatives');
  if (alternative === 'keep_recruiting' && !hasAnswer(session, 'coop_recruiting_window')) return ask('coop_recruiting_window');

  if (!hasAnswer(session, 'coop_decision_threshold')) return ask('coop_decision_threshold');

  // Keep an upper bound so the adaptive interview still reaches a recommendation.
  if (askedCount >= 5) return undefined;
  return ask('coop_decision_threshold');
}

function firstClarifyPromptForInitialQuestion(session: Session): DecideInterviewChoicePrompt {
  const initial = initialQuestionFor(session);
  const category = inferCategory(initial);
  const lower = initial.toLowerCase();
  const playbook = selectPlaybook(initial);

  if (playbook) {
    session.playbookId = playbook.id;
    return adaptiveCoopPrompt(session) ?? playbookPrompt(playbook, 0, session)!;
  }

  if (category === 'career' || lower.includes('offer')) {
    return DecideInterviewChoicePromptSchema.parse({
      id: 'career_offer_lens',
      title: 'Career offer lens',
      question: 'What makes this offer hard to decide?',
      helperText: 'Harmence inferred this as a career decision and will use the offer lens first.',
      options: [
        { id: 'compensation', label: 'Money / upside', description: 'Comp, equity, runway, benefits, opportunity cost.' },
        { id: 'growth', label: 'Growth path', description: 'Learning, scope, title, network, future optionality.' },
        { id: 'stability', label: 'Stability / risk', description: 'Company risk, manager, visa, burnout, work-life.' },
        { id: 'values', label: 'Fit / identity', description: 'Mission, culture, status, pride, long-term self-image.' },
      ],
      allowCustomAnswer: true,
    });
  }

  if (category === 'relationship') {
    return DecideInterviewChoicePromptSchema.parse({
      id: 'relationship_lens',
      title: 'Relationship lens',
      question: 'What is the core relationship tension?',
      options: [
        { id: 'trust', label: 'Trust / repair' },
        { id: 'commitment', label: 'Commitment level' },
        { id: 'needs', label: 'Unmet needs' },
        { id: 'boundary', label: 'Boundary setting' },
      ],
      allowCustomAnswer: true,
    });
  }

  if (category === 'money') {
    return DecideInterviewChoicePromptSchema.parse({
      id: 'money_lens',
      title: 'Money lens',
      question: 'What financial variable matters most here?',
      options: [
        { id: 'cashflow', label: 'Cash flow now' },
        { id: 'long_term', label: 'Long-term upside' },
        { id: 'downside', label: 'Downside protection' },
        { id: 'flexibility', label: 'Keeping options open' },
      ],
      allowCustomAnswer: true,
    });
  }

  return fallbackPrompt(0)!;
}

function nextFallbackPrompt(session: Session): DecideInterviewChoicePrompt | undefined {
  const nonInitialAnswers = session.answers.filter((a) => a.promptId !== 'initial_question').length;
  const initial = initialQuestionFor(session);
  if (initial) {
    const playbook = playbookForSession(session);
    if (playbook) {
      session.playbookId = playbook.id;
      return playbook.id === CAREER_COOP_PLAYBOOK.id
        ? adaptiveCoopPrompt(session)
        : playbookPrompt(playbook, nonInitialAnswers, session);
    }
    if (nonInitialAnswers === 0) {
      return firstClarifyPromptForInitialQuestion(session);
    }
  }
  return fallbackPrompt(nonInitialAnswers);
}

async function askHermesForNextChoice(
  session: Session,
  defaultPrompt: DecideInterviewChoicePrompt,
): Promise<{ assistantText: string; choicePrompt: DecideInterviewChoicePrompt }> {
  const result = await hermesChatCompletion({
    sessionId: session.id,
    messages: [
      { role: 'system', content: HARMENCE_CHOICE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          `Collected answers so far:\n${collectedSummary(session)}`,
          `Original user question:\n${initialQuestionFor(session) || '(unknown)'}`,
          `Offer context:\n${JSON.stringify(offerContextFor(session))}`,
          `Inferred fallback category: ${inferCategory(collectedSummary(session))}`,
          `Use or improve this next prompt:\n${JSON.stringify(defaultPrompt)}`,
          `Preserve specialistLabel, whyItMatters, and progress if provided.`,
        ].join('\n\n'),
      },
    ],
  });

  if (result.ok) {
    const raw = extractJsonObject(result.content);
    const candidate =
      raw && typeof raw === 'object' && 'choicePrompt' in raw
        ? raw as { assistantText?: unknown; choicePrompt?: unknown }
        : null;
    const parsedPrompt = DecideInterviewChoicePromptSchema.safeParse(candidate?.choicePrompt);
    if (candidate && parsedPrompt.success) {
      return {
        assistantText:
          typeof candidate.assistantText === 'string' && candidate.assistantText.trim()
            ? candidate.assistantText.trim()
            : `Got it. Next, let's sharpen the frame.`,
        choicePrompt: parsedPrompt.data,
      };
    }
  }

  return {
    assistantText: session.answers.length
      ? `Got it. Next, let's sharpen the frame.`
      : `Let's start with the shape of the decision. Pick the closest option and I'll adapt from there.`,
    choicePrompt: defaultPrompt,
  };
}

function expertsForSession(session: Session): HarmenceExpert[] {
  const experts = session.activeExpertIds.map((id) => expertById(id)).filter((x): x is HarmenceExpert => !!x);
  if (experts.length > 0) return experts;
  return selectExpertsFromText(initialQuestionFor(session) || collectedSummary(session));
}

function expertBubbleMeta(
  speaker: HarmenceExpert,
  supporting: HarmenceExpert[] = [],
): Partial<Pick<DecideInterviewBubble, 'expertId' | 'expertTitle' | 'expertIcon' | 'expertColor' | 'supportingExpertIds'>> {
  return {
    expertId: speaker.id,
    expertTitle: speaker.title,
    expertIcon: speaker.icon,
    expertColor: speaker.color,
    supportingExpertIds: supporting.map((expert) => expert.id),
  };
}

const relationshipFallbackQuestions = [
  {
    title: 'Relationship clarity',
    question: 'What is the strongest evidence that this relationship is repairable or not repairable?',
    helperText: 'The relationship expert is checking evidence, not just the pain of the current moment.',
    whyItMatters: 'Breakup decisions should separate temporary distress from repeated patterns, safety, trust, and unmet needs.',
    options: [
      { id: 'repairable_pattern', label: 'Repairable pattern', description: 'We can name the issue and both people are willing to work.' },
      { id: 'repeated_unmet_need', label: 'Repeated unmet need', description: 'I have asked clearly and the pattern keeps returning.' },
      { id: 'trust_or_safety', label: 'Trust or safety issue', description: 'Trust, emotional safety, or respect is seriously damaged.' },
      { id: 'unclear_attachment', label: 'Not sure', description: 'I cannot tell if this is love, fear, guilt, or habit.' },
    ],
  },
  {
    title: 'Pattern check',
    question: 'Which pattern has repeated enough that it should count as data, not just a bad week?',
    helperText: 'One-off conflict and repeated relational data should lead to different recommendations.',
    whyItMatters: 'The council needs to know whether the problem is episodic, chronic, or escalating.',
    options: [
      { id: 'same_conflict_loop', label: 'Same conflict loop', description: 'We keep having the same fight without repair.' },
      { id: 'emotional_unavailability', label: 'Emotional unavailability', description: 'One or both of us cannot show up consistently.' },
      { id: 'boundary_violations', label: 'Boundary violations', description: 'My boundaries are repeatedly ignored or minimized.' },
      { id: 'mostly_recent', label: 'Mostly recent stress', description: 'This may be tied to a temporary season.' },
    ],
  },
  {
    title: 'Repair signal',
    question: 'When you raise the hard issue clearly, what usually happens next?',
    helperText: 'Repairability depends less on promises and more on what happens after direct feedback.',
    whyItMatters: 'A relationship can survive hard problems when both people can repair, take responsibility, and change behavior.',
    options: [
      { id: 'specific_change', label: 'Specific change follows', description: 'They listen, own their part, and behavior changes.' },
      { id: 'promises_no_change', label: 'Promises, no change', description: 'The conversation sounds good but the pattern returns.' },
      { id: 'defensive_or_blame', label: 'Defensive or blaming', description: 'It turns into denial, blame, or me managing their reaction.' },
      { id: 'avoid_talking', label: 'I avoid bringing it up', description: 'I do not feel safe or hopeful enough to say it clearly.' },
    ],
  },
  {
    title: 'Future-self test',
    question: 'If nothing meaningfully changed for the next year, what would staying cost you?',
    helperText: 'This checks the cost of continuing the current pattern, not an idealized version of the relationship.',
    whyItMatters: 'The right answer changes when staying quietly drains self-respect, health, ambition, or social connection.',
    options: [
      { id: 'manageable_cost', label: 'Manageable cost', description: 'It would be hard, but not self-erasing.' },
      { id: 'self_respect_cost', label: 'Self-respect cost', description: 'I would feel smaller or less honest with myself.' },
      { id: 'life_stuck_cost', label: 'Life stuck cost', description: 'It blocks growth, friendships, career, or family goals.' },
      { id: 'safety_cost', label: 'Safety cost', description: 'My emotional or physical safety would be at risk.' },
    ],
  },
  {
    title: 'Decision threshold',
    question: 'What would need to be true for you to stay without betraying yourself?',
    helperText: 'A threshold turns the decision from rumination into a concrete test.',
    whyItMatters: 'If there is no realistic threshold, the relationship may already be past the point of repair.',
    options: [
      { id: 'clear_repair_plan', label: 'Clear repair plan', description: 'Specific behavior change, timeline, and accountability.' },
      { id: 'couples_support', label: 'Outside support', description: 'Therapy, mediator, mentor, or structured conversation.' },
      { id: 'trust_rebuilt', label: 'Trust rebuilt', description: 'Concrete evidence that trust or safety can return.' },
      { id: 'nothing_realistic', label: 'Nothing realistic', description: 'I do not believe the needed change will happen.' },
    ],
  },
] as const;

const generalFallbackQuestions = [
  {
    title: 'Decision clarity',
    question: 'What fact, if known, would most change your answer?',
    helperText: 'The decision strategist is looking for the uncertainty with the highest leverage.',
    whyItMatters: 'A good next question should reduce uncertainty, not collect generic background.',
    options: [
      { id: 'downside', label: 'Downside risk', description: 'What could go wrong if I choose yes.' },
      { id: 'opportunity_cost', label: 'Opportunity cost', description: 'What I give up by choosing this.' },
      { id: 'reversibility', label: 'Reversibility', description: 'How hard it is to undo later.' },
      { id: 'values_fit', label: 'Values fit', description: 'Whether this matches the person I want to become.' },
    ],
  },
  {
    title: 'Constraint check',
    question: 'Which constraint is least negotiable here?',
    helperText: 'The strongest recommendation usually protects the constraint that cannot bend.',
    whyItMatters: 'Money, time, health, people, and identity constraints should not be weighted equally.',
    options: [
      { id: 'money', label: 'Money / runway', description: 'Budget, debt, income, or opportunity cost.' },
      { id: 'time', label: 'Time / deadline', description: 'A deadline, season, contract, or clock.' },
      { id: 'people', label: 'People obligations', description: 'Family, partner, team, or promises.' },
      { id: 'health_identity', label: 'Health / identity', description: 'Energy, mental health, values, or self-respect.' },
    ],
  },
  {
    title: 'Reversibility',
    question: 'If this decision is wrong, how hard is it to reverse?',
    helperText: 'Reversibility changes how much certainty you need before acting.',
    whyItMatters: 'A reversible choice can be tested; an irreversible one needs more proof.',
    options: [
      { id: 'easy_reverse', label: 'Easy to reverse', description: 'I can unwind it with low cost.' },
      { id: 'costly_reverse', label: 'Costly but possible', description: 'There is real cost, but I can recover.' },
      { id: 'hard_reverse', label: 'Hard to reverse', description: 'It could lock me in for a long time.' },
      { id: 'unknown_reverse', label: 'Not sure', description: 'I have not mapped the exit path.' },
    ],
  },
] as const;

function careerFallbackQuestions(ctx: OfferContext) {
  return [
    {
      title: 'Offer quality',
      question: `What would make the ${ctx.offerPhrase} meaningfully better than your next-best alternative?`,
      helperText: 'The career expert is comparing real upside against opportunity cost.',
      whyItMatters: 'A strong decision needs the offer to beat a realistic alternative, not just sound impressive.',
      options: [
        { id: 'team_project', label: 'Team and project quality', description: 'The work would build target skills.' },
        { id: 'future_signal', label: 'Future recruiting signal', description: 'It improves the next internship/full-time search.' },
        { id: 'only_real_option', label: 'Only realistic option', description: 'The backup is uncertain or weak.' },
        { id: 'not_sure', label: 'Not sure yet', description: 'I still need facts from the employer.' },
      ],
    },
    {
      title: 'Role clarity',
      question: `How clear are the actual team, manager, and project for the ${ctx.offerPhrase}?`,
      helperText: 'The logo matters less than the work you will actually do.',
      whyItMatters: 'A prestigious offer can still be weak if the role does not build useful evidence for your next step.',
      options: [
        { id: 'clear_strong', label: 'Clear and strong', description: 'Team, stack, manager, and project look aligned.' },
        { id: 'clear_mixed', label: 'Clear but mixed', description: 'Some useful work, some low-signal risk.' },
        { id: 'unclear', label: 'Still unclear', description: 'I do not know enough about the role yet.' },
        { id: 'weak_fit', label: 'Likely weak fit', description: 'The work may not build my target skills.' },
      ],
    },
    {
      title: 'Opportunity cost',
      question: `What would taking the ${ctx.offerPhrase} block or delay?`,
      helperText: 'A yes is strongest when the opportunity cost is explicit.',
      whyItMatters: 'The offer should be compared against realistic alternatives, school timing, and recruiting windows.',
      options: [
        { id: 'nothing_major', label: 'Nothing major', description: 'It fits my calendar and goals.' },
        { id: 'recruiting_cycle', label: 'Recruiting cycle', description: 'It may block other internships or full-time recruiting.' },
        { id: 'school_timing', label: 'School timing', description: 'It may delay courses or graduation.' },
        { id: 'personal_cost', label: 'Personal cost', description: 'Location, housing, family, or health costs matter.' },
      ],
    },
  ];
}

async function routeExpertsForTurn(
  session: Session,
  latestText: string,
  hermesIntegrated: boolean,
): Promise<{ activeExperts: HarmenceExpert[]; newlyActivatedExperts: HarmenceExpert[] }> {
  const baseText = [initialQuestionFor(session), collectedSummary(session), latestText].filter(Boolean).join('\n');
  const deterministic = selectExpertsFromText(baseText);
  let requested = deterministic;

  if (hermesIntegrated) {
    const catalog = deterministic
      .concat(expertsForSession(session))
      .filter((expert, index, arr) => arr.findIndex((candidate) => candidate.id === expert.id) === index)
      .map((expert) => ({
        id: expert.id,
        title: expert.title,
        skillName: expert.skillName,
        description: expert.subtitle,
        activationInstruction: expert.activationInstruction,
      }));
    const result = await hermesChatCompletion({
      sessionId: `${session.id}:router`,
      messages: [
        { role: 'system', content: HARMENCE_EXPERT_ROUTER_PROMPT },
        {
          role: 'user',
          content: [
            `Expert catalog:\n${JSON.stringify(catalog)}`,
            `Conversation:\n${baseText}`,
            `Return the useful expert IDs for the next turn.`,
          ].join('\n\n'),
        },
      ],
    });
    if (result.ok) {
      const raw = extractJsonObject(result.content);
      const ids = raw && typeof raw === 'object' && Array.isArray((raw as { expertIds?: unknown }).expertIds)
        ? (raw as { expertIds: unknown[] }).expertIds.filter((id): id is string => typeof id === 'string')
        : [];
      const routed = ids.map((id) => expertById(id)).filter((expert): expert is HarmenceExpert => !!expert);
      if (routed.length > 0) requested = routed.concat(deterministic);
    }
  }

  const before = new Set(session.activeExpertIds);
  session.activeExpertIds = mergeExpertIds(session.activeExpertIds, requested);
  const activeExperts = expertsForSession(session);
  const newlyActivatedExperts = activeExperts.filter((expert) => !before.has(expert.id));
  return { activeExperts, newlyActivatedExperts };
}

function fallbackExpertChoice(
  session: Session,
  activeExperts: HarmenceExpert[],
): { assistantText: string; choicePrompt?: DecideInterviewChoicePrompt; readyForFinal: boolean; speaker: HarmenceExpert; supporting: HarmenceExpert[] } {
  const answers = session.answers.filter((a) => a.promptId !== 'initial_question');
  const speaker = activeExperts[0] ?? selectExpertsFromText(initialQuestionFor(session))[0]!;
  const careerSpeaker = activeExperts.find((expert) => expert.id === 'career-coop') ?? speaker;
  const relationshipSpeaker = activeExperts.find((expert) => expert.id === 'relationship') ?? speaker;
  const supporting = activeExperts.filter((expert) => expert.id !== speaker.id);
  const ctx = offerContextFor(session);
  const hasIntl = activeExperts.some((expert) => expert.id === 'intl-student');
  const hasCareer = activeExperts.some((expert) => expert.id === 'career-coop');
  const hasRelationship = activeExperts.some((expert) => expert.id === 'relationship');
  const checked = answers.length;
  const questionIndex = Math.max(0, checked);

  if (checked >= (hasIntl ? 6 : 5)) {
    return {
      assistantText: 'The expert council has enough context to synthesize a grounded recommendation.',
      readyForFinal: true,
      speaker,
      supporting,
    };
  }

  const intlQuestion = DecideInterviewChoicePromptSchema.parse({
    id: `expert_intl_${checked + 1}`,
    title: 'Immigration constraint',
    question: 'What immigration or work-authorization fact could most change this decision?',
    helperText: 'The international-student expert is checking whether eligibility can override offer quality.',
    speakerExpertId: 'intl-student',
    supportingExpertIds: supporting.map((expert) => expert.id),
    specialistLabel: 'International Student Advisor',
    whyItMatters: 'Immigration risk can turn an attractive offer into the wrong move if timing or eligibility is unsafe.',
    progress: { checked, label: 'expert checks', mode: 'adaptive' },
    options: [
      { id: 'school_confirmed', label: 'School/permit confirmed', description: 'I have written confirmation that this works.' },
      { id: 'not_confirmed', label: 'Not confirmed yet', description: 'I am assuming it works but have not checked.' },
      { id: 'status_sensitive', label: 'Status-sensitive', description: 'Timing, PR, PGWP, OPT, H-1B, or permit rules may matter.' },
      { id: 'prefer_private', label: 'Prefer not to say', description: 'Use a privacy-safe risk framing.' },
    ],
    allowCustomAnswer: true,
  });

  const careerQuestion = DecideInterviewChoicePromptSchema.parse({
    id: `expert_career_${checked + 1}`,
    ...(careerFallbackQuestions(ctx)[questionIndex] ?? careerFallbackQuestions(ctx).at(-1)!),
    speakerExpertId: careerSpeaker.id,
    supportingExpertIds: activeExperts.filter((expert) => expert.id !== careerSpeaker.id).map((expert) => expert.id),
    specialistLabel: careerSpeaker.title,
    progress: { checked, label: 'expert checks', mode: 'adaptive' },
    allowCustomAnswer: true,
  });

  const relationshipQuestion = DecideInterviewChoicePromptSchema.parse({
    id: `expert_relationship_${checked + 1}`,
    ...(relationshipFallbackQuestions[questionIndex] ?? relationshipFallbackQuestions.at(-1)!),
    speakerExpertId: relationshipSpeaker.id,
    supportingExpertIds: activeExperts.filter((expert) => expert.id !== relationshipSpeaker.id).map((expert) => expert.id),
    specialistLabel: relationshipSpeaker.title,
    progress: { checked, label: 'expert checks', mode: 'adaptive' },
    allowCustomAnswer: true,
  });

  const generalQuestion = DecideInterviewChoicePromptSchema.parse({
    id: `expert_general_${checked + 1}`,
    ...(generalFallbackQuestions[questionIndex] ?? generalFallbackQuestions.at(-1)!),
    speakerExpertId: speaker.id,
    supportingExpertIds: supporting.map((expert) => expert.id),
    specialistLabel: speaker.title,
    progress: { checked, label: 'expert checks', mode: 'adaptive' },
    allowCustomAnswer: true,
  });

  const choicePrompt =
    hasIntl && checked <= 3
      ? intlQuestion
      : hasRelationship
        ? relationshipQuestion
        : hasCareer
          ? careerQuestion
          : generalQuestion;
  const actualSpeaker = expertById(choicePrompt.speakerExpertId ?? speaker.id) ?? speaker;
  return {
    assistantText: `${actualSpeaker.title} wants to check the highest-leverage unknown before the council recommends.`,
    choicePrompt,
    readyForFinal: false,
    speaker: actualSpeaker,
    supporting: activeExperts.filter((expert) => expert.id !== actualSpeaker.id),
  };
}

function formatAvailableSkillsForPrompt(experts: HarmenceExpert[]): string {
  if (experts.length === 0) return 'None — use smart_talk framework only.';
  return experts
    .map((e) => `- ${e.skillName} [id: ${e.id}] (${e.title}): ${e.activationInstruction}`)
    .join('\n');
}

function buildSmartTalkDriverPrompt(
  availableSkills: HarmenceExpert[],
  challengeMode: ReturnType<typeof buildChallengeInstruction>,
): string {
  const skillsList = formatAvailableSkillsForPrompt(availableSkills);
  const challengeInstruction = challengeMode ? (CHALLENGE_MODE_INSTRUCTIONS[challengeMode] ?? '') : '';
  return HARMENCE_SMART_TALK_DRIVER_PROMPT
    .replace('{AVAILABLE_SKILLS}', skillsList)
    .replace('{CHALLENGE_MODE}', challengeInstruction);
}

async function askSmartTalkForNextChoice(
  session: Session,
  latestText: string,
  hermesIntegrated: boolean,
): Promise<{
  assistantText: string;
  choicePrompt?: DecideInterviewChoicePrompt;
  readyForFinal: boolean;
  activeExperts: HarmenceExpert[];
  newlyActivatedExperts: HarmenceExpert[];
  speaker: HarmenceExpert;
  supporting: HarmenceExpert[];
}> {
  // Single mode: skip dynamic routing, keep initial expert locked
  let activeExperts: HarmenceExpert[];
  let newlyActivatedExperts: HarmenceExpert[] = [];
  if (session.mode === 'single') {
    activeExperts = expertsForSession(session);
  } else {
    const routed = await routeExpertsForTurn(session, latestText, hermesIntegrated);
    activeExperts = routed.activeExperts;
    newlyActivatedExperts = routed.newlyActivatedExperts;
  }

  const fallback = fallbackExpertChoice(session, activeExperts);
  const defaultSpeaker = activeExperts[0] ?? fallback.speaker;

  if (!hermesIntegrated) {
    return { ...fallback, activeExperts, newlyActivatedExperts };
  }

  const challengeMode = buildChallengeInstruction(session.smartTalkState);
  const systemPrompt = buildSmartTalkDriverPrompt(activeExperts, challengeMode);
  const answerCount = session.answers.filter((a) => a.promptId !== 'initial_question').length;

  const result = await hermesChatCompletion({
    sessionId: `${session.id}:smart-talk`,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          `Mode: ${session.mode}`,
          `Round: ${session.smartTalkState.rounds}`,
          `Current 4D scores: ${JSON.stringify(session.smartTalkState.scores)}`,
          `Dimension depths: ${JSON.stringify(session.smartTalkState.dimensionDepths)}`,
          `Original question: ${initialQuestionFor(session)}`,
          `Collected answers:\n${collectedSummary(session)}`,
          `Latest answer: ${latestText}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
  });

  if (!result.ok) {
    return { ...fallback, activeExperts, newlyActivatedExperts };
  }

  const raw = extractJsonObject(result.content) as {
    assistantText?: unknown;
    choicePrompt?: unknown;
    scores?: { intent?: number; reality?: number; signal?: number; stakes?: number };
    dimensionTargeted?: unknown;
    challengeModeApplied?: unknown;
    domainSkillsCalledThisTurn?: unknown;
    domain_skills_called_this_turn?: unknown;
    speakerExpertId?: unknown;
    readyForFinal?: unknown;
  } | null;

  if (!raw) {
    return { ...fallback, activeExperts, newlyActivatedExperts };
  }
  // Capture state before update for momentum tracking
  const ambiguityBefore = session.smartTalkState.ambiguity;
  const scoresBefore = { ...session.smartTalkState.scores };

  // Update 4D scores from response
  if (raw?.scores) {
    const s = raw.scores;
    session.smartTalkState.scores = {
      intent: typeof s.intent === 'number' ? s.intent : session.smartTalkState.scores.intent,
      reality: typeof s.reality === 'number' ? s.reality : session.smartTalkState.scores.reality,
      signal: typeof s.signal === 'number' ? s.signal : session.smartTalkState.scores.signal,
      stakes: typeof s.stakes === 'number' ? s.stakes : session.smartTalkState.scores.stakes,
    };
    const dim = typeof raw.dimensionTargeted === 'string'
      ? (raw.dimensionTargeted as keyof SmartTalkState['dimensionDepths'])
      : null;
    if (dim && dim in session.smartTalkState.dimensionDepths) {
      session.smartTalkState.dimensionDepths[dim] += 1;
    }
  }
  session.smartTalkState.rounds += 1;

  const validChallengeModes = ['contrarian', 'simplifier', 'reframer'] as const;
  const appliedChallengeRaw = typeof raw?.challengeModeApplied === 'string' ? raw.challengeModeApplied : null;
  const appliedChallenge = appliedChallengeRaw && (validChallengeModes as readonly string[]).includes(appliedChallengeRaw)
    ? (appliedChallengeRaw as 'contrarian' | 'simplifier' | 'reframer')
    : null;
  if (appliedChallenge && !session.smartTalkState.challengeModesUsed.includes(appliedChallenge)) {
    session.smartTalkState.challengeModesUsed.push(appliedChallenge);
  }

  const domainSkillsList = raw?.domainSkillsCalledThisTurn ?? raw?.domain_skills_called_this_turn;
  if (Array.isArray(domainSkillsList)) {
    const calledExperts: HarmenceExpert[] = [];
    for (const skill of domainSkillsList as unknown[]) {
      if (typeof skill !== 'string') continue;
      const expert = expertBySkillName(skill) ?? expertById(skill);
      if (!expert) continue;
      if (!session.smartTalkState.domainSkillsInvoked.includes(expert.skillName)) {
        session.smartTalkState.domainSkillsInvoked.push(expert.skillName);
      }
      calledExperts.push(expert);
    }
    if (calledExperts.length > 0) {
      session.activeExpertIds = mergeExpertIds(session.activeExpertIds, calledExperts);
    }
  }

  // Refresh activeExperts/newlyActivatedExperts after domain-skill activations so the
  // turn response and momentum log expertsJoined reflect experts added this turn.
  const prevActiveIds = new Set(activeExperts.map((e) => e.id));
  const refreshedExperts = expertsForSession(session);
  const domainActivated = refreshedExperts.filter((e) => !prevActiveIds.has(e.id));
  if (domainActivated.length > 0) {
    activeExperts = refreshedExperts;
    newlyActivatedExperts = [...newlyActivatedExperts, ...domainActivated];
  }

  // ShouldI layer: compute ambiguity + enforce hard termination
  const ambiguity = computeAmbiguity(session.smartTalkState.scores);
  session.smartTalkState.ambiguity = ambiguity;
  const hardStop = ambiguity <= 0.20 || answerCount >= 10;
  const readyForFinal = hardStop || raw?.readyForFinal === true;

  // Record momentum entry for this turn
  if (raw?.scores) {
    const latestAnswer = session.answers.filter((a) => a.promptId !== 'initial_question').at(-1);
    if (latestAnswer) {
      session.smartTalkState.momentumLog.push({
        round: session.smartTalkState.rounds - 1,
        promptId: latestAnswer.promptId,
        question: latestAnswer.question,
        answer: latestAnswer.label,
        ambiguityBefore,
        ambiguityAfter: ambiguity,
        delta: ambiguityBefore - ambiguity,
        dimensionMoved: typeof raw?.dimensionTargeted === 'string' ? raw.dimensionTargeted : '',
        scoreDelta: {
          intent: session.smartTalkState.scores.intent - scoresBefore.intent,
          reality: session.smartTalkState.scores.reality - scoresBefore.reality,
          signal: session.smartTalkState.scores.signal - scoresBefore.signal,
          stakes: session.smartTalkState.scores.stakes - scoresBefore.stakes,
        },
        expertsJoined: newlyActivatedExperts.map((e) => e.id),
      });
    }
  }

  const rawChoicePrompt = raw?.choicePrompt as Record<string, unknown> | undefined;
  const speakerIdRaw =
    typeof rawChoicePrompt?.speakerExpertId === 'string'
      ? rawChoicePrompt.speakerExpertId
      : typeof raw?.speakerExpertId === 'string'
        ? raw.speakerExpertId
        : null;
  const speaker =
    (speakerIdRaw ? expertById(speakerIdRaw) ?? expertBySkillName(speakerIdRaw) : null) ?? defaultSpeaker;
  const supporting = activeExperts.filter((e) => e.id !== speaker.id);

  const resolvedAssistantText = typeof raw?.assistantText === 'string' && raw.assistantText.trim()
    ? raw.assistantText.trim()
    : fallback.assistantText;

  if (readyForFinal) {
    return {
      assistantText: resolvedAssistantText,
      readyForFinal: true,
      activeExperts,
      newlyActivatedExperts,
      speaker,
      supporting,
    };
  }

  const parsedPrompt = DecideInterviewChoicePromptSchema.safeParse(raw?.choicePrompt);
  if (!parsedPrompt.success) {
    return { ...fallback, activeExperts, newlyActivatedExperts };
  }

  const choicePrompt = DecideInterviewChoicePromptSchema.parse({
    ...parsedPrompt.data,
    speakerExpertId: parsedPrompt.data.speakerExpertId ?? speaker.id,
    supportingExpertIds: parsedPrompt.data.supportingExpertIds?.length
      ? parsedPrompt.data.supportingExpertIds
      : supporting.map((e) => e.id),
    specialistLabel: parsedPrompt.data.specialistLabel ?? speaker.title,
    progress: {
      checked: answerCount,
      label: parsedPrompt.data.progress?.label ?? 'clarity checks',
      mode: 'adaptive',
      ambiguity,
    },
  });

  return {
    assistantText: resolvedAssistantText,
    choicePrompt,
    readyForFinal: false,
    activeExperts,
    newlyActivatedExperts,
    speaker,
    supporting,
  };
}


function fallbackFinal(session: Session): {
  assistantText: string;
  finalDecision: DecideInterviewFinalDecision;
  previewCard: DecideInterviewPreviewCard;
} {
  const category = inferCategory(collectedSummary(session));
  const initial = initialQuestionFor(session);
  const isCoopOffer = playbookForSession(session)?.id === CAREER_COOP_PLAYBOOK.id || isCoopOrInternshipOffer(initial);
  const byPrompt = new Map(session.answers.map((a) => [a.promptId, a]));
  const activeExperts = expertsForSession(session);

  if (isCoopOffer) {
    const ctx = offerContextFor(session);
    const durationCoop = ctx.durationLabel === 'this' ? 'co-op' : `${ctx.durationLabel} co-op`;
    const riskFlags = CAREER_COOP_PLAYBOOK.riskFlags.filter((flag) => flag.when(byPrompt));
    const stage = byPrompt.get('coop_program_stage')?.label ?? 'your current program stage';
    const authorization = byPrompt.get('coop_work_authorization')?.label ?? 'your work authorization situation';
    const strength = byPrompt.get('coop_offer_quality')?.label ?? 'the strongest part of the offer';
    const risk = byPrompt.get('coop_offer_risk')?.label ?? 'the main risk';
    const alternative = byPrompt.get('coop_alternatives')?.label ?? 'your realistic alternative';
    const threshold = byPrompt.get('coop_decision_threshold')?.label ?? 'your decision threshold';
    const noClearBackup = alternative.toLowerCase().includes('no clear backup');
    const keepRecruiting = alternative.toLowerCase().includes('keep recruiting');
    const answerBlob = session.answers.map((a) => `${a.optionId} ${a.label} ${a.description ?? ''}`).join('\n').toLowerCase();
    const hasIntlExpert = activeExperts.some((expert) => expert.id === 'intl-student');
    const permitRisk =
      risk.toLowerCase().includes('permit') ||
      authorization.toLowerCase().includes('unsure') ||
      (hasIntlExpert &&
        !answerBlob.includes('school_confirmed') &&
        /(not confirmed|status-sensitive|permit|visa|international|immigration|study permit|co-op permit)/.test(answerBlob));
    const reputationRisk = risk.toLowerCase().includes('reputation') || risk.toLowerCase().includes('geopolitics');
    const leanYes = noClearBackup || (!permitRisk && !keepRecruiting);
    const verdictLine = leanYes ? 'YES — take the co-op' : 'NO — do not accept yet';
    const checkpointWeeks = ctx.durationLabel === 'this' ? '8-12' : '4-8';
    const recommendation = leanYes
      ? `Accept the ${ctx.offerPhrase} if your school and permit office confirm eligibility in writing, then use the first ${checkpointWeeks} weeks as a checkpoint.`
      : `Do not commit to the ${ctx.offerPhrase} until you verify ${permitRisk ? 'school/permit eligibility' : reputationRisk ? 'reputational risk with target employers' : 'the specific role quality'} and compare it against your recruiting pipeline.`;
    const riskFlagLine = riskFlags.length ? ` Key flags: ${riskFlags.map((flag) => flag.label).join('; ')}.` : '';
    const because = `Harmence weighed that this is ${stage}, your authorization is ${authorization}, the main upside is ${strength}, the main worry is ${risk}, your backup is ${alternative}, and a clear yes depends on ${threshold}.${riskFlagLine}`;

    return {
      assistantText: `Distilled what I heard. I have enough to give you a concise recommendation and a community-safe preview card.`,
      finalDecision: DecideInterviewFinalDecisionSchema.parse({
        verdictLine,
        recommendation,
        rationale: because,
        confidence: permitRisk || reputationRisk ? 'medium' : 'high',
        nextSteps: [
          `Ask the co-op office to confirm the ${durationCoop} placement is eligible for your status.`,
          `Ask ${ctx.company} for team, project, manager, and return-offer expectations in writing.`,
          'Compare this against the strongest realistic backup before the offer deadline.',
        ],
        expertVerdicts: activeExperts.map((expert) => ({
          expertId: expert.id,
          expertTitle: expert.title,
          verdictLine:
            expert.id === 'intl-student' && permitRisk
              ? 'NO — verify authorization before accepting'
              : verdictLine,
          reasoning:
            expert.id === 'intl-student'
              ? `This hinges on whether ${authorization} safely supports the ${durationCoop} placement.`
              : `This hinges on ${strength}, ${risk}, and whether the offer beats ${alternative}.`,
          confidence: permitRisk || reputationRisk ? 'medium' : 'high',
          risks: riskFlags.map((flag) => flag.label),
          nextQuestionsOrActions:
            expert.id === 'intl-student'
              ? [`Confirm the ${durationCoop} placement with the school or a qualified advisor.`]
              : [`Ask ${ctx.company} for concrete team, project, and manager details.`],
        })),
      }),
      previewCard: DecideInterviewPreviewCardSchema.parse({
        category: 'career',
        question: ctx.rawQuestion.startsWith('Should')
          ? ctx.rawQuestion
          : `Should this student take the ${ctx.offerPhrase}?`,
        hook: `A ${ctx.offerPhrase} could be a major industry signal, but eligibility and role fit still matter.`,
        tension: because,
        options: [
          { id: 'take_it', label: 'Take the co-op' },
          { id: 'keep_recruiting', label: 'Keep recruiting first' },
        ],
        aiVerdictLine: verdictLine,
        aiBecause: because,
        discussionPreview: [
          `How much does ${ctx.company} help or hurt future recruiting?`,
          'Would you accept this co-op if permits and role quality are clean?',
          'What should they verify before signing?',
        ],
      }),
    };
  }

  const decision = session.answers.find((a) => a.promptId === 'real_question')?.label ?? 'this decision';
  const risk = session.answers.find((a) => a.promptId === 'risk_appetite')?.label ?? 'medium uncertainty';
  const constraint = session.answers.find((a) => a.promptId === 'constraint')?.label ?? 'your main constraint';
  const verdictLine = `Lean: choose the path that protects ${constraint.toLowerCase()}`;
  const because = `Harmence weighed the stated dilemma (${decision}), your risk tolerance (${risk}), and the least-bendable constraint (${constraint}). The safest read is to pick the option that preserves that constraint while keeping the decision reversible.`;

  return {
    assistantText: `Distilled what I heard. I have enough to give you a recommendation and a community-safe preview card.`,
    finalDecision: DecideInterviewFinalDecisionSchema.parse({
      verdictLine,
      recommendation: `Move forward only if the option preserves ${constraint.toLowerCase()} and gives you a clear next checkpoint.`,
      rationale: because,
      confidence: 'medium',
      nextSteps: [
        'Name the option that best protects the hard constraint.',
        'Set a short checkpoint date before fully committing.',
        'Ask one person with lived experience to challenge the assumption.',
      ],
      expertVerdicts: activeExperts.map((expert) => ({
        expertId: expert.id,
        expertTitle: expert.title,
        verdictLine,
        reasoning: because,
        confidence: 'medium',
        risks: [constraint],
        nextQuestionsOrActions: ['Name the most important unresolved fact before committing.'],
      })),
    }),
    previewCard: DecideInterviewPreviewCardSchema.parse({
      category,
      question: `Would you agree with Harmence's lean on this ${category} decision?`,
      hook: `Harmence thinks the core issue is ${constraint.toLowerCase()}, not just preference.`,
      tension: because,
      options: [
        { id: 'agree', label: 'Agree with Harmence' },
        { id: 'push_back', label: 'Push back' },
      ],
      aiVerdictLine: verdictLine,
      aiBecause: because,
      discussionPreview: [
        'What lived experience would change this recommendation?',
        'What risk is being underweighted?',
        'Which constraint matters most here?',
      ],
    }),
  };
}

function requiresBinaryVerdict(session: Session): boolean {
  return (
    /^should\s+i\b/i.test(initialQuestionFor(session).trim()) ||
    playbookForSession(session)?.verdictPolicy === 'binary'
  );
}

async function askHermesForFinal(session: Session): Promise<{
  assistantText: string;
  finalDecision: DecideInterviewFinalDecision;
  previewCard: DecideInterviewPreviewCard;
}> {
  const fallback = fallbackFinal(session);

  const result = await hermesChatCompletion({
    sessionId: session.id,
    messages: [
      { role: 'system', content: HARMENCE_FINAL_SYSTEM_PROMPT },
      { role: 'user', content: `Collected answers:\n${collectedSummary(session)}\n\nOriginal question:\n${initialQuestionFor(session) || '(unknown)'}\n\nOffer context:\n${JSON.stringify(offerContextFor(session))}` },
    ],
  });
  if (!result.ok) return fallback;

  const raw = extractJsonObject(result.content);
  if (!raw || typeof raw !== 'object') return fallback;
  const candidate = raw as { assistantText?: unknown; finalDecision?: unknown; previewCard?: unknown };
  const finalDecision = DecideInterviewFinalDecisionSchema.safeParse(candidate.finalDecision);
  const previewCard = DecideInterviewPreviewCardSchema.safeParse(candidate.previewCard);
  if (!finalDecision.success || !previewCard.success) return fallback;
  if (requiresBinaryVerdict(session) && !/^(yes|no)\b/i.test(finalDecision.data.verdictLine.trim())) {
    return fallback;
  }

  return {
    assistantText:
      typeof candidate.assistantText === 'string' && candidate.assistantText.trim()
        ? candidate.assistantText.trim()
        : fallback.assistantText,
    finalDecision: finalDecision.data,
    previewCard: previewCard.data,
  };
}

async function askExpertCouncilForFinal(session: Session, hermesIntegrated: boolean): Promise<{
  assistantText: string;
  finalDecision: DecideInterviewFinalDecision;
  previewCard: DecideInterviewPreviewCard;
}> {
  const fallback = fallbackFinal(session);
  const activeExperts = expertsForSession(session);
  if (!hermesIntegrated) return fallback;

  const result = await hermesChatCompletion({
    sessionId: `${session.id}:expert-final`,
    messages: [
      { role: 'system', content: HARMENCE_EXPERT_FINAL_PROMPT },
      {
        role: 'user',
        content: [
          expertPrelude(activeExperts),
          `Active experts:\n${JSON.stringify(activeExperts.map(publicExpert))}`,
          `Original question:\n${initialQuestionFor(session)}`,
          `Collected answers:\n${collectedSummary(session)}`,
        ].join('\n\n'),
      },
    ],
  });
  if (!result.ok) return fallback;

  const raw = extractJsonObject(result.content);
  if (!raw || typeof raw !== 'object') return fallback;
  const candidate = raw as { assistantText?: unknown; finalDecision?: unknown; previewCard?: unknown };
  const finalDecision = DecideInterviewFinalDecisionSchema.safeParse(candidate.finalDecision);
  const previewCard = DecideInterviewPreviewCardSchema.safeParse(candidate.previewCard);
  if (!finalDecision.success || !previewCard.success) return fallback;


  if (requiresBinaryVerdict(session) && !/^(yes|no)\b/i.test(finalDecision.data.verdictLine.trim())) {
    return fallback;
  }

  return {
    assistantText:
      typeof candidate.assistantText === 'string' && candidate.assistantText.trim()
        ? candidate.assistantText.trim()
        : fallback.assistantText,
    finalDecision: finalDecision.data,
    previewCard: previewCard.data,
  };
}

async function askExpertIndividualVerdict(
  session: Session,
  expert: HarmenceExpert,
): Promise<{
  expertId: string;
  expertTitle: string;
  verdictLine: string;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  risks: string[];
  nextQuestionsOrActions: string[];
}> {
  const fallbackVerdict = {
    expertId: expert.id,
    expertTitle: expert.title,
    verdictLine: 'See overall recommendation',
    reasoning: `${expert.title} analysis based on collected answers.`,
    confidence: 'medium' as const,
    risks: [] as string[],
    nextQuestionsOrActions: [] as string[],
  };

  const result = await hermesChatCompletion({
    sessionId: `${session.id}:expert-verdict:${expert.id}`,
    messages: [
      { role: 'system', content: HARMENCE_EXPERT_INDIVIDUAL_FINAL_PROMPT },
      {
        role: 'user',
        content: [
          `Expert id: ${expert.id}`,
          `Expert title: ${expert.title}`,
          `Skill: ${expert.skillName}`,
          `Activation: ${expert.activationInstruction}`,
          `Original question: ${initialQuestionFor(session)}`,
          `Collected answers:\n${collectedSummary(session)}`,
        ].join('\n'),
      },
    ],
  });

  if (!result.ok) return fallbackVerdict;
  const raw = extractJsonObject(result.content) as {
    expertId?: unknown;
    expertTitle?: unknown;
    verdictLine?: unknown;
    reasoning?: unknown;
    confidence?: unknown;
    risks?: unknown;
    nextQuestionsOrActions?: unknown;
  } | null;
  if (!raw) return fallbackVerdict;

  const validConfidences = ['low', 'medium', 'high'] as const;
  return {
    expertId: typeof raw.expertId === 'string' ? raw.expertId : expert.id,
    expertTitle: typeof raw.expertTitle === 'string' ? raw.expertTitle : expert.title,
    verdictLine: typeof raw.verdictLine === 'string' ? raw.verdictLine : fallbackVerdict.verdictLine,
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : fallbackVerdict.reasoning,
    confidence: validConfidences.includes(raw.confidence as (typeof validConfidences)[number])
      ? (raw.confidence as 'low' | 'medium' | 'high')
      : 'medium',
    risks: Array.isArray(raw.risks) ? raw.risks.filter((r): r is string => typeof r === 'string') : [],
    nextQuestionsOrActions: Array.isArray(raw.nextQuestionsOrActions)
      ? raw.nextQuestionsOrActions.filter((a): a is string => typeof a === 'string')
      : [],
  };
}

function selectKeyMoments(log: MomentEntry[]): {
  type: 'clarity' | 'expert_join' | 'complexity';
  round: number;
  answer: string;
  question: string;
  magnitude: number;
  dimension: string;
  expertJoined: string | undefined;
}[] {
  const CLARITY_THRESHOLD = 0.08;
  const COMPLEXITY_THRESHOLD = -0.05;

  const categorized = log.flatMap((entry) => {
    const candidates: { type: 'clarity' | 'expert_join' | 'complexity'; entry: MomentEntry }[] = [];
    if (entry.expertsJoined.length > 0) candidates.push({ type: 'expert_join', entry });
    if (entry.delta >= CLARITY_THRESHOLD) candidates.push({ type: 'clarity', entry });
    else if (entry.delta <= COMPLEXITY_THRESHOLD) candidates.push({ type: 'complexity', entry });
    return candidates;
  });

  // Sort: expert_join first, then by magnitude
  const sorted = categorized.sort((a, b) => {
    if (a.type === 'expert_join' && b.type !== 'expert_join') return -1;
    if (b.type === 'expert_join' && a.type !== 'expert_join') return 1;
    return Math.abs(b.entry.delta) - Math.abs(a.entry.delta);
  });

  // Deduplicate by round, keep top 5, restore chronological order
  const seen = new Set<number>();
  return sorted
    .filter(({ entry }) => {
      if (seen.has(entry.round)) return false;
      seen.add(entry.round);
      return true;
    })
    .slice(0, 5)
    .sort((a, b) => a.entry.round - b.entry.round)
    .map(({ type, entry }) => ({
      type,
      round: entry.round,
      answer: entry.answer,
      question: entry.question,
      magnitude: Math.abs(entry.delta),
      dimension: entry.dimensionMoved,
      expertJoined: entry.expertsJoined[0],
    }));
}

async function askSmartTalkComplexFinal(
  session: Session,
  hermesIntegrated: boolean,
): Promise<{
  assistantText: string;
  finalDecision: DecideInterviewFinalDecision;
  previewCard: DecideInterviewPreviewCard;
}> {
  const fallback = fallbackFinal(session);
  const activeExperts = expertsForSession(session);
  if (!hermesIntegrated) return fallback;

  // Step 1: individual verdicts — parallel, each uses a distinct session ID
  const expertVerdicts = await Promise.all(
    activeExperts.map((expert) => askExpertIndividualVerdict(session, expert)),
  );

  // Step 2: smart_talk synthesizes all verdicts
  const keyMomentCandidates = selectKeyMoments(session.smartTalkState.momentumLog);

  const result = await hermesChatCompletion({
    sessionId: `${session.id}:smart-talk-synthesis`,
    messages: [
      { role: 'system', content: HARMENCE_SMART_TALK_SYNTHESIS_PROMPT },
      {
        role: 'user',
        content: [
          `Original question: ${initialQuestionFor(session)}`,
          `Collected answers:\n${collectedSummary(session)}`,
          `Expert verdicts:\n${JSON.stringify(expertVerdicts, null, 2)}`,
          keyMomentCandidates.length > 0
            ? `Key decision moments (ranked by impact — write one-sentence impact for each):\n${JSON.stringify(keyMomentCandidates, null, 2)}`
            : '',
        ].filter(Boolean).join('\n\n'),
      },
    ],
  });

  const withVerdicts = (fd: DecideInterviewFinalDecision) => ({ ...fd, expertVerdicts });

  if (!result.ok) return { ...fallback, finalDecision: withVerdicts(fallback.finalDecision) };

  const raw = extractJsonObject(result.content);
  if (!raw || typeof raw !== 'object') return { ...fallback, finalDecision: withVerdicts(fallback.finalDecision) };

  const candidate = raw as { assistantText?: unknown; finalDecision?: unknown; previewCard?: unknown };
  const rawFinalDecision = candidate.finalDecision && typeof candidate.finalDecision === 'object'
    ? (candidate.finalDecision as Record<string, unknown>)
    : {};
  const finalDecisionParsed = DecideInterviewFinalDecisionSchema.safeParse({
    ...rawFinalDecision,
    expertVerdicts,
    keyMoments: Array.isArray(rawFinalDecision.keyMoments) ? rawFinalDecision.keyMoments : [],
  });
  const previewCardParsed = DecideInterviewPreviewCardSchema.safeParse(candidate.previewCard);

  if (!finalDecisionParsed.success || !previewCardParsed.success) {
    return { ...fallback, finalDecision: withVerdicts(fallback.finalDecision) };
  }


  if (requiresBinaryVerdict(session) && !/^(yes|no)\b/i.test(finalDecisionParsed.data.verdictLine.trim())) {
    return { ...fallback, finalDecision: withVerdicts(fallback.finalDecision) };
  }

  return {
    assistantText:
      typeof candidate.assistantText === 'string' && candidate.assistantText.trim()
        ? candidate.assistantText.trim()
        : fallback.assistantText,
    finalDecision: finalDecisionParsed.data,
    previewCard: previewCardParsed.data,
  };
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

export async function summarizeSessionDetail(id: string): Promise<{
  id: string;
  updatedAt: number;
  bubbles: DecideInterviewBubble[];
  phase: string;
  isComplete: boolean;
  hermesIntegrated: boolean;
  activeExperts: DecideInterviewExpert[];
  choicePrompt?: DecideInterviewChoicePrompt;
  finalDecision?: DecideInterviewFinalDecision;
} | null> {
  const session = STORE.get(id);
  if (!session) return null;
  const hermesIntegrated = await hermesIntegratedFlag();

  const phase = session.lastPrompt?.id ?? (session.isComplete ? 'complete' : 'opening');

  return {
    id: session.id,
    updatedAt: session.updatedAt,
    bubbles: [...session.bubbles],
    phase,
    isComplete: session.isComplete,
    hermesIntegrated,
    activeExperts: publicExperts(session.activeExpertIds),
    choicePrompt: session.lastPrompt,
    finalDecision: session.finalDecision,
  };
}

function pickPreview(messages: DecideInterviewBubble[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'fresh Harmence intake';
  return firstUser.text.slice(0, 120).replace(/\s+/g, ' ');
}

function selectedAnswerFromPrompt(
  prompt: DecideInterviewChoicePrompt | undefined,
  selectedOptionId: string | undefined,
  userText: string,
): InterviewAnswer | null {
  if (!prompt) return null;
  const selected = selectedOptionId ? prompt.options.find((o) => o.id === selectedOptionId) : null;
  const option: DecideInterviewChoiceOption =
    selected ??
    ({
      id: selectedOptionId || `custom-${randomUUID()}`,
      label: userText || 'Custom answer',
      description: selectedOptionId && !selected ? `Custom option id: ${selectedOptionId}` : undefined,
    } satisfies DecideInterviewChoiceOption);

  return {
    promptId: prompt.id,
    question: prompt.question,
    optionId: option.id,
    label: option.label,
    description: option.description,
  };
}

/** Drive one conversational turn (+ optional bootstrap with empty body). */
export async function handleInterviewTurn(
  sessionId: string | undefined | null,
  userTextRaw: string,
  selectedOptionId?: string,
  requestedMode?: 'single' | 'complex',
): Promise<DecideInterviewTurnResponse> {
  const hermesIntegrated = await hermesIntegratedFlag();
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
      answers: [],
      activeExpertIds: [],
      isComplete: false,
      updatedAt: Date.now(),
      mode: requestedMode ?? 'single',
      smartTalkState: defaultSmartTalkState(),
    };
    STORE.set(session.id, session);
    session.bubbles.push(bubble('assistant', OPEN_GREETING));
    created = true;
  }

  session.updatedAt = Date.now();
  // Backward-compat: sessions created before mode/smartTalkState were added
  if (!session.mode) session.mode = 'single';
  if (!session.smartTalkState) session.smartTalkState = defaultSmartTalkState();

  if (created && !userText && !selectedOptionId) {
    const lastBubble = session.bubbles[session.bubbles.length - 1]!;
    return DecideInterviewTurnResponseSchema.parse({
      sessionId: session.id,
      bubbles: [lastBubble],
      phase: 'initial_question',
      isComplete: false,
      hermesIntegrated,
      mode: session.mode,
      activeExperts: publicExperts(session.activeExpertIds),
      newlyActivatedExperts: [],
      suggestedDraftHints: undefined,
    });
  }

  if (!created && sessionId && !userText && !selectedOptionId && session.bubbles.length > 0) {
    const last =
      [...session.bubbles].filter((m) => m.role === 'assistant').at(-1) ?? session.bubbles.at(-1)!;
    return DecideInterviewTurnResponseSchema.parse({
      sessionId: session.id,
      bubbles: [last],
      phase: session.lastPrompt?.id ?? 'complete',
      isComplete: session.isComplete,
      hermesIntegrated,
      mode: session.mode,
      ambiguity: session.smartTalkState.ambiguity,
      activeExperts: publicExperts(session.activeExpertIds),
      newlyActivatedExperts: [],
      suggestedDraftHints: undefined,
      choicePrompt: session.lastPrompt,
    });
  }

  if (!userText && !selectedOptionId) {
    const last = session.bubbles.at(-1)!;
    return DecideInterviewTurnResponseSchema.parse({
      sessionId: session.id,
      bubbles: [last],
      phase: session.lastPrompt?.id ?? 'awaiting_choice',
      isComplete: false,
      hermesIntegrated,
      mode: session.mode,
      ambiguity: session.smartTalkState.ambiguity,
      activeExperts: publicExperts(session.activeExpertIds),
      newlyActivatedExperts: [],
      suggestedDraftHints: undefined,
      choicePrompt: session.lastPrompt,
    });
  }

  const answer = selectedAnswerFromPrompt(session.lastPrompt, selectedOptionId, userText);
  let latestText = userText;
  if (answer) {
    session.answers.push(answer);
    latestText = answer.label;
    session.bubbles.push(bubble('user', answer.label));
  } else if (userText) {
    recordInitialQuestion(session, userText);
    session.bubbles.push(bubble('user', userText));
    // Lock domain skills for smart_talk on the first real message
    if (session.activeExpertIds.length === 0) {
      const matched = selectExpertsFromText(userText);
      if (session.mode === 'single') {
        const top = matched[0];
        session.activeExpertIds = top ? [top.id] : ['general-decision'];
      } else {
        session.activeExpertIds = matched.length > 0 ? matched.map((e) => e.id) : ['general-decision'];
      }
    }
  }

  let assistantText = '';
  let phase = 'complete';
  let suggestedDraftHints: DecideInterviewDraftHints | undefined;
  let choicePrompt: DecideInterviewChoicePrompt | undefined;
  let finalDecision: DecideInterviewFinalDecision | undefined;
  let previewCard: DecideInterviewPreviewCard | undefined;
  let activeExperts: DecideInterviewExpert[] = publicExperts(session.activeExpertIds);
  let newlyActivatedExperts: DecideInterviewExpert[] = [];
  let assistantMeta: Partial<Pick<DecideInterviewBubble, 'expertId' | 'expertTitle' | 'expertIcon' | 'expertColor' | 'supportingExpertIds'>> = {};

  if (initialQuestionFor(session)) {
    const next = await askSmartTalkForNextChoice(session, latestText, hermesIntegrated);
    activeExperts = next.activeExperts.map(publicExpert);
    newlyActivatedExperts = next.newlyActivatedExperts.map(publicExpert);
    if (!next.readyForFinal && next.choicePrompt) {
      assistantText = next.assistantText;
      choicePrompt = next.choicePrompt;
      phase = choicePrompt.id;
      session.lastPrompt = choicePrompt;
      assistantMeta = expertBubbleMeta(next.speaker, next.supporting);
    } else {
      const final = session.mode === 'complex'
        ? await askSmartTalkComplexFinal(session, hermesIntegrated)
        : hermesIntegrated ? await askHermesForFinal(session) : fallbackFinal(session);
      assistantText = [
        final.assistantText,
        ``,
        `**${final.finalDecision.verdictLine}**`,
        final.finalDecision.recommendation,
        ``,
        final.finalDecision.rationale,
        final.finalDecision.nextSteps.length
          ? `\nNext steps:\n${final.finalDecision.nextSteps.map((s) => `• ${s}`).join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
      finalDecision = final.finalDecision;
      previewCard = final.previewCard;
      suggestedDraftHints = summarizeDraft(session, previewCard);
      session.lastPrompt = undefined;
      session.isComplete = true;
      session.finalDecision = finalDecision;
      phase = 'complete';
      assistantMeta = expertBubbleMeta(next.speaker, next.supporting);
    }
  } else {
    const nextDefaultPrompt = nextFallbackPrompt(session);
    if (nextDefaultPrompt) {
      const next = isSpecialistPrompt(nextDefaultPrompt)
        ? { assistantText: specialistTransition(nextDefaultPrompt, session), choicePrompt: nextDefaultPrompt }
        : hermesIntegrated
          ? await askHermesForNextChoice(session, nextDefaultPrompt)
          : { assistantText: `Got it. Next, let's sharpen the frame.`, choicePrompt: nextDefaultPrompt };
      assistantText = next.assistantText;
      choicePrompt = next.choicePrompt;
      phase = choicePrompt.id;
      session.lastPrompt = choicePrompt;
      const activePlaybook = playbookForSession(session);
      if (activePlaybook) session.playbookId = activePlaybook.id;
    } else {
      const final = hermesIntegrated ? await askHermesForFinal(session) : fallbackFinal(session);
      assistantText = [
        final.assistantText,
        ``,
        `**${final.finalDecision.verdictLine}**`,
        final.finalDecision.recommendation,
        ``,
        final.finalDecision.rationale,
        final.finalDecision.nextSteps.length
          ? `\nNext steps:\n${final.finalDecision.nextSteps.map((s) => `• ${s}`).join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
      finalDecision = final.finalDecision;
      previewCard = final.previewCard;
      suggestedDraftHints = summarizeDraft(session, previewCard);
      session.lastPrompt = undefined;
      session.isComplete = true;
      session.finalDecision = finalDecision;
      phase = 'complete';
    }
  }

  session.bubbles.push(bubble('assistant', assistantText, assistantMeta));

  if (process.env.DEBUG && process.env.NODE_ENV !== 'production') {
    console.debug('[harmence-turn] choicePromptId:', choicePrompt?.id);
    console.debug('[harmence-turn] activeExperts:', activeExperts.map((e) => `${e.id}(${e.skillName})`).join(', '));
    console.debug('[harmence-turn] readyForFinal:', !choicePrompt, '| answerCount:', session.answers.filter((a) => a.promptId !== 'initial_question').length);
    console.debug('[harmence-turn] ambiguity:', session.smartTalkState.ambiguity.toFixed(3), '| scores:', JSON.stringify(session.smartTalkState.scores));
  }

  return DecideInterviewTurnResponseSchema.parse({
    sessionId: session.id,
    bubbles: session.bubbles.slice(-2),
    phase,
    isComplete: !choicePrompt,
    hermesIntegrated,
    mode: session.mode,
    ambiguity: session.smartTalkState.ambiguity,
    activeExperts,
    newlyActivatedExperts,
    suggestedDraftHints,
    choicePrompt,
    finalDecision,
    previewCard,
  });
}
