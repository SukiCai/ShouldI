import type { DiscoveredExpert, ExpertCatalogEntry } from '@shouldi/contracts';

const DEMO_NOW = Date.UTC(2026, 6, 10, 12, 0, 0);

function expertRow(
  entry: {
    id: string;
    title: string;
    subtitle?: string;
    skillName: string;
    icon: string;
    color: string;
  },
): DiscoveredExpert['expert'] {
  return {
    id: entry.id,
    title: entry.title,
    subtitle: entry.subtitle,
    skillName: entry.skillName,
    icon: entry.icon,
    color: entry.color,
  };
}

/** Demo lens progress — shown when profile demo mode is active. */
export const PROFILE_DEMO_LENS_EXPERTS: DiscoveredExpert[] = [
  {
    expertId: 'career-coop',
    expert: expertRow({
      id: 'career-coop',
      title: 'Co-op Career Strategist',
      subtitle: 'Offer quality, team signal, recruiting trade-offs',
      skillName: 'intl-job-search',
      icon: 'briefcase-outline',
      color: '#38BDF8',
    }),
    frameworkLabel: 'Opportunity cost',
    discoveryBlurb: 'Compares this offer against realistic alternatives and recruiting windows—not just the logo.',
    activationInstruction: 'Use when weighing internship or co-op offers against your pipeline.',
    status: 'applied',
    firstDiscoveredAt: DEMO_NOW - 12 * 86_400_000,
    lastUsedAt: DEMO_NOW - 2 * 86_400_000,
    sessionCount: 3,
    decisionRecordIds: ['mock-stripe-offer'],
    lastSessionId: 'demo-session-coop',
  },
  {
    expertId: 'pm-career',
    expert: expertRow({
      id: 'pm-career',
      title: 'PM Career Expert',
      subtitle: 'Scope, title, growth path, promotion logic',
      skillName: 'pm-career-expert',
      icon: 'analytics-outline',
      color: '#A78BFA',
    }),
    frameworkLabel: 'Career compounding',
    discoveryBlurb: 'Evaluates scope, title, and org ceiling against long-term product leadership growth.',
    activationInstruction: 'Use when promotion, scope, or title tradeoffs dominate the decision.',
    status: 'calibrated',
    firstDiscoveredAt: DEMO_NOW - 20 * 86_400_000,
    lastUsedAt: DEMO_NOW - 5 * 86_400_000,
    sessionCount: 5,
    decisionRecordIds: ['mock-stripe-offer', 'mock-grad-school'],
    lastSessionId: 'demo-session-pm',
  },
  {
    expertId: 'grad-school',
    expert: expertRow({
      id: 'grad-school',
      title: 'Grad School Advisor',
      subtitle: 'PhD vs Masters, advisor fit, funding, immigration runway',
      skillName: 'grad-school-advisor',
      icon: 'school-outline',
      color: '#818CF8',
    }),
    frameworkLabel: 'Education ROI',
    discoveryBlurb: 'Models funding, advisor fit, and immigration runway—not just program rank.',
    activationInstruction: 'Use when comparing programs, advisors, or funding packages.',
    status: 'discovered',
    firstDiscoveredAt: DEMO_NOW - 4 * 86_400_000,
    lastUsedAt: DEMO_NOW - 4 * 86_400_000,
    sessionCount: 1,
    decisionRecordIds: [],
    lastSessionId: 'demo-session-grad',
  },
  {
    expertId: 'intl-student',
    expert: expertRow({
      id: 'intl-student',
      title: 'International Student Advisor',
      subtitle: 'Study permit, work authorization, immigration path risk',
      skillName: 'intl-student-advisor',
      icon: 'earth-outline',
      color: '#34D399',
    }),
    frameworkLabel: 'Risk & immigration path',
    discoveryBlurb: 'Surfaces visa, work authorization, and timeline risk before career recommendations land.',
    activationInstruction: 'Use when status, visa, or work authorization shapes the choice.',
    status: 'applied',
    firstDiscoveredAt: DEMO_NOW - 30 * 86_400_000,
    lastUsedAt: DEMO_NOW - 7 * 86_400_000,
    sessionCount: 4,
    decisionRecordIds: ['mock-stripe-offer'],
    lastSessionId: 'demo-session-intl',
  },
  {
    expertId: 'relationship',
    expert: expertRow({
      id: 'relationship',
      title: 'Relationship Decision Expert',
      subtitle: 'Attachment, trust, repairability, boundaries',
      skillName: 'smart_talk',
      icon: 'heart-outline',
      color: '#FB7185',
    }),
    frameworkLabel: 'Relationship patterns',
    discoveryBlurb: 'Separates repairable conflict from repeated trust breaks and safety concerns.',
    activationInstruction: 'Use when trust, repair, or boundaries are central to the decision.',
    status: 'calibrated',
    firstDiscoveredAt: DEMO_NOW - 45 * 86_400_000,
    lastUsedAt: DEMO_NOW - 14 * 86_400_000,
    sessionCount: 2,
    decisionRecordIds: ['mock-nyc-move'],
    lastSessionId: 'demo-session-rel',
  },
];

/** stay-or-return is intentionally absent — demo silhouette in career group. */
export const PROFILE_DEMO_TOTAL_COLLECTIBLE = 6;

/** Offline catalog fallback for demo lens library when API is unavailable. */
export const PROFILE_DEMO_CATALOG: ExpertCatalogEntry[] = [
  {
    id: 'general-decision',
    title: 'Decision Strategist',
    skillName: 'smart_talk',
    icon: 'sparkles-outline',
    color: '#2DD4BF',
    frameworkId: 'decision-framing',
    frameworkLabel: 'Decision framing',
    discoveryBlurb: 'Clarifies stakes, constraints, and what would change the answer before you commit.',
    lensDomain: 'general',
  },
  {
    id: 'career-coop',
    title: 'Co-op Career Strategist',
    skillName: 'intl-job-search',
    icon: 'briefcase-outline',
    color: '#38BDF8',
    frameworkId: 'opportunity-cost',
    frameworkLabel: 'Opportunity cost',
    discoveryBlurb: 'Compares this offer against realistic alternatives and recruiting windows—not just the logo.',
    lensDomain: 'career',
  },
  {
    id: 'intl-student',
    title: 'International Student Advisor',
    skillName: 'intl-student-advisor',
    icon: 'earth-outline',
    color: '#34D399',
    frameworkId: 'risk-budgeting',
    frameworkLabel: 'Risk & immigration path',
    discoveryBlurb: 'Surfaces visa, work authorization, and timeline risk before career recommendations land.',
    lensDomain: 'career',
  },
  {
    id: 'stay-or-return',
    title: 'Stay or Return Advisor',
    skillName: 'stay-or-return',
    icon: 'airplane-outline',
    color: '#F59E0B',
    frameworkId: 'regret-minimization',
    frameworkLabel: 'Regret minimization',
    discoveryBlurb: 'Frames stay-vs-return as a long-horizon compounding question—not a mood-of-the-moment call.',
    lensDomain: 'career',
  },
  {
    id: 'pm-career',
    title: 'PM Career Expert',
    skillName: 'pm-career-expert',
    icon: 'analytics-outline',
    color: '#A78BFA',
    frameworkId: 'career-compounding',
    frameworkLabel: 'Career compounding',
    discoveryBlurb: 'Evaluates scope, title, and org ceiling against long-term product leadership growth.',
    lensDomain: 'career',
  },
  {
    id: 'grad-school',
    title: 'Grad School Advisor',
    skillName: 'grad-school-advisor',
    icon: 'school-outline',
    color: '#818CF8',
    frameworkId: 'expected-value',
    frameworkLabel: 'Education ROI',
    discoveryBlurb: 'Models funding, advisor fit, and immigration runway—not just program rank.',
    lensDomain: 'career',
  },
  {
    id: 'relationship',
    title: 'Relationship Decision Expert',
    skillName: 'smart_talk',
    icon: 'heart-outline',
    color: '#FB7185',
    frameworkId: 'attachment-repair',
    frameworkLabel: 'Relationship patterns',
    discoveryBlurb: 'Separates repairable conflict from repeated trust breaks and safety concerns.',
    lensDomain: 'relationship',
  },
];
