import type { Ionicons } from '@expo/vector-icons';

import { PROFILE_DEMO_AVATAR } from '@/constants/users/avatarSources';
import type { DecisionDnaProfile, DecisionRecord } from '@shouldi/contracts';

export type ProfileStatMock = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  value: string;
  label: string;
  hint: string;
};

export type ProfileDnaDimensionMock = {
  label: string;
  value: number;
  level: 'High' | 'Medium' | 'Low';
};

export type ProfileRecentDecisionStatus = 'in_progress' | 'needs_outcome' | 'decided';

export type ProfileRecentDecisionMock = {
  id: string;
  title: string;
  categoryLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  whenLabel: string;
  status: ProfileRecentDecisionStatus;
};

export type ProfileGrowthCardMock = {
  id: string;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  tone: 'strength' | 'growth' | 'focus';
};

/** Static profile demo — pixel-matched to the mobile Profile design mock. */
export const PROFILE_MOCK = {
  displayName: 'Eleanor Park',
  avatarEmoji: '✨',
  avatarSource: PROFILE_DEMO_AVATAR,
  isPremium: true,
  decisionsCount: 47,
  memberSinceLabel: 'Member since May 2024',
  quote: 'I use ShouldI to think clearer so I can act with confidence.',
  stats: [
    {
      icon: 'checkmark-circle',
      iconColor: '#8b5cf6',
      iconBg: '#8b5cf618',
      value: '47',
      label: 'Decisions',
      hint: '↑ 12 this month',
    },
    {
      icon: 'locate',
      iconColor: '#4a7bd8',
      iconBg: '#4a7bd818',
      value: '78%',
      label: 'Followed through',
      hint: 'Above average',
    },
    {
      icon: 'trending-up',
      iconColor: '#8b5cf6',
      iconBg: '#8b5cf618',
      value: '0.71',
      label: 'Calibration',
      hint: '↗ Improving',
    },
    {
      icon: 'flame',
      iconColor: '#e07b54',
      iconBg: '#e07b5418',
      value: '6',
      label: 'Day streak',
      hint: 'Keep it going!',
    },
  ] satisfies ProfileStatMock[],
  dnaSummary:
    'You seek clarity, take time to decide, and prefer considered risks over impulsive ones.',
  dnaDimensions: [
    { label: 'Clarity', value: 0.82, level: 'High' },
    { label: 'Long-term', value: 0.88, level: 'High' },
    { label: 'Risk tolerance', value: 0.55, level: 'Medium' },
    { label: 'Decisiveness', value: 0.62, level: 'Medium' },
    { label: 'Social influence', value: 0.38, level: 'Low' },
    { label: 'Flexibility', value: 0.74, level: 'High' },
  ] satisfies ProfileDnaDimensionMock[],
  recentDecisions: [
    {
      id: 'mock-stripe-offer',
      title: 'Job offer at Stripe',
      categoryLabel: 'Career',
      icon: 'briefcase',
      iconColor: '#56b37c',
      iconBg: '#ebf8f0',
      whenLabel: '2 days ago',
      status: 'needs_outcome',
    },
    {
      id: 'mock-grad-school',
      title: 'Apply to grad school?',
      categoryLabel: 'Education',
      icon: 'school',
      iconColor: '#4a7bd8',
      iconBg: '#ebf2ff',
      whenLabel: '5 days ago',
      status: 'in_progress',
    },
    {
      id: 'mock-nyc-move',
      title: 'Move back to NYC?',
      categoryLabel: 'Life',
      icon: 'home',
      iconColor: '#8b5cf6',
      iconBg: '#f2edff',
      whenLabel: '1 week ago',
      status: 'decided',
    },
    {
      id: 'mock-index-funds',
      title: 'Invest more in index funds?',
      categoryLabel: 'Finance',
      icon: 'logo-usd',
      iconColor: '#c9a227',
      iconBg: '#fff8e4',
      whenLabel: '2 weeks ago',
      status: 'decided',
    },
  ] satisfies ProfileRecentDecisionMock[],
  growthCards: [
    {
      id: 'strengths',
      title: 'Strengths',
      body: 'Great at research and follow-through.',
      icon: 'search-outline',
      iconColor: '#3d9a6e',
      iconBg: '#e6f4ec',
      tone: 'strength',
    },
    {
      id: 'growth',
      title: 'Growth opportunities',
      body: 'Challenge confirmation bias and overplanning.',
      icon: 'trending-up-outline',
      iconColor: '#c4773a',
      iconBg: '#faf0e6',
      tone: 'growth',
    },
    {
      id: 'focus',
      title: 'Focus next',
      body: 'Continue improving your calibration.',
      icon: 'locate-outline',
      iconColor: '#8b5cf6',
      iconBg: '#f2edff',
      tone: 'focus',
    },
  ] satisfies ProfileGrowthCardMock[],
} as const;

const DEMO_NOW = Date.UTC(2026, 6, 10, 12, 0, 0);

/** Synthetic decision records so the Next Step card can target Outcome Replay in demo mode. */
export const PROFILE_DEMO_DECISIONS: DecisionRecord[] = [
  {
    id: 'mock-stripe-offer',
    question: 'Job offer at Stripe',
    category: 'career',
    recommendation: 'Negotiate scope, then accept if the role matches your growth goals.',
    rationale: 'Strong brand, comp, and team fit outweigh relocation friction.',
    confidenceScore: 74,
    tradeoffs: ['Higher cost of living', 'Leaving current network'],
    expertIdsUsed: ['pm-career'],
    committedAction: 'Accepted after negotiation',
    createdAt: DEMO_NOW - 2 * 86_400_000,
    updatedAt: DEMO_NOW - 86_400_000,
  },
  {
    id: 'mock-grad-school',
    question: 'Apply to grad school?',
    category: 'career',
    recommendation: 'Apply to two programs and defer until you finish your current project.',
    rationale: 'Timing is tight, but the upside warrants a structured application sprint.',
    confidenceScore: 61,
    tradeoffs: ['Application cost', 'Time away from work'],
    expertIdsUsed: ['grad-school'],
    createdAt: DEMO_NOW - 5 * 86_400_000,
    updatedAt: DEMO_NOW - 4 * 86_400_000,
  },
  {
    id: 'mock-nyc-move',
    question: 'Move back to NYC?',
    category: 'life',
    recommendation: 'Stay put for six months, then reassess with clearer job constraints.',
    rationale: 'Short-term stability matters more than an immediate geography change.',
    confidenceScore: 68,
    tradeoffs: ['Higher rent in NYC', 'Distance from family'],
    expertIdsUsed: ['stay-or-return'],
    committedAction: 'Staying for now',
    createdAt: DEMO_NOW - 7 * 86_400_000,
    updatedAt: DEMO_NOW - 6 * 86_400_000,
  },
  {
    id: 'mock-index-funds',
    question: 'Invest more in index funds?',
    category: 'money',
    recommendation: 'Increase monthly contributions by a modest fixed amount.',
    rationale: 'Diversified index exposure fits your long-term risk profile.',
    confidenceScore: 71,
    tradeoffs: ['Less cash on hand', 'Market volatility'],
    expertIdsUsed: [],
    committedAction: 'Increased monthly contribution',
    createdAt: DEMO_NOW - 14 * 86_400_000,
    updatedAt: DEMO_NOW - 13 * 86_400_000,
  },
];

export const PROFILE_DEMO_DNA: DecisionDnaProfile = {
  userId: 'demo-user',
  values: ['Clarity', 'Long-term thinking'],
  riskPreference: 'medium',
  blindSpots: ['Challenge confirmation bias and overplanning.'],
  calibrationScore: 71,
  trajectory: [
    'You seek clarity, take time to decide, and prefer considered risks over impulsive ones.',
    'Great at research and follow-through.',
  ],
  updatedAt: DEMO_NOW,
};

/** Use demo copy when the API has not returned any decisions yet. */
export const PROFILE_DEMO_WHEN_EMPTY = true;
