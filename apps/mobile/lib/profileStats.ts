import type { DecisionRecord } from '@shouldi/contracts';

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function decisionsThisMonthCount(decisions: DecisionRecord[]): number {
  const monthStart = startOfMonth(Date.now());
  return decisions.filter((d) => d.createdAt >= monthStart).length;
}

export function decisionsMonthDeltaHint(decisions: DecisionRecord[]): string {
  const now = Date.now();
  const thisMonthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(new Date(thisMonthStart - 86_400_000).getTime());
  const thisMonth = decisions.filter((d) => d.createdAt >= thisMonthStart).length;
  const prevMonth = decisions.filter(
    (d) => d.createdAt >= prevMonthStart && d.createdAt < thisMonthStart,
  ).length;
  const delta = thisMonth - prevMonth;
  if (delta > 0) return `↑ ${delta} this month`;
  if (thisMonth > 0) return `${thisMonth} this month`;
  return 'Start with Decide';
}

export function followThroughRate(decisions: DecisionRecord[]): number | null {
  if (decisions.length === 0) return null;
  const followed = decisions.filter(
    (d) =>
      Boolean(d.committedAction?.trim()) ||
      d.updatedAt - d.createdAt > 86_400_000,
  ).length;
  return Math.round((followed / decisions.length) * 100);
}

export function followThroughHint(rate: number | null): string {
  if (rate == null) return 'After first replay';
  if (rate >= 70) return 'Above average';
  if (rate >= 40) return 'Building habit';
  return 'Log outcomes';
}

export function formatCalibrationScore(score?: number): string {
  if (score == null) return '—';
  return (score / 100).toFixed(2);
}

export function calibrationTrendHint(score?: number): string {
  if (score == null) return 'After first replay';
  if (score >= 65) return '↗ Improving';
  if (score >= 45) return 'Steady';
  return 'Replay more';
}

export function activityDayStreak(decisions: DecisionRecord[]): number {
  if (decisions.length === 0) return 0;
  const days = new Set<number>();
  for (const d of decisions) {
    days.add(startOfDay(d.createdAt));
    days.add(startOfDay(d.updatedAt));
  }
  let streak = 0;
  let cursor = startOfDay(Date.now());
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return streak;
}

export function streakHint(streak: number): string {
  if (streak >= 3) return 'Keep it going!';
  if (streak >= 1) return 'Back tomorrow';
  return 'Start a streak';
}
