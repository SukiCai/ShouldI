## `@shouldi/api`

HTTP API (Node + Hono) backed by vendored **Hermes** at [`../../hermes-agent-private`](../../hermes-agent-private).

### Routes (MVP)

- `GET /health`
- `GET /v1/explore`
- `GET /v1/me` — placeholder auth payload
- `GET /v1/hermes` — whether `./hermes-agent-private` (or env override) is present
- `POST /v1/chat` — structured preview; detects embedded tree (`hermesStatus: embedded`)

### Commands

- `npm run dev` — `tsx watch` with automatic `@shouldi/contracts` rebuild via `predev`.
- `npm run start` — runs compiled JS from `dist/`.

From the monorepo root you can also run `npm run api` (alias: `npm run gateway`).

### Docker

[`Dockerfile`](Dockerfile) in this folder is built with **repository root context**: `docker build -f apps/api/Dockerfile -t shouldi-api .`

From the repo root, **`docker compose up --build`** starts **`api`** and the Expo **web** UI ([`apps/mobile/Dockerfile`](../mobile/Dockerfile) + [`compose.yaml`](../../compose.yaml)).

### Env

- `PORT` — overrides default `8787`.
- `HERMES_ROOT` or `SHOULDI_HERMES_ROOT` — optional absolute path to a Hermes checkout (overrides vendored `hermes-agent-private/`).
- `HERMES_API_URL` — Hermes OpenAI-compatible server (default `http://127.0.0.1:8642`).
- `HERMES_API_KEY` — Bearer token matching Hermes `API_SERVER_KEY` when set.

See [`../../docs/hermes-setup.md`](../../docs/hermes-setup.md) for gateway + provider key setup.
