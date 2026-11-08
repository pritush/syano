# syntax=docker/dockerfile:1

ARG NODE_VERSION=26-alpine

# ==========================================
# 1. Base stage with pnpm
# ==========================================
FROM node:${NODE_VERSION} AS base
WORKDIR /app
RUN npm install -g pnpm@10.0.0

# ==========================================
# 2. Dependencies stage
# ==========================================
FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# ==========================================
# 3. Builder stage
# ==========================================
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=dependencies /app/node_modules ./node_modules
ENV NODE_ENV=production
RUN pnpm run build

# ==========================================
# 4. Production Runner stage
# ==========================================
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="Syano" \
      org.opencontainers.image.description="Self-Hosted Open Source URL Shortener & Link Management Platform" \
      org.opencontainers.image.url="https://github.com/pritush/syano" \
      org.opencontainers.image.source="https://github.com/pritush/syano" \
      org.opencontainers.image.licenses="AGPL-3.0"

# Production environment defaults
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000

# Security: create dedicated non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs syano

# Copy compiled standalone Nitro server and assets
COPY --from=builder --chown=syano:nodejs /app/.output ./.output
# Include database directory for reference or migrations
COPY --from=builder --chown=syano:nodejs /app/database ./database

# Run as non-root user
USER syano

EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]

