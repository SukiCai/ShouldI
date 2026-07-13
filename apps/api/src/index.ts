import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  DecisionDnaProfileSchema,
  DecisionLensSchema,
  DecisionRecordSchema,
  DecideInterviewSessionDetailSchema,
  DecideInterviewSessionsListSchema,
  DecideInterviewTurnRequestSchema,
  DecideInterviewTurnResponseSchema,
  ExploreCardSchema,
  ExploreFollowRequestSchema,
  ExploreFeedResponseSchema,
  ExploreSaveRequestSchema,
  ExploreVoteRequestSchema,
  OutcomeReplaySchema,
  ProductEventBatchSchema,
  ProductEventSchema,
  ViewerMeResponseSchema,
} from '@shouldi/contracts';
import type { DecideInterviewFinalDecision } from '@shouldi/contracts';
import { seededExploreCards } from './explore-seed.js';
import {
  CouncilLockedError,
  handleInterviewTurn,
  summarizeSessionDetail,
  summarizeSessionsForMobile,
} from './harmence-interview.js';
import { summarizeRequest } from './hermes-adapter.js';
import { getHermesAgentStatus, probeHermesApi } from './hermes-client.js';
import { resolveHermesRepoRoot } from './hermes-resolve.js';
import {
  addDecisionDnaUpdate,
  appendProductEvents,
  applyExploreVote,
  createDecisionRecordFromFinalDecision,
  getDecisionDna,
  getDecisionLens,
  getDecisionRecord,
  getOutcomeReplay,
  getPmfMetrics,
  listDecisionDnaHistory,
  listDecisionRecords,
  patchDecisionDna,
  setOutcomeReplayReflection,
  upsertOutcomeActual,
  upsertOutcomePrediction,
} from './decision-lifecycle.js';

const app = new Hono();

app.use('*', cors({ origin: '*' }));

const exploreStore = new Map(seededExploreCards.map((card) => [card.id, card]));

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'shouldi-gateway',
  }),
);

app.get('/v1/me', (c) => {
  const auth = c.req.header('authorization');
  return c.json(
    ViewerMeResponseSchema.parse({
    anonymous: !auth,
    userId: auth ? 'signed-in-placeholder' : null,
    entitlements: {
      isPremium: false,
      pointsBalance: 2450,
      councilSessionCost: 120,
    },
    }),
  );
});

app.get('/v1/explore', (c) => {
  const payload = ExploreFeedResponseSchema.parse({ cards: Array.from(exploreStore.values()) });
  return c.json(payload);
});

app.get('/v1/explore/:id', (c) => {
  const id = c.req.param('id');
  const card = exploreStore.get(id);
  if (!card) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(ExploreCardSchema.parse(card));
});

app.post('/v1/explore/:id/vote', async (c) => {
  const id = c.req.param('id');
  const card = exploreStore.get(id);
  if (!card) return c.json({ error: 'NOT_FOUND' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ExploreVoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  }
  const voted = applyExploreVote(card, parsed.data.optionId);
  exploreStore.set(id, voted);
  return c.json({ card: ExploreCardSchema.parse(voted) });
});

app.post('/v1/explore/:id/follow', async (c) => {
  const id = c.req.param('id');
  const card = exploreStore.get(id);
  if (!card) return c.json({ error: 'NOT_FOUND' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ExploreFollowRequestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  const next = { ...card, followedByMe: parsed.data.follow };
  exploreStore.set(id, next);
  return c.json({ card: ExploreCardSchema.parse(next) });
});

app.post('/v1/explore/:id/save', async (c) => {
  const id = c.req.param('id');
  const card = exploreStore.get(id);
  if (!card) return c.json({ error: 'NOT_FOUND' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ExploreSaveRequestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  const next = { ...card, savedByMe: parsed.data.save };
  exploreStore.set(id, next);
  return c.json({ card: ExploreCardSchema.parse(next) });
});

app.get('/v1/hermes', async (c) => {
  const resolved = resolveHermesRepoRoot();
  const apiLive = await probeHermesApi();
  const status = getHermesAgentStatus();
  return c.json({
    integrated: apiLive,
    repoPresent: !!resolved,
    source: resolved?.source ?? null,
    root: resolved?.root ?? null,
    apiUrl: status.apiUrl,
    apiLive,
    apiKeyConfigured: status.apiKeyConfigured,
  });
});

app.post('/v1/chat', async (c) => {
  const body = await c.req.json().catch(() => null);
  const response = await summarizeRequest(body);
  if (!response.ok) {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }
  return c.json(response.data);
});

app.get('/v1/harmence/interview/sessions', (c) => {
  const payload = summarizeSessionsForMobile();
  const parsed = DecideInterviewSessionsListSchema.parse(payload);
  return c.json(parsed);
});

app.get('/v1/harmence/interview/sessions/:id', async (c) => {
  const id = c.req.param('id');
  const detail = await summarizeSessionDetail(id);
  if (!detail) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(DecideInterviewSessionDetailSchema.parse(detail));
});

app.post('/v1/harmence/interview/turn', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = DecideInterviewTurnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  }
  try {
    const res = await handleInterviewTurn(
      parsed.data.sessionId ?? null,
      parsed.data.userText ?? '',
      parsed.data.selectedOptionId,
      parsed.data.mode,
      parsed.data.councilUnlock,
    );
    const enriched = { ...res } as typeof res & { decisionRecordId?: string; decisionLens?: unknown };
    if (res.isComplete && res.finalDecision) {
      const finalDecision = res.finalDecision as DecideInterviewFinalDecision;
      const questionFromUser =
        res.bubbles.find((bubble) => bubble.role === 'user' && bubble.text.trim().length > 0)?.text ?? 'Important decision';
      const created = createDecisionRecordFromFinalDecision({
        sessionId: res.sessionId,
        question: questionFromUser,
        finalDecision,
      });
      enriched.decisionRecordId = created.record.id;
      enriched.decisionLens = created.lens;
      appendProductEvents([
        ProductEventSchema.parse({
          id: `evt_${Date.now()}_${created.record.id}`,
          name: 'decision_completed',
          decisionRecordId: created.record.id,
          at: Date.now(),
          metadata: { source: 'harmence_interview' },
        }),
      ]);
    }
    return c.json(DecideInterviewTurnResponseSchema.parse(enriched));
  } catch (err) {
    if (err instanceof CouncilLockedError) {
      return c.json(
        {
          error: err.code,
          message: err.message,
        },
        402,
      );
    }
    return c.json({ error: 'UNKNOWN_SESSION' }, 404);
  }
});

app.get('/v1/decisions', (c) => {
  const records = listDecisionRecords();
  return c.json({ decisions: records.map((record) => DecisionRecordSchema.parse(record)) });
});

app.get('/v1/decisions/:id', (c) => {
  const id = c.req.param('id');
  const record = getDecisionRecord(id);
  if (!record) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(DecisionRecordSchema.parse(record));
});

app.get('/v1/decisions/:id/lens', (c) => {
  const id = c.req.param('id');
  const lens = getDecisionLens(id);
  if (!lens) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(DecisionLensSchema.parse(lens));
});

app.post('/v1/decisions/:id/prediction', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as { predictionText?: string; predictedProbability?: number }));
  if (!body?.predictionText || typeof body.predictionText !== 'string') {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }
  const replay = upsertOutcomePrediction(id, body.predictionText, body.predictedProbability);
  appendProductEvents([
    ProductEventSchema.parse({
      id: `evt_${Date.now()}_${id}`,
      name: 'prediction_logged',
      decisionRecordId: id,
      at: Date.now(),
      metadata: { hasProbability: body.predictedProbability != null },
    }),
  ]);
  return c.json(OutcomeReplaySchema.parse(replay));
});

app.post('/v1/decisions/:id/outcome', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as { outcomeText?: string; happenedAt?: number }));
  if (!body?.outcomeText || typeof body.outcomeText !== 'string') {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }
  const replay = upsertOutcomeActual(id, body.outcomeText, body.happenedAt);
  appendProductEvents([
    ProductEventSchema.parse({
      id: `evt_${Date.now()}_${id}`,
      name: 'outcome_replayed',
      decisionRecordId: id,
      at: Date.now(),
      metadata: { hasCalibration: replay.calibrationDelta != null },
    }),
  ]);
  return c.json(OutcomeReplaySchema.parse(replay));
});

app.post('/v1/decisions/:id/reflection', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as { reflection?: string; userId?: string }));
  if (!body?.reflection || typeof body.reflection !== 'string') {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }
  const replay = setOutcomeReplayReflection(id, body.reflection);
  const userId = body.userId ?? 'signed-in-placeholder';
  const dna = getDecisionDna(userId);
  const updated = patchDecisionDna(userId, {
    trajectory: [body.reflection, ...dna.trajectory].slice(0, 10),
    calibrationScore: Math.max(
      0,
      Math.min(100, dna.calibrationScore + (replay.calibrationDelta != null ? Math.round(replay.calibrationDelta * 10) : 0)),
    ),
  });
  addDecisionDnaUpdate({
    userId,
    decisionRecordId: id,
    reason: 'reflection',
    deltaSummary: 'Updated calibration trajectory from outcome replay reflection.',
  });
  return c.json({
    replay: OutcomeReplaySchema.parse(replay),
    dna: DecisionDnaProfileSchema.parse(updated),
  });
});

app.get('/v1/decisions/:id/replay', (c) => {
  const id = c.req.param('id');
  const replay = getOutcomeReplay(id);
  if (!replay) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(OutcomeReplaySchema.parse(replay));
});

app.get('/v1/me/dna', (c) => {
  const userId = c.req.query('userId') ?? 'signed-in-placeholder';
  return c.json(DecisionDnaProfileSchema.parse(getDecisionDna(userId)));
});

app.patch('/v1/me/dna', async (c) => {
  const userId = c.req.query('userId') ?? 'signed-in-placeholder';
  const body = await c.req.json().catch(() => ({}));
  const updated = patchDecisionDna(userId, (body ?? {}) as any);
  return c.json(DecisionDnaProfileSchema.parse(updated));
});

app.get('/v1/me/dna/history', (c) => {
  const userId = c.req.query('userId') ?? 'signed-in-placeholder';
  return c.json({ history: listDecisionDnaHistory(userId) });
});

app.post('/v1/events', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = ProductEventBatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  }
  appendProductEvents(parsed.data.events);
  return c.json({ accepted: parsed.data.events.length });
});

app.get('/v1/metrics/pmf', (c) => {
  return c.json(getPmfMetrics());
});

const port = Number(process.env.PORT ?? 8787);
const hermesStatus = getHermesAgentStatus();
void probeHermesApi(true).then((live) => {
  console.info(
    `gateway listening on ${port}`,
    live
      ? `[Hermes agent: ${hermesStatus.apiUrl}]`
      : `[Hermes agent: unreachable at ${hermesStatus.apiUrl}]`,
  );
});
serve({ fetch: app.fetch, port });
