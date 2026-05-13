## `apps/`

Deployable or long-running applications in this monorepo.

| Workspace | Purpose |
|-----------|---------|
| **`mobile`** | **`@shouldi/mobile`** — Expo Router client (`npm run mobile` from repo root after env setup). |
| **`api`** | **`@shouldi/api`** — Node + Hono HTTP service (`npm run api` from repo root). |

Do not nest shared libraries inside `apps/`; place reusable code under **`packages/`** and consume it via workspace dependencies.
