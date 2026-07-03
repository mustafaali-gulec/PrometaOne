/**
 * Konfigürasyon yöneticisi.
 * .env dosyasından gelir, zod ile doğrulanır.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_POOL_IDLE_TIMEOUT: z.coerce.number().default(30000),

  // Report Studio (rapor üreteci) — ad-hoc/kayıtlı SQL yürütme için ayrı,
  // tercihen salt-okunur bağlantı. Tanımsızsa ana DATABASE_URL'e düşer ama
  // sorgular yine READ ONLY transaction + statement_timeout ile çalışır.
  REPORTING_DATABASE_URL: z.string().optional(),
  REPORTING_STATEMENT_TIMEOUT_MS: z.coerce.number().default(15000),
  REPORTING_MAX_ROWS: z.coerce.number().default(5000),
  REPORTING_POOL_MAX: z.coerce.number().default(5),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  BCRYPT_ROUNDS: z.coerce.number().min(8).max(15).default(10),

  TCMB_API_KEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),

  ENABLE_CRON: z.coerce.boolean().default(true),

  // Lisanslama — makinenin donanım kimliği (kurulum sihirbazı üretir) ve
  // gömülü lisans public key'inin opsiyonel override'ı (anahtar rotasyonu).
  PROMETA_FINGERPRINT: z.string().optional(),
  LICENSE_PUBLIC_KEY_PEM: z.string().optional(),

  // Kafka — opsiyonel. Tanımsızsa producer no-op, consumer başlatılmaz.
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().default('api-server'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Environment doğrulama hatası:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  kafkaBrokers: (parsed.data.KAFKA_BROKERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
} as const;
