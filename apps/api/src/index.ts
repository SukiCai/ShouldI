import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  DecideInterviewSessionDetailSchema,
  DecideInterviewSessionsListSchema,
  DecideInterviewTurnRequestSchema,
  DecideInterviewTurnResponseSchema,
  ExploreFeedResponseSchema,
} from '@shouldi/contracts';
import { seededExploreCards } from './explore-seed.js';
import {
  handleInterviewTurn,
  summarizeSessionDetail,
  summarizeSessionsForMobile,
} from './harmence-interview.js';
import { summarizeRequest } from './hermes-adapter.js';
import { getHermesAgentStatus, probeHermesApi } from './hermes-client.js';
import { resolveHermesRepoRoot } from './hermes-resolve.js';

const app = new Hono();

app.use('*', cors({ origin: '*' }));

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'shouldi-gateway',
  }),
);

app.get('/v1/me', (c) => {
  const auth = c.req.header('authorization');
  return c.json({
    anonymous: !auth,
    userId: auth ? 'signed-in-placeholder' : null,
  });
});

app.get('/v1/explore', (c) => {
  const payload = ExploreFeedResponseSchema.parse({ cards: seededExploreCards });
  return c.json(payload);
});

app.get('/v1/explore/:id', (c) => {
  const id = c.req.param('id');
  const card = seededExploreCards.find((x) => x.id === id);
  if (!card) return c.json({ error: 'NOT_FOUND' }, 404);
  return c.json(card);
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
    );
    return c.json(DecideInterviewTurnResponseSchema.parse(res));
  } catch {
    return c.json({ error: 'UNKNOWN_SESSION' }, 404);
  }
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
