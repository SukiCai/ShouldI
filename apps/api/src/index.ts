import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  AuthCredentialsRequestSchema,
  AuthResponseSchema,
  ChangePasswordRequestSchema,
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
  ExpertCatalogResponseSchema,
  ViewerExpertsResponseSchema,
  ViewerMeResponseSchema,
} from '@shouldi/contracts';
import type { DecideInterviewFinalDecision, ExploreCard } from '@shouldi/contracts';
import { signUp, signIn, changePassword } from './auth.js';
import { countExploreCardRows, getExploreCardRow, listExploreCardRows, saveExploreCardRow } from './db.js';
import { seededExploreCards } from './explore-seed.js';
import {
  CouncilLockedError,
  handleInterviewTurn,
  summarizeSessionDetail,
  summarizeSessionsForMobile,
} from './harmence-interview.js';
import { summarizeRequest } from './hermes-adapter.js';
import { getHermesAgentStatus, probeHermesApi, provisionHermesUserHome, seedHermesUserModel } from './hermes-client.js';
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
import {
  expertCatalogResponse,
  getUserExpert,
  markExpertsApplied,
  resolveUserIdFromAuth,
  viewerExpertsResponse,
} from './expert-discovery.js';

const app = new Hono();

app.use('*', cors({ origin: '*' }));

if (countExploreCardRows() === 0) {
  for (const card of seededExploreCards) saveExploreCardRow(card.id, card);
}

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'shouldi-gateway',
  }),
);

const AUTH_ERROR_STATUS: Record<string, 400 | 401 | 409> = {
  INVALID_PHONE: 400,
  WEAK_PASSWORD: 400,
  PHONE_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
};

app.post('/v1/auth/signup', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = AuthCredentialsRequestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  const result = signUp(parsed.data.phone, parsed.data.password);
  if (!result.ok) return c.json({ error: result.reason }, AUTH_ERROR_STATUS[result.reason]);
  void seedHermesUserModel(result.userId);
  void provisionHermesUserHome(result.userId);
  return c.json(AuthResponseSchema.parse({ userId: result.userId, token: result.token }), 201);
});

app.post('/v1/auth/signin', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = AuthCredentialsRequestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  const result = signIn(parsed.data.phone, parsed.data.password);
  if (!result.ok) return c.json({ error: result.reason }, AUTH_ERROR_STATUS[result.reason]);
  return c.json(AuthResponseSchema.parse({ userId: result.userId, token: result.token }));
});

const CHANGE_PASSWORD_ERROR_STATUS: Record<string, 400 | 401 | 404> = {
  INVALID_CURRENT_PASSWORD: 401,
  WEAK_PASSWORD: 400,
  USER_NOT_FOUND: 404,
};

app.post('/v1/auth/change-password', async (c) => {
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  if (userId === 'anonymous-local') return c.json({ error: 'UNAUTHENTICATED' }, 401);

  const body = await c.req.json().catch(() => ({}));
  const parsed = ChangePasswordRequestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);

  const result = changePassword(userId, parsed.data.currentPassword, parsed.data.newPassword);
  if (!result.ok) return c.json({ error: result.reason }, CHANGE_PASSWORD_ERROR_STATUS[result.reason]);
  return c.json({ ok: true });
});

app.get('/v1/me/experts', (c) => {
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  return c.json(viewerExpertsResponse(userId));
});

app.get('/v1/me/experts/:id', (c) => {
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  const expert = getUserExpert(userId, c.req.param('id'));
  if (!expert) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(expert);
});

app.get('/v1/experts/catalog', (c) => {
  return c.json(ExpertCatalogResponseSchema.parse(expertCatalogResponse()));
});

app.get('/v1/me', (c) => {
  const auth = c.req.header('authorization');
  const userId = resolveUserIdFromAuth(auth);
  const anonymous = userId === 'anonymous-local';
  return c.json(
    ViewerMeResponseSchema.parse({
    anonymous,
    userId: anonymous ? null : userId,
    entitlements: {
      isPremium: false,
      pointsBalance: 2450,
      councilSessionCost: 120,
    },
    }),
  );
});

app.get('/v1/explore', (c) => {
  const payload = ExploreFeedResponseSchema.parse({ cards: listExploreCardRows<ExploreCard>() });
  return c.json(payload);
});

app.get('/v1/explore/:id', (c) => {
  const id = c.req.param('id');
  const card = getExploreCardRow<ExploreCard>(id);
  if (!card) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(ExploreCardSchema.parse(card));
});

app.post('/v1/explore', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = ExploreCardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  }
  const card = parsed.data;
  saveExploreCardRow(card.id, card);
  return c.json({ card }, 201);
});

app.post('/v1/explore/:id/vote', async (c) => {
  const id = c.req.param('id');
  const card = getExploreCardRow<ExploreCard>(id);
  if (!card) return c.json({ error: 'NOT_FOUND' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ExploreVoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  }
  const voted = applyExploreVote(card, parsed.data.optionId);
  saveExploreCardRow(id, voted);
  return c.json({ card: ExploreCardSchema.parse(voted) });
});

app.post('/v1/explore/:id/follow', async (c) => {
  const id = c.req.param('id');
  const card = getExploreCardRow<ExploreCard>(id);
  if (!card) return c.json({ error: 'NOT_FOUND' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ExploreFollowRequestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  const next = { ...card, followedByMe: parsed.data.follow };
  saveExploreCardRow(id, next);
  return c.json({ card: ExploreCardSchema.parse(next) });
});

app.post('/v1/explore/:id/save', async (c) => {
  const id = c.req.param('id');
  const card = getExploreCardRow<ExploreCard>(id);
  if (!card) return c.json({ error: 'NOT_FOUND' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = ExploreSaveRequestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'INVALID_REQUEST', issues: parsed.error.flatten() }, 400);
  const next = { ...card, savedByMe: parsed.data.save };
  saveExploreCardRow(id, next);
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
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  const payload = summarizeSessionsForMobile(userId);
  const parsed = DecideInterviewSessionsListSchema.parse(payload);
  return c.json(parsed);
});

app.get('/v1/harmence/interview/sessions/:id', async (c) => {
  const id = c.req.param('id');
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  const detail = await summarizeSessionDetail(id, userId);
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
    const userId = resolveUserIdFromAuth(c.req.header('authorization'));
    const res = await handleInterviewTurn(
      parsed.data.sessionId ?? null,
      parsed.data.userText ?? '',
      parsed.data.selectedOptionId,
      parsed.data.mode,
      parsed.data.councilUnlock,
      userId,
    );
    const enriched = { ...res } as typeof res & { decisionRecordId?: string; decisionLens?: unknown };
    if (res.isComplete && res.finalDecision) {
      const finalDecision = res.finalDecision as DecideInterviewFinalDecision;
      const questionFromUser =
        res.bubbles.find((bubble) => bubble.role === 'user' && bubble.text.trim().length > 0)?.text ?? 'Important decision';
      const expertIdsUsed = [
        ...new Set([
          ...res.activeExperts.map((expert) => expert.id),
          ...finalDecision.expertVerdicts.map((verdict) => verdict.expertId),
        ]),
      ].filter((id) => id !== 'general-decision');
      const created = createDecisionRecordFromFinalDecision({
        userId,
        sessionId: res.sessionId,
        question: questionFromUser,
        finalDecision,
        expertIdsUsed,
      });
      markExpertsApplied({
        userId,
        sessionId: res.sessionId,
        expertIds: expertIdsUsed,
        decisionRecordId: created.record.id,
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
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  const records = listDecisionRecords(userId);
  return c.json({ decisions: records.map((record) => DecisionRecordSchema.parse(record)) });
});

app.get('/v1/decisions/:id', (c) => {
  const id = c.req.param('id');
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  const record = getDecisionRecord(id, userId);
  if (!record) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(DecisionRecordSchema.parse(record));
});

app.get('/v1/decisions/:id/lens', (c) => {
  const id = c.req.param('id');
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  if (!getDecisionRecord(id, userId)) return c.json({ error: 'NOT_FOUND' }, 404);
  const lens = getDecisionLens(id);
  if (!lens) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(DecisionLensSchema.parse(lens));
});

app.post('/v1/decisions/:id/prediction', async (c) => {
  const id = c.req.param('id');
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  if (!getDecisionRecord(id, userId)) return c.json({ error: 'NOT_FOUND' }, 404);
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
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  if (!getDecisionRecord(id, userId)) return c.json({ error: 'NOT_FOUND' }, 404);
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
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  if (!getDecisionRecord(id, userId)) return c.json({ error: 'NOT_FOUND' }, 404);
  const body = await c.req.json().catch(() => ({} as { reflection?: string; userId?: string }));
  if (!body?.reflection || typeof body.reflection !== 'string') {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }
  const replay = setOutcomeReplayReflection(id, body.reflection);
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
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  if (!getDecisionRecord(id, userId)) return c.json({ error: 'NOT_FOUND' }, 404);
  const replay = getOutcomeReplay(id);
  if (!replay) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(OutcomeReplaySchema.parse(replay));
});

app.get('/v1/me/dna', (c) => {
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  return c.json(DecisionDnaProfileSchema.parse(getDecisionDna(userId)));
});

app.patch('/v1/me/dna', async (c) => {
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
  const body = await c.req.json().catch(() => ({}));
  const updated = patchDecisionDna(userId, (body ?? {}) as any);
  return c.json(DecisionDnaProfileSchema.parse(updated));
});

app.get('/v1/me/dna/history', (c) => {
  const userId = resolveUserIdFromAuth(c.req.header('authorization'));
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
