#!/usr/bin/env node
/**
 * Migration runner.
 * Usage: node scripts/migrate.js [--migrations-dir=./migrations]
 *
 * Tüm .sql dosyalarını alfabetik sıra ile çalıştırır.
 * schema_migrations tablosu ile idempotent — aynı dosyayı 2 kez çalıştırmaz.
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = resolve(
  process.argv.find(a => a.startsWith("--migrations-dir="))?.split("=")[1]
  ?? "./migrations"
);

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable yok");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  console.log("✓ Veritabanına bağlandı");

  // schema_migrations tablosu
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT
    )
  `);

  // Çalıştırılmış migration'lar
  const applied = await client.query(`SELECT filename FROM schema_migrations`);
  const appliedSet = new Set(applied.rows.map(r => r.filename));

  // Dosyaları oku
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("ℹ️  Migration klasöründe .sql dosyası bulunamadı");
    await client.end();
    return;
  }

  console.log(`📁 ${files.length} migration dosyası bulundu`);

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭️  ${file} (zaten uygulanmış)`);
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    console.log(`  ⏳ ${file} çalıştırılıyor...`);

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`,
        [file]
      );
      await client.query("COMMIT");
      console.log(`  ✓ ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  ✗ ${file} HATASI:`);
      console.error(err);
      await client.end();
      process.exit(1);
    }
  }

  console.log("✅ Tüm migration'lar tamamlandı");
  await client.end();
}

main().catch(err => {
  console.error("Migration hatası:", err);
  process.exit(1);
});
