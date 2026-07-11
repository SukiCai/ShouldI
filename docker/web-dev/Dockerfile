FROM node:20-bookworm-slim

WORKDIR /app

# Install deps in the image layer; runtime uses a named volume at /app/node_modules.
COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci

COPY packages/contracts packages/contracts
RUN npm run build -w @shouldi/contracts

COPY docker/web-dev/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app/apps/mobile
EXPOSE 8082

ENTRYPOINT ["/entrypoint.sh"]
