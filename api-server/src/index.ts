/**
 * Prometa One API — Hono app entry point.
 *
 * Tüm route'ları mount eder, CORS / logger / error handler bağlar,
 * cron'u başlatır ve graceful shutdown handle eder.
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { config } from './config.js';
import { closePool, healthCheck, pool } from './db.js';
import { errorHandler } from './middleware/error.js';
import { registerNotificationsModule } from './modules/notifications/index.js';
import aiProxyRoutes from './routes/ai-proxy.js';
import authRoutes from './routes/auth.js';
import cellsRoutes from './routes/cells.js';
import companiesRoutes from './routes/companies.js';
import invoicesRoutes from './routes/invoices.js';
import { banks, kasa, transfers, fx, archives, audit, notifications, ai } from './routes/misc.js';
import { startCron, stopCron } from './services/cron.js';

// ============================================================================
// Hono app
// ============================================================================
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

app.onError(errorHandler);

// ============================================================================
// Modüler kayıtlar (Strangler Fig)
// ============================================================================
const notificationsModule = registerNotificationsModule(
  {
    smtpHost: config.SMTP_HOST,
    smtpPort: config.SMTP_PORT,
    smtpUser: config.SMTP_USER,
    smtpPass: config.SMTP_PASS,
    smtpSecure: config.SMTP_SECURE,
    emailFrom: config.SMTP_FROM ?? 'Prometa One <noreply@prometa.local>',
    enableCron: config.ENABLE_CRON,
  },
  {
    pool,
    logger: {
      info: (msg) => console.log(msg),
      error: (msg, err) => console.error(msg, err),
    },
  },
);

// ============================================================================
// Routes — /v1 prefix
// ============================================================================
const v1 = new Hono();

v1.get('/health', async (c) => {
  const dbOk = await healthCheck();
  return c.json(
    {
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    dbOk ? 200 : 503,
  );
});

v1.get('/', (c) =>
  c.json({
    name: 'Prometa One API',
    version: '2.0.0',
    description: 'Finance & HR Platform Backend',
  }),
);

// Auth
v1.route('/auth', authRoutes);

// Companies + cells + invoices
v1.route('/companies', companiesRoutes);
v1.route('/companies', cellsRoutes);
v1.route('/companies', invoicesRoutes);

// Banks (genel + company-scoped)
v1.route('/banks', banks);
v1.route('/companies', banks);

// Kasa + transfers + FX + archives
v1.route('/companies', kasa);
v1.route('/companies', transfers);
v1.route('/', fx);
v1.route('/companies', fx);
v1.route('/companies', archives);

// =======================================================================
// Bildirimler — YENİ modüler endpoint (/v1/notifications)
// =======================================================================
v1.route('/notifications', notificationsModule.router);

// =======================================================================
// Eski company-scoped notifications endpoint (Strangler Fig — kaldırılacak)
// frontend henüz buraya çağrı yapıyor; PR 4'te silinecek.
// =======================================================================
v1.route('/companies', notifications);

// AI
v1.route('/companies', ai);
v1.route('/ai', aiProxyRoutes);

// Audit
v1.route('/audit-logs', audit);

app.route('/v1', v1);

app.notFound((c) =>
  c.json(
    {
      error: 'not_found',
      message: `Endpoint bulunamadı: ${c.req.method} ${c.req.path}`,
    },
    404,
  ),
);

// ============================================================================
// Server start
// ============================================================================
console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                  PROMETA ONE API · v2.0.0                         ║
║              Finance & HR Platform Backend                        ║
╠═══════════════════════════════════════════════════════════════════╣
║  Mode      : ${config.NODE_ENV.padEnd(53)}║
║  Host      : ${config.HOST.padEnd(53)}║
║  Port      : ${String(config.PORT).padEnd(53)}║
║  CORS      : ${config.corsOrigins.join(', ').substring(0, 53).padEnd(53)}║
║  Cron      : ${(config.ENABLE_CRON ? 'enabled' : 'disabled').padEnd(53)}║
╚═══════════════════════════════════════════════════════════════════╝
`);

// Eski cron (services/cron.ts)
startCron();

// Yeni modüler cron scheduler (PR 2: iskelet boş; PR 3'te job'lar eklenir)
if (config.ENABLE_CRON) {
  notificationsModule.scheduler.start();
}

const server = serve(
  {
    fetch: app.fetch,
    hostname: config.HOST,
    port: config.PORT,
  },
  (info) => {
    console.log(`✓ API hazır — http://${info.address}:${info.port}/v1`);
    console.log(`  Health check: http://${info.address}:${info.port}/v1/health`);
  },
);

// ============================================================================
// Graceful shutdown
// ============================================================================
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} alındı — kapatılıyor...`);
  stopCron();
  notificationsModule.scheduler.stop();
  server.close(() => console.log('✓ HTTP server kapandı'));
  await closePool();
  console.log('✓ DB pool kapandı');
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('⚠ Unhandled rejection:', reason);
});

export default app;
