import type { Ionicons } from '@expo/vector-icons';

import { exploreCategoryTheme } from '@/components/explore/exploreCategoryTheme';
import type { DecisionDnaProfile, DecisionRecord } from '@shouldi/contracts';

import { statChromatic, growthChromatic, type ProfileGrowthTone, type ProfileStatTone } from '@/lib/profileChromatic';
import {
  calibrationTrendHint,
  followThroughHint,
  followThroughRate,
  formatCalibrationScore,
} from '@/lib/profileStats';
import type {
  ProfileDnaDimensionMock,
  ProfileGrowthCardMock,
  ProfileRecentDecisionMock,
  ProfileStatMock,
} from '@/lib/profileMockData';
import { PROFILE_DEMO_DNA, PROFILE_DEMO_DECISIONS, PROFILE_DEMO_WHEN_EMPTY, PROFILE_MOCK } from '@/lib/profileMockData';

export const DNA_RADAR_MIN_DECISIONS = 3;

export type ProfileStatDestination = 'replay' | 'decide';

export type ProfileMomentumStat = ProfileStatMock & {
  tone: ProfileStatTone;
  destination: ProfileStatDestination;
};

function formatRelativeWhen(ts: number): string {
  const delta = Date.now() - ts;
  const days = Math.floor(delta / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(ts));
  } catch {
    return 'Earlier';
  }
}

export function formatMemberSince(decisions: DecisionRecord[]): string {
  const earliest = decisions.reduce<number | null>((min, row) => {
    if (!Number.isFinite(row.createdAt)) return min;
    return min == null ? row.createdAt : Math.min(min, row.createdAt);
  }, null);
  if (earliest == null) return 'Member recently';
  try {
    return `Member since ${new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(earliest))}`;
  } catch {
    return 'Member recently';
  }
}

function isDecisionDecided(decision: DecisionRecord): boolean {
  return Boolean(decision.committedAction?.trim()) || decision.updatedAt - decision.createdAt > 86_400_000;
}

export function mapDecisionToRecentRow(decision: DecisionRecord): ProfileRecentDecisionMock {
  const theme = exploreCategoryTheme(decision.category ?? 'life');
  const iconName = theme.icon.endsWith('-outline')
    ? (theme.icon as keyof typeof Ionicons.glyphMap)
    : (`${theme.icon}-outline` as keyof typeof Ionicons.glyphMap);
  return {
    id: decision.id,
    title: decision.question,
    categoryLabel: theme.label,
    icon: iconName,
    iconColor: theme.accent,
    iconBg: theme.soft,
    whenLabel: formatRelativeWhen(decision.createdAt),
    status: isDecisionDecided(decision) ? 'decided' : 'in_progress',
  };
}

export function buildDemoMomentumStats(): ProfileMomentumStat[] {
  const followColors = statChromatic('followThrough');
  const calibrationColors = statChromatic('calibration');

  return [
    {
      icon: 'locate',
      ...followColors,
      value: '78%',
      label: 'Followed through',
      hint: 'Above average',
      tone: 'followThrough',
      destination: 'replay',
    },
    {
      icon: 'trending-up',
      ...calibrationColors,
      value: '0.71',
      label: 'Calibration',
      hint: '↗ Improving',
      tone: 'calibration',
      destination: 'replay',
    },
  ];
}

export type ResolvedProfileScreen = {
  useDemo: boolean;
  displayName: string;
  isPremium: boolean;
  decisionsCount: number;
  memberSinceLabel: string;
  decisions: DecisionRecord[];
  dna?: DecisionDnaProfile;
  momentumStats: ProfileMomentumStat[];
  recentDecisions: ProfileRecentDecisionMock[];
  growthCards: ProfileGrowthCardMock[];
  dnaSummary: string;
  dnaDimensions: ProfileDnaDimensionMock[];
};

export function shouldUseProfileDemo(
  decisions: DecisionRecord[],
  decisionsReady: boolean,
): boolean {
  return PROFILE_DEMO_WHEN_EMPTY && decisionsReady && decisions.length === 0;
}

export function resolveProfileScreen({
  decisions,
  dna,
  isPremium,
  decisionsReady,
}: {
  decisions: DecisionRecord[];
  dna?: DecisionDnaProfile;
  isPremium: boolean;
  decisionsReady: boolean;
}): ResolvedProfileScreen {
  const useDemo = shouldUseProfileDemo(decisions, decisionsReady);

  if (useDemo) {
    const demoDna = PROFILE_DEMO_DNA;
    return {
      useDemo: true,
      displayName: PROFILE_MOCK.displayName,
      isPremium: PROFILE_MOCK.isPremium,
      decisionsCount: PROFILE_MOCK.decisionsCount,
      memberSinceLabel: PROFILE_MOCK.memberSinceLabel,
      decisions: PROFILE_DEMO_DECISIONS,
      dna: demoDna,
      momentumStats: buildDemoMomentumStats(),
      recentDecisions: [...PROFILE_MOCK.recentDecisions],
      growthCards: [...PROFILE_MOCK.growthCards],
      dnaSummary: PROFILE_MOCK.dnaSummary,
      dnaDimensions: [...PROFILE_MOCK.dnaDimensions],
    };
  }

  const decisionsCount = decisions.length;
  return {
    useDemo: false,
    displayName: 'You',
    isPremium,
    decisionsCount,
    memberSinceLabel: formatMemberSince(decisions),
    decisions,
    dna,
    momentumStats: buildMomentumStats(decisions, dna?.calibrationScore),
    recentDecisions: recentDecisionRows(decisions),
    growthCards: buildGrowthCards(dna),
    dnaSummary: resolveDnaSummary(dna),
    dnaDimensions: resolveDnaDimensions(decisionsCount),
  };
}

export function buildMomentumStats(
  decisions: DecisionRecord[],
  calibrationScore?: number,
): ProfileMomentumStat[] {
  const followRate = followThroughRate(decisions);
  const followColors = statChromatic('followThrough');
  const calibrationColors = statChromatic('calibration');

  return [
    {
      icon: 'locate',
      ...followColors,
      value: followRate != null ? `${followRate}%` : '—',
      label: 'Followed through',
      hint: followThroughHint(followRate),
      tone: 'followThrough',
      destination: 'replay',
    },
    {
      icon: 'trending-up',
      ...calibrationColors,
      value: formatCalibrationScore(calibrationScore),
      label: 'Calibration',
      hint: calibrationTrendHint(calibrationScore),
      tone: 'calibration',
      destination: 'replay',
    },
  ];
}

export function resolveDnaSummary(dna?: DecisionDnaProfile): string {
  const trajectory = dna?.trajectory?.[0]?.trim();
  if (trajectory) return trajectory;
  if (decisionsCountFromDna(dna) > 0) {
    return 'Your patterns update as you complete decisions and log outcomes.';
  }
  return PROFILE_MOCK.dnaSummary;
}

function decisionsCountFromDna(dna?: DecisionDnaProfile): number {
  return dna?.trajectory?.length ?? 0;
}

export function resolveDnaDimensions(decisionsCount: number): ProfileDnaDimensionMock[] {
  if (decisionsCount < DNA_RADAR_MIN_DECISIONS) return [];
  return [...PROFILE_MOCK.dnaDimensions];
}

export function buildGrowthCards(dna?: DecisionDnaProfile): ProfileGrowthCardMock[] {
  const strengthBody =
    dna?.trajectory[0]?.trim() ?? 'Great at research and follow-through.';
  const growthBody =
    dna?.blindSpots[0]?.trim() ?? 'Challenge confirmation bias and overplanning.';
  const focusBody =
    dna?.calibrationScore != null && dna.calibrationScore >= 55
      ? 'Continue improving your calibration.'
      : 'Log outcomes to sharpen calibration.';

  const cards: Array<Omit<ProfileGrowthCardMock, 'iconColor' | 'iconBg'> & { tone: ProfileGrowthTone }> = [
    {
      id: 'strengths',
      title: 'Strengths',
      body: strengthBody,
      icon: 'search-outline',
      tone: 'strength',
    },
    {
      id: 'growth',
      title: 'Growth opportunities',
      body: growthBody,
      icon: 'trending-up-outline',
      tone: 'growth',
    },
    {
      id: 'focus',
      title: 'Focus next',
      body: focusBody,
      icon: 'locate-outline',
      tone: 'focus',
    },
  ];

  return cards.map((card) => {
    const colors = growthChromatic(card.tone);
    return { ...card, ...colors };
  });
}

export function buildDnaAccessibilityLabel(dimensions: ProfileDnaDimensionMock[]): string {
  if (dimensions.length === 0) return 'Decision DNA pattern summary';
  const parts = dimensions.map((dim) => `${dim.label} ${dim.level}`).join(', ');
  return `Decision DNA chart. ${parts}.`;
}

export function latestDecisionRecord(decisions: DecisionRecord[]): DecisionRecord | undefined {
  if (decisions.length === 0) return undefined;
  return [...decisions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function recentDecisionRows(
  decisions: DecisionRecord[],
  limit = 4,
): ProfileRecentDecisionMock[] {
  return [...decisions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(mapDecisionToRecentRow);
}
