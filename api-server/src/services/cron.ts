/**
 * Cron scheduler.
 *
 * İki sabit görev:
 *   1. Günlük TCMB kurları (09:30, iş günleri)
 *   2. Şirket-bazlı günlük vade raporları (her şirketin notification_settings.cron_schedule'a göre)
 *
 * Multi-instance deployment için ENABLE_CRON=false ile kapatın ve
 * ayrı bir cron worker process'i çalıştırın.
 */
import cron from "node-cron";
import { config } from "../config.js";
import { pool } from "../db.js";
import { fetchAndStoreTodaysRates } from "./tcmb.js";
import { sendDailyReport } from "./notifications.js";

const tasks: cron.ScheduledTask[] = [];

export function startCron(): void {
  if (!config.ENABLE_CRON) {
    console.log("ℹ️  ENABLE_CRON=false — cron başlatılmadı");
    return;
  }

  console.log("⏰ Cron scheduler başlatılıyor...");

  // 1. TCMB kurları — iş günleri 09:30
  const tcmbTask = cron.schedule(
    "30 9 * * 1-5",
    async () => {
      console.log("⏰ TCMB kurları çekiliyor...");
      try {
        const result = await fetchAndStoreTodaysRates();
        console.log(`✓ Kurlar güncellendi — USD: ${result.USD}, EUR: ${result.EUR}, tarih: ${result.effectiveDate}`);
      } catch (err: any) {
        console.error("✗ TCMB hatası:", err.message);
      }
    },
    { timezone: "Europe/Istanbul" }
  );
  tasks.push(tcmbTask);

  // 2. Şirket bazlı bildirimler — her saat başı kontrol, eşleşen şirketler için tetikle
  // Her şirketin kendi cron_schedule'u olduğu için merkezi bir scheduler her saat çalışır,
  // o saatte tetiklenmesi gereken şirketleri bulup çalıştırır.
  // (Basit yaklaşım; advanced: her şirket için ayrı cron task)
  const notifTask = cron.schedule(
    "0 * * * *", // her saat başı
    async () => {
      try {
        const companies = await pool.query<{ company_id: number; cron_schedule: string }>(
          `SELECT company_id, cron_schedule FROM notification_settings WHERE enabled = TRUE`
        );

        const now = new Date();
        for (const row of companies.rows) {
          // Her şirketin cron_schedule'u şu anda eşleşiyor mu?
          if (cron.validate(row.cron_schedule)) {
            // Basit kontrol: schedule'u parse edip mevcut saatle karşılaştır
            if (matchesCurrentHour(row.cron_schedule, now)) {
              try {
                const result = await sendDailyReport(row.company_id);
                console.log(`✓ Şirket #${row.company_id} bildirim gönderildi → ${result.sentTo.join(", ")}`);
              } catch (err: any) {
                console.error(`✗ Şirket #${row.company_id} bildirim hatası:`, err.message);
              }
            }
          }
        }
      } catch (err) {
        console.error("Cron notif kontrol hatası:", err);
      }
    },
    { timezone: "Europe/Istanbul" }
  );
  tasks.push(notifTask);

  // 3. Session temizliği — her gece yarısı, eski session'ları sil
  const cleanupTask = cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const result = await pool.query(
          `DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '1 day' OR revoked_at < NOW() - INTERVAL '7 days'`
        );
        console.log(`🧹 Eski session'lar temizlendi: ${result.rowCount}`);
      } catch (err) {
        console.error("Session cleanup hatası:", err);
      }
    },
    { timezone: "Europe/Istanbul" }
  );
  tasks.push(cleanupTask);

  console.log(`✓ ${tasks.length} cron task aktif`);
}

export function stopCron(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
}

/**
 * Cron expression'un mevcut saate denk gelip gelmediğini kontrol eder.
 * (node-cron'un içsel match fonksiyonu publik değil, basit bir parser yazıyoruz.)
 *
 * Sadece "minute hour * * dow" formatını destekler (gün/ay wildcard).
 */
function matchesCurrentHour(schedule: string, now: Date): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [, hourPart, , , dowPart] = parts;
  if (!hourPart || !dowPart) return false;

  const currentHour = now.getHours();
  const currentDow = now.getDay();

  return matchesField(hourPart, currentHour) && matchesField(dowPart, currentDow);
}

function matchesField(field: string, value: number): boolean {
  if (field === "*") return true;
  // Range: 1-5
  if (field.includes("-")) {
    const [a, b] = field.split("-").map(Number);
    return a !== undefined && b !== undefined && value >= a && value <= b;
  }
  // List: 1,3,5
  if (field.includes(",")) {
    return field.split(",").map(Number).includes(value);
  }
  // Step: */2
  if (field.includes("/")) {
    const [base, step] = field.split("/");
    const s = Number(step);
    if (!s) return false;
    if (base === "*") return value % s === 0;
    return value === Number(base);
  }
  return Number(field) === value;
}
