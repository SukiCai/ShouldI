## Contributing to ShouldI

### What this repo is

- **`apps/`** — runnable surfaces (Expo client, Node HTTP API). Prefer thin UI/routing here; push shared semantics into **`packages/`** when both sides need them.
- **`packages/`** — libraries with clear consumers (today: **`@shouldi/contracts`** — Zod schemas / API types).
- **`hermes-agent-private/`** — Hermes upstream as a git submodule at the repo root. The native app never bundles or imports Python from here.

### Prerequisites

- **Node ≥ 20** (`package.json` `engines`).
- **Hermes** Python environment when exercising agent paths; submodule: `git submodule update --init --recursive` from the repo root.

### Local setup

```bash
npm install
npm run build -w @shouldi/contracts
```

Development:

- API: `npm run api` (alias: `npm run gateway`).
- Expo: configure `apps/mobile/.env.development` from `.env.development.sample`, then `npm run mobile`.

Typecheck mobile in isolation:

```bash
cd apps/mobile && npx tsc --noEmit
```

### Docker (API only)

The container bundles **`@shouldi/api`** and **`@shouldi/contracts`** without installing Expo dependencies.

```bash
docker compose up --build
```

If host port **8787** is busy (often `npm run api`), use **`SHOULDI_API_HOST_PORT`** (see [`compose.yaml`](compose.yaml)).

For Hermes in the container, set `HERMES_ROOT` and mount `./hermes-agent-private` — see commented blocks in [`compose.yaml`](compose.yaml).

### Conventions

- **Package naming**: npm scopes `shouldi/<name>` (`@shouldi/mobile`, `@shouldi/api`, `@shouldi/contracts`). Rename a workspace only together with dependents and lockfile refreshes (`npm install` at repo root).
- **API vs client boundaries**: Types and request/response shapes live in **`@shouldi/contracts`**. Implement validation on the server; the mobile app imports types/schemas as needed — avoid duplicating ad-hoc DTO definitions in multiple apps.
- **Hermes**: Server-side adapter code lives under **`apps/api/`** (`hermes-adapter.ts`, `hermes-resolve.ts`). Respect `HERMES_ROOT` / `SHOULDI_HERMES_ROOT` for non-default checkouts.

For system overview, see **[`docs/architecture.md`](docs/architecture.md)**.
