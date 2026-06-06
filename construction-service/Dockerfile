# =============================================================================
# PROMETA ONE — Construction Service (tsx runtime, no build)
# =============================================================================
FROM node:20-alpine

RUN apk add --no-cache curl tini

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3002/v1/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "src/index.ts"]
