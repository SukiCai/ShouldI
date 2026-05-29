## ShouldI

ShouldI is an AI-assisted decision companion: **`@shouldi/mobile`** (Expo), **`@shouldi/api`** (Hono), **`@shouldi/contracts`** (Zod), plus an embedded **Hermes** submodule at `./hermes-agent-private`.

### Repository layout

- [`apps/mobile`](apps/mobile) — Expo Router client; talks only HTTPS to **`@shouldi/api`** (no Python / Hermes inside the native bundle).
- [`apps/api`](apps/api) — **`@shouldi/api`**: Node/Hono service (`/health`, `/v1/explore`, `/v1/me`, `/v1/hermes`, `/v1/chat`). Server-side adapter: [`apps/api/src/hermes-adapter.ts`](apps/api/src/hermes-adapter.ts).
- [`packages/contracts`](packages/contracts) — Zod contracts + shared types consumed by **`@shouldi/mobile`** and **`@shouldi/api`**.
- [`hermes-agent-private`](hermes-agent-private) — **full Hermes repo** (`git submodule` at repo root, nested deps). Sibling of `apps/` and `packages/`.

Conventions for **`apps/`** vs **`packages/`**: [`apps/README.md`](apps/README.md), [`packages/README.md`](packages/README.md).

### Prereqs

- Node ≥ 20 (`nvm`, Homebrew node, etc.)
- Hermes toolchain (Python / `uv` / venv) when you run the agent; submodule at [`./hermes-agent-private`](hermes-agent-private) (bootstrap in Install below).

### Install

```bash
cd /Users/sukicai/Desktop/ShouldI
git submodule update --init --recursive
# If .gitmodules uses file:///... submodule URLs and Git blocks them:
# git -c protocol.file.allow=always submodule update --init --recursive
npm install
npm run build -w @shouldi/contracts   # emits dist typings for dependents
```

### Hermes agent (real AI in Decide / briefing)

ShouldI proxies to **Hermes api_server** when it is running. Full checklist: [`docs/hermes-setup.md`](docs/hermes-setup.md).

Short version: `cd hermes-agent-private && python3 -m venv .venv && source .venv/bin/activate && pip install -e .`, then enable `API_SERVER_ENABLED=true` in `~/.hermes/.env`, add a model provider key, run `hermes gateway` (port **8642**), then `npm run api` (port **8787**). See [`docs/hermes-setup.md`](docs/hermes-setup.md).

### Run the HTTP API (default port 8787)

```bash
npm run api
# alias → same target
npm run gateway
```

Docker runs **Hermes agent + ShouldI API + Expo web** together:

```bash
cp .env.example .env
# Edit .env: set OPENROUTER_API_KEY (or your provider) + reuse host Hermes config if you have it:
# SHOULDI_HERMES_DATA=/Users/you/.hermes

docker compose up --build
```

| Service | URL | Override |
|---------|-----|----------|
| **Hermes** (agent HTTP) | http://localhost:8642 | `SHOULDI_HERMES_HOST_PORT` |
| **API** | http://localhost:8787 | `SHOULDI_API_HOST_PORT` |
| **Web UI** | http://localhost:18080 | `SHOULDI_WEB_HOST_PORT` |

First-time Hermes config inside Docker:

```bash
docker compose run --rm hermes setup
```

If you already ran `hermes setup` on the host, bind-mount that data dir via `SHOULDI_HERMES_DATA` in `.env` so Docker reuses your model + keys.

For native Expo Go / simulators on the host, use `npm run mobile` and point `EXPO_PUBLIC_API_URL` at the published API port.

If **8787** or **8080** is already in use locally:

```bash
SHOULDI_API_HOST_PORT=8877 SHOULDI_WEB_HOST_PORT=18080 docker compose up --build
```

Standalone image:

```bash
docker build -f apps/api/Dockerfile -t shouldi-api .
docker run --rm -p 8787:8787 shouldi-api
```

### Configure the Expo app

Copy `apps/mobile/.env.development.sample` → `apps/mobile/.env.development` and tweak `EXPO_PUBLIC_API_URL` (Android emulator often needs `http://10.0.2.2:8787`).

### Launch the Expo app

```bash
npm run mobile
```

### Contribution & architecture

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local setup and conventions  
- [`docs/architecture.md`](docs/architecture.md) — boundaries and data flow  

### Supabase (next)

Production auth + persistence will attach here; see future env wiring in `@shouldi/mobile` + API JWT middleware.

### TypeScript note (Expo + React 19)

The root [`package.json`](package.json) pins `@types/react` / `@types/react-dom` via `overrides` so `react-native`’s JSX types line up cleanly with **`npx tsc --noEmit`**. Runtime React stays on the versions Expo installs; adjust overrides when Expo/SDK bumps their recommended typing story.
