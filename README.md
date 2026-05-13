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

### Run the HTTP API (default port 8787)

```bash
npm run api
# alias → same target
npm run gateway
```

Docker runs **`@shouldi/api`** only (Expo stays on the host):

```bash
docker compose up --build
```

[`compose.yaml`](compose.yaml) publishes the API on host port **`SHOULDI_API_HOST_PORT`** (default **8787**; the container listens on **8787** inside the network namespace). If **8787** is already in use—for example **`npm run api`** locally—pick another published port and set `EXPO_PUBLIC_API_URL` to match:

```bash
SHOULDI_API_HOST_PORT=8877 docker compose up --build
# Expo: http://localhost:8877 (iOS sim) or http://10.0.2.2:8877 (Android emulator)
```

Optionally mount Hermes by uncommenting **`HERMES_ROOT`** and **`volumes:`** in [`compose.yaml`](compose.yaml).

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
