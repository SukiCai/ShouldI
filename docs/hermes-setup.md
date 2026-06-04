# Hermes + ShouldI local setup

ShouldI does **not** embed the Python agent inside the Node API. Instead:

1. **Hermes** runs as its own process (`hermes gateway`) with the **API server** platform on port **8642** (OpenAI-compatible HTTP).
2. **ShouldI API** (`@shouldi/api`, port **8787**) proxies Decide chat (`/v1/harmence/interview/*`) and briefings (`/v1/chat`) to that endpoint when it is reachable.

The mobile app only talks to **8787** — you do not point Expo at Hermes directly.

## Architecture

```
Expo / web  ──►  ShouldI API :8787  ──►  Hermes api_server :8642  ──►  AIAgent + tools
```

## Docker (all-in-one)

From the ShouldI repo root — starts **Hermes gateway**, **ShouldI API**, and **Expo web**:

```bash
cp .env.example .env
docker compose up --build
```

**Reuse your existing host setup** (recommended if you already ran `hermes setup`):

```bash
# .env
SHOULDI_HERMES_DATA=/Users/sukicai/.hermes
OPENROUTER_API_KEY=sk-...
HERMES_API_KEY=change-me-local-dev
```

**Fresh Hermes inside Docker:**

```bash
docker compose run --rm hermes setup
docker compose up --build
```

Services:

| Compose service | Role | Host port |
|-----------------|------|-----------|
| `hermes` | Full Hermes agent + OpenAI-compatible api_server | 8642 |
| `api` | ShouldI gateway; proxies interview + briefing to Hermes | 8787 |
| `web` | Static Expo web app | 8080 |

Verify:

```bash
curl -s http://localhost:8642/health
curl -s http://localhost:8787/v1/hermes
```

## 1. Hermes source tree

`hermes-agent-private/` is **vendored in this repo** (not a git submodule). You should see `run_agent.py` at the root after clone:

```bash
ls hermes-agent-private/run_agent.py
```

## 2. Hermes Python environment

```bash
cd hermes-agent-private
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .
```

Run each line separately. Do **not** paste inline `# comments` on the same line as `pip install` — some shells pass `#` to pip as a bogus package name (`Invalid requirement: '#'`).

## 3. Model provider API keys

Hermes reads secrets from **`~/.hermes/.env`** (not ShouldI’s repo).

Run the setup wizard once, or create the file manually:

```bash
cd hermes-agent-private
hermes setup
```

At minimum you need a working **model provider** key (e.g. `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, or whatever your `~/.hermes/config.yaml` `model.provider` expects). Without this, the gateway starts but completions fail.

## 4. Enable Hermes API server

Add to **`~/.hermes/.env`**:

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
# Optional — only if something other than ShouldI calls Hermes directly from a browser
# API_SERVER_CORS_ORIGINS=http://localhost:8080
```

Default listen address is **`127.0.0.1:8642`**. To bind all interfaces (Docker LAN, etc.) use `API_SERVER_HOST=0.0.0.0` — **requires** `API_SERVER_KEY`.

## 5. Start Hermes gateway

In a dedicated terminal (keep it running):

```bash
cd hermes-agent-private
source .venv/bin/activate
hermes gateway
```

You should see:

```text
[API Server] API server listening on http://127.0.0.1:8642
```

Quick check:

```bash
curl -s http://127.0.0.1:8642/health

curl -s http://127.0.0.1:8642/v1/chat/completions \
  -H "Authorization: Bearer change-me-local-dev" \
  -H "Content-Type: application/json" \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"Say hi in one sentence."}]}'
```

## 6. Configure ShouldI API (optional)

ShouldI defaults to `http://127.0.0.1:8642` with no key if Hermes has no `API_SERVER_KEY`.

If you set `API_SERVER_KEY` on Hermes, mirror it for ShouldI:

Create **`apps/api/.env`** (or export in the shell before `npm run api`):

```bash
HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=change-me-local-dev
# HERMES_REQUEST_TIMEOUT_MS=180000
```

## 7. Start ShouldI API + app

Terminal 2 — API:

```bash
cd /path/to/ShouldI
npm install
npm run build -w @shouldi/contracts
npm run api
```

Terminal 3 — Expo (or use Docker web from root `docker compose up`):

```bash
npm run mobile
# or: npm run mobile -- --web
```

Point the client at the gateway (see `apps/mobile/.env.development.sample`):

```bash
# apps/mobile/.env.development
EXPO_PUBLIC_API_URL=http://localhost:8787
```

Android emulator: `http://10.0.2.2:8787`

## 8. Verify integration

```bash
# ShouldI reports Hermes api_server reachability
curl -s http://localhost:8787/v1/hermes | jq
```

When `apiLive` is `true`, **Decide → Harmence chat** and **Review briefing** (`POST /v1/chat`) use the real agent.

## Environment reference

| Variable | Where | Purpose |
|----------|--------|---------|
| `API_SERVER_ENABLED` | `~/.hermes/.env` | Start OpenAI-compatible server with gateway |
| `API_SERVER_KEY` | `~/.hermes/.env` | Bearer token for Hermes HTTP API |
| `API_SERVER_PORT` | `~/.hermes/.env` | Default `8642` |
| `OPENROUTER_API_KEY` / etc. | `~/.hermes/.env` | Model inference |
| `HERMES_ROOT` / `SHOULDI_HERMES_ROOT` | ShouldI API | Override path to Hermes checkout |
| `HERMES_API_URL` | ShouldI API | Default `http://127.0.0.1:8642` |
| `HERMES_API_KEY` | ShouldI API | Same value as `API_SERVER_KEY` when set |
| `EXPO_PUBLIC_API_URL` | Expo | ShouldI API base (default `8787`) |

## Docker note

`docker compose up` builds a slim Hermes image from `docker/hermes/Dockerfile` (embedded submodule). It is faster than the upstream `nousresearch/hermes-agent` image but still runs the full agent loop via `hermes gateway run`. Persisted state lives in the `hermes-data` volume or your bind-mounted `SHOULDI_HERMES_DATA`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `apiLive: false` on `/v1/hermes` | Start `hermes gateway`; confirm `API_SERVER_ENABLED=true` |
| `Refusing to run the Hermes gateway as root` | Rebuild images — ShouldI entrypoint now drops to the `hermes` user via `gosu` |
| Permission errors on bind-mounted `~/.hermes` | Set `HERMES_UID` / `HERMES_GID` in `.env` to your Mac user (`id -u` / `id -g`) |
| `command not found: hermes` | `pip install -e .` failed or venv not activated — run `source .venv/bin/activate` then `which hermes` |
| 401 from Hermes | Set matching `HERMES_API_KEY` / `API_SERVER_KEY` |
| Harmence shows scripted probes | Hermes not reachable — check port 8642 and firewall |
| Slow first reply | Normal — Hermes may run tools; increase `HERMES_REQUEST_TIMEOUT_MS` |
| Session continuity errors | Set `API_SERVER_KEY` on Hermes **and** `HERMES_API_KEY` on ShouldI (uses `X-Hermes-Session-Id`) |

## Optional: slimmer toolset for intake

By default Hermes uses the **api_server** platform toolset (terminal, files, search, etc.). For a narrower intake-only agent, customize `tools.api_server` in `~/.hermes/config.yaml` via `hermes tools` — product tuning, not required for first connect.
