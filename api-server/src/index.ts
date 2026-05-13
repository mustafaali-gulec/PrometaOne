/**
 * Promet CF API — Hono app entry point.
 *
 * Tüm route'ları mount eder, CORS / logger / error handler bağlar,
 * cron'u başlatır ve graceful shutdown handle eder.
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { config } from "./config.js";
import { closePool, healthCheck } from "./db.js";
import { errorHandler } from "./middleware/error.js";
import { startCron, stopCron } from "./services/cron.js";

// Route modülleri
import authRoutes from "./routes/auth.js";
import companiesRoutes from "./routes/companies.js";
import cellsRoutes from "./routes/cells.js";
import invoicesRoutes from "./routes/invoices.js";
// import { einvoiceRoutes } from "./routes/einvoice.js";  // ⚠️ E-fatura entegrasyonu henüz aktif değil
import {
  banks, kasa, transfers, fx, archives, audit, notifications, ai
} from "./routes/misc.js";

// ============================================================================
// Hono app
// ============================================================================
const app = new Hono();

// Genel middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: config.corsOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// Global error handler
app.onError(errorHandler);

// ============================================================================
// Routes — /v1 prefix
// ============================================================================
const v1 = new Hono();

// Health check (auth gerekmez)
v1.get("/health", async (c) => {
  const dbOk = await healthCheck();
  return c.json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }, dbOk ? 200 : 503);
});

// Versiyon
v1.get("/", (c) => c.json({
  name: "Prometa One API",
  version: "2.0.0",
  description: "Finance & HR Platform Backend",
}));

// Auth endpoints (login serbest, diğerleri token bekler)
v1.route("/auth", authRoutes);

// Companies endpoints
v1.route("/companies", companiesRoutes);

// Cells + categories (companies/:cid altında)
v1.route("/companies", cellsRoutes);

// Invoices (companies/:cid altında)
v1.route("/companies", invoicesRoutes);

// Banks (genel + company-scoped)
v1.route("/banks", banks);
v1.route("/companies", banks);

// Kasa
v1.route("/companies", kasa);

// Transfers
v1.route("/companies", transfers);

// FX (global + company-scoped)
v1.route("/", fx);
v1.route("/companies", fx);

// Archives
v1.route("/companies", archives);

// Notifications
v1.route("/companies", notifications);

// AI predictions
v1.route("/companies", ai);

// E-Fatura (Logo eLogo / QNB eFinans entegrasyonu) — henüz aktif değil
// v1.route("/einvoice", einvoiceRoutes);

// Audit logs (global, cfo+)
v1.route("/audit-logs", audit);

// Ana app'e mount
app.route("/v1", v1);

// 404 catch-all
app.notFound((c) => c.json({
  error: "not_found",
  message: `Endpoint bulunamadı: ${c.req.method} ${c.req.path}`,
}, 404));

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
║  CORS      : ${config.corsOrigins.join(", ").substring(0, 53).padEnd(53)}║
║  Cron      : ${(config.ENABLE_CRON ? "enabled" : "disabled").padEnd(53)}║
╚═══════════════════════════════════════════════════════════════════╝
`);

// Cron başlat
startCron();

// Sunucu
const server = serve({
  fetch: app.fetch,
  hostname: config.HOST,
  port: config.PORT,
}, (info) => {
  console.log(`✓ API hazır — http://${info.address}:${info.port}/v1`);
  console.log(`  Health check: http://${info.address}:${info.port}/v1/health`);
});

// ============================================================================
// Graceful shutdown
// ============================================================================
async function shutdown(signal: string) {
  console.log(`\n${signal} alındı — kapatılıyor...`);
  stopCron();
  server.close(() => console.log("✓ HTTP server kapandı"));
  await closePool();
  console.log("✓ DB pool kapandı");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Unhandled rejection guard
process.on("unhandledRejection", (reason) => {
  console.error("⚠ Unhandled rejection:", reason);
});

export default app;
