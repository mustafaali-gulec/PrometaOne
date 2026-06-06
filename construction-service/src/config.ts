/**
 * Konfigürasyon — .env'den gelir, zod ile doğrulanır.
 * JWT_SECRET monolit (auth servisi) ile AYNI olmalı: token'lar stateless HS256
 * imzalı; bu servis aynı secret ile doğrular, auth'a ağ çağrısı yapmaz.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3002),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_POOL_IDLE_TIMEOUT: z.coerce.number().default(30000),

  // Monolit ile paylaşılan JWT imza anahtarı (stateless doğrulama).
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // Kafka — opsiyonel. Tanımsızsa event publisher no-op çalışır (Kafka'sız da ayağa kalkar).
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().default('construction-service'),
  KAFKA_TOPIC_PREFIX: z.string().default('construction'),
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
