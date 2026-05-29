# Builds static Expo web and serves it with nginx. Build from repo root:
#   docker build -f apps/mobile/Dockerfile -t shouldi-web .
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/

RUN npm ci -w @shouldi/mobile --include-workspace-root

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

COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
