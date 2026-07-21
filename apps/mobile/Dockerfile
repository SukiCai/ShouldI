# syntax=docker/dockerfile:1.4
# Builds static Expo web and serves it with nginx. Build from repo root:
#   docker build -f apps/mobile/Dockerfile -t shouldi-web .
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/

RUN --mount=type=cache,target=/root/.npm \
  npm ci -w @shouldi/mobile --include-workspace-root

COPY packages/contracts packages/contracts
RUN npm run build -w @shouldi/contracts

COPY apps/mobile apps/mobile

ARG EXPO_PUBLIC_API_URL=http://localhost:8787
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    CI=1

WORKDIR /app/apps/mobile

RUN npm run generate:icons \
  && npx expo export -p web

FROM nginx:1.27-alpine AS runner

RUN apk add --no-cache curl

# Match host publish port (default 18080) so IDE port forwarding and browser refresh agree.
ENV PORT=18080

COPY apps/mobile/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html

EXPOSE 18080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD sh -c 'curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null || exit 1'

CMD ["nginx", "-g", "daemon off;"]
