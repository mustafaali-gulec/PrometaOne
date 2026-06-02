/**
 * Prometa One API — Hono app entry point.
 *
 * Tum route'lari mount eder, CORS / logger / error handler baglar,
 * cron'u baslatir ve graceful shutdown handle eder.
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { config } from './config.js';
import { closePool, healthCheck, pool } from './db.js';
import { errorHandler } from './middleware/error.js';
import { registerAiModule } from './modules/ai/index.js';
import { PgUserRepository, registerAuthModule } from './modules/auth/index.js';
import { registerEInvoiceModule } from './modules/finance/einvoice/index.js';
import { registerFinanceModule } from './modules/finance/index.js';
import { registerHrModule } from './modules/hr/index.js';
import { registerNotificationsModule } from './modules/notifications/index.js';
import cellsRoutes from './routes/cells.js';
import companiesRoutes from './routes/companies.js';
import invoicesRoutes from './routes/invoices.js';
import { banks, kasa, transfers, archives, audit, notifications, ai } from './routes/misc.js';
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
// Moduler kayitlar (Strangler Fig)
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

const aiModule = registerAiModule({
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
});

const authModule = registerAuthModule(
  {
    jwt: {
      accessSecret: config.JWT_SECRET,
      refreshSecret: config.JWT_REFRESH_SECRET,
      accessExpires: config.JWT_ACCESS_EXPIRES,
      refreshExpires: config.JWT_REFRESH_EXPIRES,
      issuer: 'promet-cf',
    },
    bcrypt: { rounds: config.BCRYPT_ROUNDS },
    passwordReset: {
      ttlMinutes: 15,
      ...(process.env['APP_URL']
        ? { resetUrlTemplate: `${process.env['APP_URL']}/reset-password?token={token}` }
        : {}),
    },
    exposeDevTokens: config.isDevelopment,
  },
  { pool },
);

// ============================================================================
// HR modülü (Faz 4) — AuthUserLookupAdapter için ayrı bir PgUserRepository
// instance'ı; auth modülünün internal'ına dokunmuyoruz (ADR-0005)
// ============================================================================
const hrModule = registerHrModule({
  pool,
  authUserRepository: new PgUserRepository(pool),
});

// ============================================================================
// Finance modülü (Faz 5) — Bütçe & Kasa & Fatura, modüler /v1/finance
// ============================================================================
const financeModule = registerFinanceModule(pool);
const einvoiceModule = registerEInvoiceModule(pool);

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

// Auth — YENI moduler endpoint (Faz 3 / PR 4 cutover)
v1.route('/auth', authModule.router);
v1.route('/hr', hrModule.router);
v1.route('/finance', financeModule);
v1.route('/finance', einvoiceModule); // e-fatura + fx (Faz 6) — aynı prefix, /einvoice/* ve /fx/* yolları

// Companies + cells + invoices
v1.route('/companies', companiesRoutes);
v1.route('/companies', cellsRoutes);
v1.route('/companies', invoicesRoutes);

// Banks (genel + company-scoped)
v1.route('/banks', banks);
v1.route('/companies', banks);

// Kasa + transfers + archives (FX → modules/finance/einvoice fx router, Faz 6 PR 8)
v1.route('/companies', kasa);
v1.route('/companies', transfers);
v1.route('/companies', archives);

// =======================================================================
// Bildirimler — YENI moduler endpoint (/v1/notifications)
// =======================================================================
v1.route('/notifications', notificationsModule.router);

// AI Asistan — YENI moduler endpoint (Faz 2 / PR 1)
v1.route('/ai', aiModule.router);

// =======================================================================
// Eski company-scoped notifications endpoint (Strangler Fig — kaldirilacak)
// frontend henuz buraya cagri yapiyor; sonraki PR'da silinecek.
// =======================================================================
v1.route('/companies', notifications);

// AI
v1.route('/companies', ai);

// Audit
v1.route('/audit-logs', audit);

app.route('/v1', v1);

app.notFound((c) =>
  c.json(
    {
      error: 'not_found',
      message: `Endpoint bulunamadi: ${c.req.method} ${c.req.path}`,
    },
    404,
  ),
);

// ============================================================================
// Server start
// ============================================================================
console.log(`
========================================================================
                  PROMETA ONE API . v2.0.0
              Finance & HR Platform Backend
------------------------------------------------------------------------
  Mode      : ${config.NODE_ENV}
  Host      : ${config.HOST}
  Port      : ${config.PORT}
  CORS      : ${config.corsOrigins.join(', ')}
  Cron      : ${config.ENABLE_CRON ? 'enabled' : 'disabled'}
========================================================================
`);

// Eski cron (services/cron.ts)
startCron();

// Yeni moduler cron scheduler
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
    console.log(`* API hazir — http://${info.address}:${info.port}/v1`);
    console.log(`  Health check: http://${info.address}:${info.port}/v1/health`);
  },
);

// ============================================================================
// Graceful shutdown
// ============================================================================
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} alindi — kapatiliyor...`);
  stopCron();
  notificationsModule.scheduler.stop();
  server.close(() => console.log('* HTTP server kapandi'));
  await closePool();
  console.log('* DB pool kapandi');
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('! Unhandled rejection:', reason);
});

export default app;
