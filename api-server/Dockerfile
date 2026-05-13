# =============================================================================
# PROMETA ONE API — Development Dockerfile (tsx runtime, no build)
# =============================================================================
FROM node:20-alpine

# Sağlık kontrolü için curl + tini
RUN apk add --no-cache curl tini

WORKDIR /app

# Bağımlılıkları kur
COPY package.json package-lock.json* ./
RUN npm install

# Kaynak kodu ve scripts
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
COPY seed.sql ./

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/v1/health || exit 1

# tsx ile direkt TypeScript çalıştır (build adımı yok)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "src/index.ts"]
