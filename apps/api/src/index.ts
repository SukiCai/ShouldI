import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ExploreFeedResponseSchema } from '@shouldi/contracts';
import { seededExploreCards } from './explore-seed.js';
import { summarizeRequest } from './hermes-adapter.js';
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

app.get('/v1/hermes', (c) => {
  const resolved = resolveHermesRepoRoot();
  return c.json({
    integrated: !!resolved,
    source: resolved?.source ?? null,
    root: resolved?.root ?? null,
  });
});

app.post('/v1/chat', async (c) => {
  const body = await c.req.json().catch(() => null);
  const response = summarizeRequest(body);
  if (!response.ok) {
    return c.json({ error: 'INVALID_REQUEST' }, 400);
  }
  return c.json(response.data);
});

const port = Number(process.env.PORT ?? 8787);
const embedded = resolveHermesRepoRoot();
console.info(
  `gateway listening on ${port}`,
  embedded ? `[Hermes: ${embedded.root}]` : '[Hermes: not detected]',
);
serve({ fetch: app.fetch, port });
