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
import {
  getDecisionLensRow,
  getDecisionRecordRow,
  getDnaRow,
  getOutcomeReplayRow,
  insertDnaHistoryRow,
  insertProductEventRow,
  listAllDecisionRecordRows,
  listDecisionRecordRowsForUser,
  listDnaHistoryRows,
  listRecentProductEventRows,
  saveDecisionLensRow,
  saveDecisionRecordRow,
  saveDnaRow,
  saveOutcomeReplayRow,
} from './db.js';

function nowTs(): number {
  return Date.now();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

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
  userId: string;
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
    userId: params.userId,
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
  saveDecisionRecordRow(record.id, record.userId, record.updatedAt, record);
  saveDecisionLensRow(record.id, lens);
  return { record, lens };
}

export function listDecisionRecords(userId: string): DecisionRecord[] {
  return listDecisionRecordRowsForUser<DecisionRecord>(userId);
}

/** Returns undefined both when the record doesn't exist AND when it belongs
 * to a different account — callers map either to 404. */
export function getDecisionRecord(id: string, userId: string): DecisionRecord | undefined {
  const record = getDecisionRecordRow<DecisionRecord>(id);
  if (!record || record.userId !== userId) return undefined;
  return record;
}

export function getDecisionLens(decisionRecordId: string): DecisionLens | undefined {
  return getDecisionLensRow<DecisionLens>(decisionRecordId);
}

export function upsertOutcomePrediction(decisionRecordId: string, predictionText: string, probability?: number): OutcomeReplay {
  const replay = getOutcomeReplayRow<OutcomeReplay>(decisionRecordId) ?? {
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
  saveOutcomeReplayRow(decisionRecordId, replay);
  return replay;
}

export function upsertOutcomeActual(decisionRecordId: string, outcomeText: string, happenedAt?: number): OutcomeReplay {
  const replay = getOutcomeReplayRow<OutcomeReplay>(decisionRecordId) ?? {
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
  saveOutcomeReplayRow(decisionRecordId, replay);
  return replay;
}

export function setOutcomeReplayReflection(decisionRecordId: string, reflection: string): OutcomeReplay {
  const replay = getOutcomeReplayRow<OutcomeReplay>(decisionRecordId) ?? {
    decisionRecordId,
    updatedAt: nowTs(),
  };
  replay.reflection = reflection;
  replay.updatedAt = nowTs();
  saveOutcomeReplayRow(decisionRecordId, replay);
  return replay;
}

export function getOutcomeReplay(decisionRecordId: string): OutcomeReplay | undefined {
  return getOutcomeReplayRow<OutcomeReplay>(decisionRecordId);
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
  const existing = getDnaRow<DecisionDnaProfile>(userId);
  if (existing) return existing;
  const fresh = defaultDna(userId);
  saveDnaRow(userId, fresh);
  return fresh;
}

export function patchDecisionDna(userId: string, patch: Partial<Omit<DecisionDnaProfile, 'userId'>>): DecisionDnaProfile {
  const current = getDecisionDna(userId);
  const updated: DecisionDnaProfile = {
    ...current,
    ...patch,
    userId,
    updatedAt: nowTs(),
  };
  saveDnaRow(userId, updated);
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
  insertDnaHistoryRow(params.userId, item.createdAt, item);
  return item;
}

export function listDecisionDnaHistory(userId: string): DecisionDnaUpdateEvent[] {
  return listDnaHistoryRows<DecisionDnaUpdateEvent>(userId);
}

export function appendProductEvents(events: ProductEvent[]): void {
  for (const event of events) insertProductEventRow(event);
}

export function listProductEvents(limit = 200): ProductEvent[] {
  return listRecentProductEventRows<ProductEvent>(limit);
}

export function getPmfMetrics(): {
  meaningfulDecisionsCompleted: number;
  returnedForOutcomeUpdate: number;
  decisionReturnRate: number;
  avgConfidenceScore: number;
  calibrationSignals: number;
} {
  const records = listAllDecisionRecordRows<DecisionRecord>();
  const meaningfulDecisionsCompleted = records.length;
  const withOutcome = records.filter((r) => getOutcomeReplayRow<OutcomeReplay>(r.id)?.actual).length;
  const withPrediction = records.filter((r) => getOutcomeReplayRow<OutcomeReplay>(r.id)?.prediction).length;
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

