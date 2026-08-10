# syntax=docker/dockerfile:1.4
# Builds and runs `@shouldi/api` only. Build from repo root:
#   docker build -f apps/api/Dockerfile -t shouldi-api .
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# python3/make/g++ are needed for node-gyp to compile better-sqlite3's
# native bindings from source (see rebuild step below).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/contracts/package.json packages/contracts/

# better-sqlite3 ships prebuilt binaries directly in its npm package (no
# install script involved, so npm_config_build_from_source is a no-op) —
# its linux-arm64 prebuild targets a newer glibc than this base image ships
# (needs GLIBC_2.38, bookworm has 2.36), which crashes the process at
# startup with ERR_DLOPEN_FAILED. Its package.json also sets
# "gypfile": false, so npm never auto-compiles it (and `npm rebuild` is a
# silent no-op) — node-gyp must be invoked directly against the package.
# (Base image is node:22 because better-sqlite3@13 requires Node >=22;
# compiling this module under Node 20 produced a working .node file that
# segfaulted on require() — an ABI mismatch, not a build failure.)
RUN --mount=type=cache,target=/root/.npm,id=npm-builder \
  npm ci -w @shouldi/api --include-workspace-root \
  && rm -rf node_modules/better-sqlite3/prebuilds \
  && (cd node_modules/better-sqlite3 && npx --yes node-gyp rebuild)

COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/tsconfig.json
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.json

RUN npm run build -w @shouldi/contracts \
  && npm run build -w @shouldi/api

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
  PORT=8787

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/contracts/package.json packages/contracts/

# See builder-stage comment: force a source rebuild of better-sqlite3 to
# avoid its bundled prebuild's glibc mismatch with this base image.
RUN --mount=type=cache,target=/root/.npm,id=npm-runner \
  npm ci -w @shouldi/api --include-workspace-root --omit=dev \
  && rm -rf node_modules/better-sqlite3/prebuilds \
  && (cd node_modules/better-sqlite3 && npx --yes node-gyp rebuild)

COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/apps/api/dist apps/api/dist

WORKDIR /app/apps/api

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
