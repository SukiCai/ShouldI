import type {
  DecisionDnaProfile,
  DecisionDnaUpdateEvent,
  DecisionLens,
  DecisionRecord,
  DecideInterviewFinalDecision,
  ExploreCard,
  OutcomeActual,
  OutcomePrediction,
  OutcomeReplay,
  ProductEvent,
} from '@shouldi/contracts';

function nowTs(): number {
  return Date.now();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

const decisionRecords = new Map<string, DecisionRecord>();
const decisionLensByRecord = new Map<string, DecisionLens>();
const outcomeReplayByRecord = new Map<string, OutcomeReplay>();
const dnaByUser = new Map<string, DecisionDnaProfile>();
const dnaHistoryByUser = new Map<string, DecisionDnaUpdateEvent[]>();
const productEvents: ProductEvent[] = [];

export function buildDecisionLensFromFinalDecision(
  decisionRecordId: string,
  finalDecision: DecideInterviewFinalDecision,
): DecisionLens {
  const confidenceScore = finalDecision.confidenceScore ?? (finalDecision.confidence === 'high' ? 80 : finalDecision.confidence === 'low' ? 45 : 65);
  const strengths = finalDecision.nextSteps.slice(0, 2);
  const blindSpots = finalDecision.reflection?.concerns?.slice(0, 2) ?? [];
  return {
    decisionRecordId,
    headline: finalDecision.verdictLine,
    confidenceScore,
    strengths,
    blindSpots,
    calibrationFocus: finalDecision.reflection?.summary,
    generatedAt: nowTs(),
  };
}

export function createDecisionRecordFromFinalDecision(params: {
  sessionId?: string | null;
  question: string;
  category?: DecisionRecord['category'];
  finalDecision: DecideInterviewFinalDecision;
  expertIdsUsed?: string[];
}): { record: DecisionRecord; lens: DecisionLens } {
  const id = newId('dec');
  const ts = nowTs();
  const confidenceScore =
    params.finalDecision.confidenceScore ??
    (params.finalDecision.confidence === 'high' ? 80 : params.finalDecision.confidence === 'low' ? 45 : 65);
  const expertIdsFromVerdicts = params.finalDecision.expertVerdicts.map((v) => v.expertId);
  const expertIdsUsed = [
    ...new Set([...(params.expertIdsUsed ?? []), ...expertIdsFromVerdicts]),
  ].filter((id) => id !== 'general-decision');
  const record: DecisionRecord = {
    id,
    sessionId: params.sessionId ?? null,
    question: params.question,
    category: params.category,
    recommendation: params.finalDecision.recommendation,
    rationale: params.finalDecision.rationale,
    confidenceScore,
    tradeoffs: params.finalDecision.reflection?.concerns ?? [],
    expertIdsUsed,
    committedAction: params.finalDecision.nextSteps[0],
    createdAt: ts,
    updatedAt: ts,
  };
  const lens = buildDecisionLensFromFinalDecision(record.id, params.finalDecision);
  decisionRecords.set(record.id, record);
  decisionLensByRecord.set(record.id, lens);
  return { record, lens };
}

export function listDecisionRecords(): DecisionRecord[] {
  return Array.from(decisionRecords.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDecisionRecord(id: string): DecisionRecord | undefined {
  return decisionRecords.get(id);
}

export function getDecisionLens(decisionRecordId: string): DecisionLens | undefined {
  return decisionLensByRecord.get(decisionRecordId);
}

export function upsertOutcomePrediction(decisionRecordId: string, predictionText: string, probability?: number): OutcomeReplay {
  const replay = outcomeReplayByRecord.get(decisionRecordId) ?? {
    decisionRecordId,
    updatedAt: nowTs(),
  };
  const prediction: OutcomePrediction = {
    id: newId('pred'),
    decisionRecordId,
    predictionText,
    predictedProbability: probability,
    createdAt: nowTs(),
  };
  replay.prediction = prediction;
  replay.updatedAt = nowTs();
  outcomeReplayByRecord.set(decisionRecordId, replay);
  return replay;
}

export function upsertOutcomeActual(decisionRecordId: string, outcomeText: string, happenedAt?: number): OutcomeReplay {
  const replay = outcomeReplayByRecord.get(decisionRecordId) ?? {
    decisionRecordId,
    updatedAt: nowTs(),
  };
  const actual: OutcomeActual = {
    id: newId('out'),
    decisionRecordId,
    outcomeText,
    happenedAt: happenedAt ?? nowTs(),
    createdAt: nowTs(),
  };
  replay.actual = actual;
  replay.updatedAt = nowTs();
  if (replay.prediction?.predictedProbability != null) {
    // Positive = under-confident, negative = over-confident (simple baseline).
    replay.calibrationDelta = Math.max(-1, Math.min(1, 0.5 - replay.prediction.predictedProbability));
  }
  outcomeReplayByRecord.set(decisionRecordId, replay);
  return replay;
}

export function setOutcomeReplayReflection(decisionRecordId: string, reflection: string): OutcomeReplay {
  const replay = outcomeReplayByRecord.get(decisionRecordId) ?? {
    decisionRecordId,
    updatedAt: nowTs(),
  };
  replay.reflection = reflection;
  replay.updatedAt = nowTs();
  outcomeReplayByRecord.set(decisionRecordId, replay);
  return replay;
}

export function getOutcomeReplay(decisionRecordId: string): OutcomeReplay | undefined {
  return outcomeReplayByRecord.get(decisionRecordId);
}

function defaultDna(userId: string): DecisionDnaProfile {
  return {
    userId,
    values: [],
    riskPreference: 'medium',
    blindSpots: [],
    calibrationScore: 50,
    trajectory: [],
    updatedAt: nowTs(),
  };
}

export function getDecisionDna(userId: string): DecisionDnaProfile {
  const current = dnaByUser.get(userId) ?? defaultDna(userId);
  if (!dnaByUser.has(userId)) dnaByUser.set(userId, current);
  return current;
}

export function patchDecisionDna(userId: string, patch: Partial<Omit<DecisionDnaProfile, 'userId'>>): DecisionDnaProfile {
  const current = getDecisionDna(userId);
  const updated: DecisionDnaProfile = {
    ...current,
    ...patch,
    userId,
    updatedAt: nowTs(),
  };
  dnaByUser.set(userId, updated);
  return updated;
}

export function addDecisionDnaUpdate(params: {
  userId: string;
  decisionRecordId: string;
  reason: DecisionDnaUpdateEvent['reason'];
  deltaSummary: string;
}): DecisionDnaUpdateEvent {
  const item: DecisionDnaUpdateEvent = {
    id: newId('dnaev'),
    userId: params.userId,
    decisionRecordId: params.decisionRecordId,
    reason: params.reason,
    deltaSummary: params.deltaSummary,
    createdAt: nowTs(),
  };
  const list = dnaHistoryByUser.get(params.userId) ?? [];
  list.unshift(item);
  dnaHistoryByUser.set(params.userId, list);
  return item;
}

export function listDecisionDnaHistory(userId: string): DecisionDnaUpdateEvent[] {
  return dnaHistoryByUser.get(userId) ?? [];
}

export function appendProductEvents(events: ProductEvent[]): void {
  productEvents.push(...events);
}

export function listProductEvents(limit = 200): ProductEvent[] {
  return productEvents.slice(-limit);
}

export function getPmfMetrics(): {
  meaningfulDecisionsCompleted: number;
  returnedForOutcomeUpdate: number;
  decisionReturnRate: number;
  avgConfidenceScore: number;
  calibrationSignals: number;
} {
  const records = listDecisionRecords();
  const meaningfulDecisionsCompleted = records.length;
  const withOutcome = records.filter((r) => outcomeReplayByRecord.get(r.id)?.actual).length;
  const withPrediction = records.filter((r) => outcomeReplayByRecord.get(r.id)?.prediction).length;
  const avgConfidenceScore =
    records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + r.confidenceScore, 0) / records.length)
      : 0;
  const decisionReturnRate =
    meaningfulDecisionsCompleted > 0 ? Number((withOutcome / meaningfulDecisionsCompleted).toFixed(3)) : 0;

  return {
    meaningfulDecisionsCompleted,
    returnedForOutcomeUpdate: withOutcome,
    decisionReturnRate,
    avgConfidenceScore,
    calibrationSignals: withPrediction,
  };
}

export function applyExploreVote(card: ExploreCard, optionId: string): ExploreCard {
  const nextDistribution = card.distribution.map((row) =>
    row.optionId === optionId ? { ...row, votes: row.votes + 1 } : row,
  );
  return {
    ...card,
    myVoteOptionId: optionId,
    distribution: nextDistribution,
  };
}

