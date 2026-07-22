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
import cron from 'node-cron';

import { config } from './config.js';
import { closePool, healthCheck, pool, reportingPool } from './db.js';
import { ConstructionEventConsumer, disconnectKafkaProducer } from './events/kafka.js';
import { errorHandler } from './middleware/error.js';
import { registerAccessModule } from './modules/access/index.js';
import { registerAiModule } from './modules/ai/index.js';
import { registerAppStateModule } from './modules/appstate/index.js';
import { PgUserRepository, registerAuthModule } from './modules/auth/index.js';
import { registerBeyannameModule } from './modules/beyanname/index.js';
import { registerExpenseModule } from './modules/expense/index.js';
import { registerEdefterModule } from './modules/finance/edefter/index.js';
import { registerEInvoiceModule } from './modules/finance/einvoice/index.js';
import { registerFinanceModule } from './modules/finance/index.js';
import { registerPartiesModule } from './modules/finance/parties/index.js';
import { registerFixedAssetsModule } from './modules/fixedassets/index.js';
import { registerHrModule } from './modules/hr/index.js';
import { registerLicensingModule } from './modules/licensing/index.js';
import { registerNotificationsModule } from './modules/notifications/index.js';
import { registerPerformanceModule } from './modules/performance/index.js';
import { registerProductionModule } from './modules/production/index.js';
import { registerPurchasingModule } from './modules/purchasing/index.js';
import { registerPushModule } from './modules/push/index.js';
import { registerReportingModule } from './modules/reporting/index.js';
import { registerWarehouseModule } from './modules/warehouse/index.js';
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
    emailFrom: config.SMTP_FROM ?? 'M Suite <noreply@prometa.local>',
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
  mlServiceUrl: process.env['ML_SERVICE_URL'],
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
// Access modülü (Faz B-4) — RBAC / Özel Roller, modüler /v1/access
// ============================================================================
const accessModule = registerAccessModule({ pool });

// ============================================================================
// Finance modülü (Faz 5) — Bütçe & Kasa & Fatura, modüler /v1/finance
// ============================================================================
const financeModule = registerFinanceModule(pool);
const einvoiceModule = registerEInvoiceModule(pool);
const edefterModule = registerEdefterModule();
const partiesModule = registerPartiesModule(pool);

// ============================================================================
// Üretim & MRP modülü — Reçete & İş Merkezi & Üretim Emri & MRP, /v1/production
// ============================================================================
const productionModule = registerProductionModule(pool);

// ============================================================================
// Depo & Stok Yönetimi (WMS) modülü — Depo & Malzeme & Stok Hareketi, /v1/warehouse
// ============================================================================
const warehouseModule = registerWarehouseModule(pool);

// ============================================================================
// Rapor Üreteci (Report Studio) modülü — güvenli SQL + katalog + tanım, /v1/reports
// reportingPool: salt-okunur SQL yürütme havuzu (ad-hoc/kayıtlı sorgular)
// ============================================================================
const reportingModule = registerReportingModule(pool, reportingPool, {
  smtpHost: config.SMTP_HOST,
  smtpPort: config.SMTP_PORT,
  smtpSecure: config.SMTP_SECURE,
  smtpUser: config.SMTP_USER,
  smtpPass: config.SMTP_PASS,
  emailFrom: config.SMTP_FROM ?? 'M Suite <noreply@prometa.local>',
});

// ============================================================================
// Satınalma modülü — Tedarikçi (cari) & Talep & Sipariş, modüler /v1/purchasing
// ============================================================================
const purchasingModule = registerPurchasingModule(pool);

// ============================================================================
// Gider/Masraf modülü — Gider Kartları & Kasa Excel import, modüler /v1/expense
// ============================================================================
const expenseModule = registerExpenseModule(pool);

// ============================================================================
// AppState modülü — genel amaçlı key→JSONB deposu, modüler /v1/app-state
// (frontend localStorage blob'unu sunucuya taşır)
// ============================================================================
const appStateModule = registerAppStateModule(pool);

// ============================================================================
// Performans modülü — HR performans dönem/değerlendirme SQL aynası,
// modüler /v1/performance (kaynak-of-truth app-state blob'u; sync ile yansır)
// ============================================================================
const performanceModule = registerPerformanceModule(pool);

// ============================================================================
// Sabit Kıymet modülü — kıymet kartı/hareket/amortisman koşumu SQL aynası +
// VUK amortisman hesap motoru, modüler /v1/fixed-assets
// (kaynak-of-truth app-state blob'u; sync ile yansır)
// ============================================================================
const fixedAssetsModule = registerFixedAssetsModule(pool);

// ============================================================================
// Beyanname modülü — KDV1 beyanname hazırlama + GİB e-Beyan REST entegrasyonu,
// modüler /v1/beyanname (entegrasyon kimliği AES-256-GCM şifreli saklanır)
// ============================================================================
const beyannameModule = registerBeyannameModule(pool);

// ============================================================================
// Push modülü — Web Push (VAPID) cihaz kaydı + gönderim, modüler /v1/push
// (VAPID env yoksa NoopPushSender: kayıt çalışır, gönderim loglanıp atlanır)
// ============================================================================
const pushModule = registerPushModule(pool);

// ============================================================================
// Lisanslama modülü — Ed25519 imzalı license.lic doğrulama + koltuk sınırı,
// modüler /v1/license. licenseGuard aşağıda TÜM /v1 route'larından önce bağlanır
// (muaf: /health, /license, /auth).
// ============================================================================
const licensingModule = registerLicensingModule(pool);

// ============================================================================
// Routes — /v1 prefix
// ============================================================================
const v1 = new Hono();

// LICENSE GUARD — route kayıtlarından ÖNCE bağlanmalı (Hono middleware'i
// yalnız kendinden sonra kaydedilen route'lara uygular). Lisans yok/geçersiz/
// süresi dolmuşsa 403 döner; /health, /license ve /auth muaftır.
v1.use('*', licensingModule.licenseGuard);

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
    name: 'M Suite API',
    version: '2.0.0',
    description: 'Finance & HR Platform Backend',
  }),
);

// Auth — YENI moduler endpoint (Faz 3 / PR 4 cutover)
v1.route('/auth', authModule.router);

// Lisanslama — durum (public) + aktivasyon/terminal yönetimi (admin)
v1.route('/license', licensingModule.router);
v1.route('/hr', hrModule.router);
v1.route('/access', accessModule.router);
v1.route('/finance', financeModule);
v1.route('/finance', einvoiceModule); // e-fatura + fx (Faz 6) — aynı prefix, /einvoice/* ve /fx/* yolları
v1.route('/finance', edefterModule); // e-defter imzalama (Faz 3) — /edefter/* yolu
v1.route('/finance', partiesModule); // cari kartları (Faz 7) — /parties, /parties/bulk-import

// Üretim & MRP — YENI moduler endpoint (/v1/production)
v1.route('/production', productionModule);

// Depo & Stok Yönetimi (WMS) — YENI moduler endpoint (/v1/warehouse)
v1.route('/warehouse', warehouseModule);

// Rapor Üreteci (Report Studio) — YENI moduler endpoint (/v1/reports)
v1.route('/reports', reportingModule.router);

// Satınalma (/v1/purchasing), Gider Kartları (/v1/expense), Uygulama Durumu (/v1/app-state)
v1.route('/purchasing', purchasingModule);
v1.route('/expense', expenseModule);
v1.route('/app-state', appStateModule);
v1.route('/performance', performanceModule);
v1.route('/fixed-assets', fixedAssetsModule);
v1.route('/beyanname', beyannameModule);

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

// Push bildirimleri — cihaz kaydı + gönderim (/v1/push)
v1.route('/push', pushModule.router);

// E-posta gönderimi + log (/v1/email) — notifications modülünün email router'ı
v1.route('/email', notificationsModule.emailRouter);

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

// Rapor Üreteci — saatlik zamanlanmış rapor kontrolü (vadesi gelenleri çalıştır + e-posta)
let reportingCron: cron.ScheduledTask | null = null;
if (config.ENABLE_CRON) {
  reportingCron = cron.schedule(
    '0 * * * *',
    () => {
      void reportingModule
        .runDueScheduledReports(new Date())
        .then((r) => {
          if (r.due > 0) {
            console.log(`📧 Zamanlanmış rapor: ${r.ran}/${r.due} gönderildi (${r.failed} hata)`);
          }
        })
        .catch((e: unknown) => console.error('Zamanlanmış rapor cron hatası:', e));
    },
    { timezone: 'Europe/Istanbul' },
  );
}

// Kafka — construction-service event'lerini tuket (KAFKA_BROKERS varsa)
const constructionConsumer =
  config.kafkaBrokers.length > 0 ? new ConstructionEventConsumer() : null;
if (constructionConsumer) {
  constructionConsumer
    .start()
    .catch((err: unknown) => console.error('[kafka] construction consumer baslatilamadi:', err));
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
  reportingCron?.stop();
  if (constructionConsumer) await constructionConsumer.stop();
  await disconnectKafkaProducer();
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
