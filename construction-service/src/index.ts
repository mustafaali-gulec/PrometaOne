/**
 * Construction Service — bağımsız mikroservis giriş noktası.
 *
 * Hono app; /v1/construction altına construction modülünü mount eder. Auth
 * monolit ile paylaşılan JWT_SECRET ile stateless doğrulanır. Domain olayları
 * Kafka'ya yayınlanır (broker yoksa no-op). Kendi DB'si (DB-per-service).
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';

import { config } from './config.js';
import { closePool, healthCheck, pool } from './db.js';
import { getEventPublisher, KafkaEventPublisher } from './events/kafka.js';
import { registerConstructionModule } from './modules/construction/index.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: config.corsOrigins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error('Beklenmeyen hata:', err);
  return c.json({ error: 'internal_error', message: 'Sunucu hatası' }, 500);
});

// === Event publisher (Kafka / no-op) ===
const events = getEventPublisher();

// === Construction modülü ===
const constructionModule = registerConstructionModule(pool, events);

const v1 = new Hono();
v1.get('/health', async (c) => {
  const dbOk = await healthCheck();
  return c.json(
    {
      service: 'construction-service',
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk,
      kafka: config.kafkaBrokers.length > 0 ? 'configured' : 'noop',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    dbOk ? 200 : 503,
  );
});
v1.get('/', (c) => c.json({ name: 'Prometa One — Construction Service', version: '1.0.0' }));
v1.route('/construction', constructionModule);

app.route('/v1', v1);

app.notFound((c) =>
  c.json({ error: 'not_found', message: `Bulunamadı: ${c.req.method} ${c.req.path}` }, 404),
);

// === Sunucu başlat ===
const server = serve({ fetch: app.fetch, port: config.PORT, hostname: config.HOST }, (info) => {
  console.log('========================================================================');
  console.log('         PROMETA ONE — CONSTRUCTION SERVICE v1.0.0');
  console.log('------------------------------------------------------------------------');
  console.log(`  Mode   : ${config.NODE_ENV}`);
  console.log(`  Listen : http://${config.HOST}:${String(info.port)}/v1`);
  console.log(`  Health : http://${config.HOST}:${String(info.port)}/v1/health`);
  console.log(`  Kafka  : ${config.kafkaBrokers.length > 0 ? config.kafkaBrokers.join(',') : 'no-op'}`);
  console.log('========================================================================');
});

// Kafka producer'ı önden bağla (best-effort; broker hazır değilse ilk yayında bağlanır).
if (events instanceof KafkaEventPublisher) {
  events.connect().catch((err: unknown) => console.error('[kafka] ön bağlantı başarısız:', err));
}

// === Graceful shutdown ===
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} alındı — kapatılıyor...`);
  server.close();
  if (events instanceof KafkaEventPublisher) await events.disconnect();
  await closePool();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
