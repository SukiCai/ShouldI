# Hermes Mock App

Test app for the UserModel plugin — see how Hermes learns each user's profile across sessions.

## Prerequisites

- Python 3.10+ with Hermes agent configured (API key in `~/.hermes/config.yaml`)
- Node.js 18+

## Setup (first time)

```bash
cd /Users/andyliu/hermes-base-agent
/opt/homebrew/bin/python3.13 -m venv .venv
source .venv/bin/activate
# Install all dependencies then register entry points (pip alone hits resolution-too-deep)
uv pip install -e ".[all]" && pip install -e ".[all]" --no-deps
```

## Run Backend

```bash
cd /Users/andyliu/hermes-base-agent
source .venv/bin/activate
# Install Hermes + all deps from repo root (must be run here, not in mock-app/backend)
uv pip install -e ".[all]" && pip install -e ".[all]" --no-deps
cd mock-app/backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## Run Frontend

```bash
cd mock-app/frontend
npm install
npm run dev
```

Open http://localhost:3000

## How to Test

1. Select a user from the left panel
2. Have a multi-turn conversation mentioning your work context
3. Watch the Profile panel (right) update with learned traits after each response
4. Switch users to see independent profiles
