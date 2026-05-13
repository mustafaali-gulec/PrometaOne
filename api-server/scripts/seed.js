#!/usr/bin/env node
/**
 * Seed script.
 * Usage: node scripts/seed.js [--seed-file=./seed.sql] [--passwords=admin:admin123,mustafa:promet]
 *
 * Önce seed.sql'i çalıştırır (placeholder hash'lerle), sonra parolaları gerçek bcrypt
 * hash'i ile günceller. Production'da bu script bir kez çalışır, sonra disable edilir.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

const SEED_FILE = resolve(
  process.argv.find(a => a.startsWith("--seed-file="))?.split("=")[1]
  ?? "./seed.sql"
);

// Default kullanıcı:şifre çiftleri
const PASSWORDS_ARG = process.argv.find(a => a.startsWith("--passwords="))?.split("=")[1];
const passwordPairs = (PASSWORDS_ARG ?? "admin:admin123,mustafa:promet,editor:editor123,viewer:viewer123")
  .split(",")
  .map(pair => {
    const [user, pw] = pair.split(":");
    return { user, pw };
  });

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable yok");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  console.log("✓ Veritabanına bağlandı");

  // Seed dosyasını oku ve çalıştır
  const sql = readFileSync(SEED_FILE, "utf-8");
  console.log(`📁 Seed dosyası okundu: ${SEED_FILE}`);

  try {
    await client.query(sql);
    console.log("✓ Seed SQL çalıştırıldı");
  } catch (err) {
    console.error("✗ Seed SQL hatası:", err.message);
    console.log("ℹ️  Tablolar zaten doluysa devam ediyor (UPSERT ile)...");
  }

  // Parolaları gerçek bcrypt hash'i ile güncelle
  console.log("🔐 Parolalar hash'leniyor...");
  for (const { user, pw } of passwordPairs) {
    const hash = await bcrypt.hash(pw, 10);
    const result = await client.query(
      `UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id`,
      [hash, user]
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`  ✓ ${user} (şifre: ${pw})`);
    } else {
      console.log(`  ⚠ ${user} bulunamadı, atlandı`);
    }
  }

  // Özet
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM companies) AS companies,
      (SELECT COUNT(*) FROM banks) AS banks,
      (SELECT COUNT(*) FROM categories) AS categories,
      (SELECT COUNT(*) FROM bank_accounts) AS bank_accounts,
      (SELECT COUNT(*) FROM kasa_accounts) AS kasa_accounts,
      (SELECT COUNT(*) FROM invoices) AS invoices,
      (SELECT COUNT(*) FROM cells) AS cells
  `);
  console.log("\n📊 Veritabanı durumu:");
  console.log(counts.rows[0]);

  console.log("\n✅ Seed tamamlandı");
  console.log("\nGiriş için kullanılabilir hesaplar:");
  for (const { user, pw } of passwordPairs) {
    console.log(`  ${user.padEnd(10)} / ${pw}`);
  }

  await client.end();
}

main().catch(err => {
  console.error("Seed hatası:", err);
  process.exit(1);
});
