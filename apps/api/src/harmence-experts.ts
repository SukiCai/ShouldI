import type { DecideInterviewExpert } from '@shouldi/contracts';

export type HarmenceExpert = DecideInterviewExpert & {
  priority: number;
  triggerPatterns: RegExp[];
  activationInstruction: string;
};

export const HARMENCE_EXPERTS: HarmenceExpert[] = [
  {
    id: 'general-decision',
    title: 'Decision Strategist',
    subtitle: 'Decision framing, trade-offs, hidden constraints',
    skillName: 'smart_talk',
    icon: 'sparkles-outline',
    color: '#2DD4BF',
    priority: 10,
    triggerPatterns: [],
    activationInstruction:
      'Use a general decision-strategy lens: clarify the choice, stakes, constraints, downside, reversibility, and what would change the answer.',
  },
  {
    id: 'career-coop',
    title: 'Co-op Career Strategist',
    subtitle: 'Offer quality, team signal, recruiting trade-offs',
    skillName: 'intl-job-search',
    icon: 'briefcase-outline',
    color: '#38BDF8',
    priority: 90,
    triggerPatterns: [/\bco-?op\b/i, /\bintern(ship)?\b/i, /\boffer\b/i, /\bplacement\b/i],
    activationInstruction:
      'Use the intl-job-search skill to evaluate co-op/internship offer quality, employer signal, recruiting timeline, sponsorship execution, and realistic alternatives.',
  },
  {
    id: 'intl-student',
    title: 'International Student Advisor',
    subtitle: 'Study permit, work authorization, immigration path risk',
    skillName: 'intl-student-advisor',
    icon: 'earth-outline',
    color: '#34D399',
    priority: 100,
    triggerPatterns: [
      /\binternational\b/i,
      /\bstudy permit\b/i,
      /\bco-?op permit\b/i,
      /\bvisa\b/i,
      /\bimmigration\b/i,
      /\bPR\b/,
      /\bOPT\b/i,
      /\bH-?1B\b/i,
      /\bPGWP\b/i,
      /国际生|留学|学签|工签|移民|身份|枫叶卡|绿卡/,
    ],
    activationInstruction:
      'Use the intl-student-advisor skill. Diagnose country, current status, target country, timeline, work authorization, and immigration-security trade-offs before making career recommendations.',
  },
  {
    id: 'stay-or-return',
    title: 'Stay or Return Advisor',
    subtitle: '10-year trajectory, savings rate, immigration trap',
    skillName: 'stay-or-return',
    icon: 'airplane-outline',
    color: '#F59E0B',
    priority: 95,
    triggerPatterns: [
      /\bstay or return\b/i,
      /\bgo back\b/i,
      /\breturn home\b/i,
      /\bIndian backlog\b/i,
      /\b(EB-2|EB-3).*backlog\b/i,
      /回国|要不要回|回去还是留|留下来还是|绿卡.*等太久|值不值得留/,
    ],
    activationInstruction:
      'Use the stay-or-return skill. Frame as a 10-year compounding question across career, financial, immigration, and relational dimensions — not a current-conditions comparison. Diagnose visa category and realistic GC timeline, actual savings rate, entrepreneurship intent, and whether the conclusion is driven by analysis or fear of failure.',
  },
  {
    id: 'pm-career',
    title: 'PM Career Expert',
    subtitle: 'Scope, title, growth path, promotion logic',
    skillName: 'pm-career-expert',
    icon: 'analytics-outline',
    color: '#A78BFA',
    priority: 70,
    triggerPatterns: [/\bPM\b/i, /\bproduct manager\b/i, /\bpromotion\b/i, /\bscope\b/i, /\bMBA\b/i],
    activationInstruction:
      'Use the pm-career-expert skill to evaluate scope, title, career growth, org ceiling vs skill gap, and long-term compounding.',
  },
  {
    id: 'grad-school',
    title: 'Grad School Advisor',
    subtitle: 'PhD vs Masters, advisor fit, funding, immigration runway',
    skillName: 'grad-school-advisor',
    icon: 'school-outline',
    color: '#818CF8',
    priority: 85,
    triggerPatterns: [
      /\bPhD\b/i,
      /\bmaster'?s?\b/i,
      /\bgrad(uate)?\s*(school|program|degree)\b/i,
      /\bdoctorate\b/i,
      /\badvisor\b.*\bprogram\b/i,
      /\bfunded\b.*\b(PhD|program|offer)\b/i,
      /\bSOP\b/i,
      /\bNSF\s*GRFP\b/i,
      /读研|读博|研究生|申请.*学校|导师|硕士|博士|offer.*项目/,
    ],
    activationInstruction:
      'Use the grad-school-advisor skill. Never give program advice before establishing research clarity, citizenship/immigration status, target geography, and funding structure. Evaluate at the advisor level, not program rank. For international students, model STEM OPT eligibility and PhD-as-immigration-runway explicitly.',
  },
  {
    id: 'relationship',
    title: 'Relationship Decision Expert',
    subtitle: 'Attachment, trust, repairability, boundaries',
    skillName: 'smart_talk',
    icon: 'heart-outline',
    color: '#FB7185',
    priority: 80,
    triggerPatterns: [
      /\bpartner\b/i,
      /\bboyfriend\b/i,
      /\bgirlfriend\b/i,
      /\bspouse\b/i,
      /\bmarriage\b/i,
      /\brelationship\b/i,
      /\bbreak ?up\b/i,
      /\bdivorce\b/i,
      /\btrust\b/i,
      /\bcheat(ed|ing)?\b/i,
      /分手|伴侣|男朋友|女朋友|婚姻|离婚|信任|出轨|复合/,
    ],
    activationInstruction:
      'Use a relationship decision skill: diagnose repairability, safety, trust, repeated patterns, unmet needs, boundaries, attachment pressure, and what evidence would change the answer. Do not use career or offer framing.',
  },
];

export function publicExpert(expert: HarmenceExpert): DecideInterviewExpert {
  return {
    id: expert.id,
    title: expert.title,
    subtitle: expert.subtitle,
    skillName: expert.skillName,
    icon: expert.icon,
    color: expert.color,
  };
}

export function expertById(id: string): HarmenceExpert | undefined {
  return HARMENCE_EXPERTS.find((expert) => expert.id === id);
}

export function expertBySkillName(skillName: string): HarmenceExpert | undefined {
  return HARMENCE_EXPERTS
    .filter((expert) => expert.skillName === skillName)
    .sort((a, b) => b.priority - a.priority)[0];
}

export function publicExperts(ids: string[]): DecideInterviewExpert[] {
  return ids.map((id) => expertById(id)).filter((x): x is HarmenceExpert => !!x).map(publicExpert);
}

export function selectExpertsFromText(text: string): HarmenceExpert[] {
  const matched = HARMENCE_EXPERTS.filter((expert) =>
    expert.triggerPatterns.some((pattern) => pattern.test(text)),
  ).sort((a, b) => b.priority - a.priority);

  if (matched.length > 0) return matched;

  return HARMENCE_EXPERTS.filter((expert) => expert.id === 'general-decision');
}

export function mergeExpertIds(existing: string[], additions: HarmenceExpert[]): string[] {
  const seen = new Set(existing);
  for (const expert of additions) seen.add(expert.id);
  return Array.from(seen)
    .map((id) => expertById(id) ?? additions.find((expert) => expert.id === id))
    .filter((x): x is HarmenceExpert => !!x)
    .sort((a, b) => b.priority - a.priority)
    .map((expert) => expert.id);
}

export function expertPrelude(experts: HarmenceExpert[]): string {
  return experts
    .map((expert) =>
      [
        `Expert: ${expert.title}`,
        `Hermes skill: ${expert.skillName}`,
        `Activation: ${expert.activationInstruction}`,
      ].join('\n'),
    )
    .join('\n\n');
}
