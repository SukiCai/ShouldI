## `@shouldi/api`

HTTP API (Node + Hono) backed by embedded **Hermes** at [`../../hermes-agent-private`](../../hermes-agent-private) (git submodule at repo root).

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

[`Dockerfile`](Dockerfile) in this folder is built with **repository root context**: `docker build -f apps/api/Dockerfile -t shouldi-api .` Prefer `docker compose up --build` from the repo root ([`compose.yaml`](../../compose.yaml)).

### Env

- `PORT` — overrides default `8787`.
- `HERMES_ROOT` or `SHOULDI_HERMES_ROOT` — optional absolute path to a Hermes checkout (overrides embedded submodule path).
