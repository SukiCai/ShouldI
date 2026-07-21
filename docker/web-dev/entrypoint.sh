#!/bin/sh
set -e

cd /app

if [ ! -d node_modules/expo ]; then
  echo "[web-dev] Installing dependencies (first run)..."
  npm ci
  npm run build -w @shouldi/contracts
fi

cd /app/apps/mobile
echo "[web-dev] Starting Expo web on port ${EXPO_WEB_PORT:-8082} (hot reload enabled)"
exec npm run web
