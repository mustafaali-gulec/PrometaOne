/**
 * Bildirim servisi.
 * Vade raporları üretir ve e-mail ile gönderir.
 */
import nodemailer from "nodemailer";
import { pool } from "../db.js";
import { config } from "../config.js";

interface InvoiceAlert {
  invoiceNo: string | null;
  counterparty: string;
  dueDate: string;
  total: number;
  paidAmount: number;
  remaining: number;
  daysOverdue?: number;
  daysToDue?: number;
  type: "in" | "out";
}

interface DailyReportSummary {
  overdueCount: number;
  overdueTotal: number;
  dueSoonCount: number;
  dueSoonTotal: number;
  cashTotal: number;
}

interface DailyReportResult {
  text: string;
  summary: DailyReportSummary;
}

/** Bir şirket için günlük rapor metni üret */
export async function generateDailyReport(
  companyId: number
): Promise<DailyReportResult> {
  // Şirket bilgisi
  const companyRow = await pool.query<{ name: string; fiscal_year: number }>(
    `SELECT name, fiscal_year FROM companies WHERE id = $1`,
    [companyId]
  );
  if (companyRow.rowCount === 0) {
    throw new Error("Şirket bulunamadı");
  }
  const company = companyRow.rows[0]!;

  // Ayarlar
  const settingsRow = await pool.query<any>(
    `SELECT * FROM notification_settings WHERE company_id = $1`,
    [companyId]
  );
  const settings = settingsRow.rows[0] ?? {
    alert_threshold_days: 7,
    include_overdue: true,
    include_due_soon: true,
    include_upcoming_30: true,
    include_cash_position: true,
  };

  const threshold = settings.alert_threshold_days;

  // Vadesi geçen faturalar
  const overdue = await pool.query<any>(
    `SELECT i.*, (i.total - i.paid_amount) AS remaining,
            (CURRENT_DATE - i.due_date) AS days_overdue
     FROM invoices i
     WHERE i.company_id = $1
       AND i.due_date < CURRENT_DATE
       AND i.paid_amount < i.total
     ORDER BY i.due_date ASC`,
    [companyId]
  );

  // Yaklaşan vadeler
  const dueSoon = await pool.query<any>(
    `SELECT i.*, (i.total - i.paid_amount) AS remaining,
            (i.due_date - CURRENT_DATE) AS days_to_due
     FROM invoices i
     WHERE i.company_id = $1
       AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($2::int * INTERVAL '1 day')
       AND i.paid_amount < i.total
     ORDER BY i.due_date ASC`,
    [companyId, threshold]
  );

  // 30 gün ufku
  const upcoming30 = await pool.query<any>(
    `SELECT i.*, (i.total - i.paid_amount) AS remaining
     FROM invoices i
     WHERE i.company_id = $1
       AND i.due_date BETWEEN CURRENT_DATE + ($2::int * INTERVAL '1 day')
                          AND CURRENT_DATE + INTERVAL '30 days'
       AND i.paid_amount < i.total
     ORDER BY i.due_date ASC`,
    [companyId, threshold]
  );

  // Nakit pozisyonu (basit özet)
  const cashRow = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(balance), 0)::text AS total
     FROM v_bank_balances WHERE company_id = $1 AND currency = 'TRY'`,
    [companyId]
  );
  const cashTotal = parseFloat(cashRow.rows[0]?.total ?? "0");

  // Rapor metnini oluştur
  const date = new Date().toLocaleDateString("tr-TR");
  const lines: string[] = [];
  lines.push(`PROMET CF — GÜNLÜK VADE RAPORU`);
  lines.push(`${company.name} · ${date}`);
  lines.push("=".repeat(60));
  lines.push("");

  const fmtTL = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Özet
  lines.push("ÖZET");
  lines.push("-".repeat(60));
  lines.push(`Vadesi geçen      : ${overdue.rowCount} fatura · ${fmtTL(
    overdue.rows.reduce((s, r) => s + parseFloat(r.remaining), 0)
  )} TL`);
  lines.push(`Yaklaşan (${threshold} gün): ${dueSoon.rowCount} fatura · ${fmtTL(
    dueSoon.rows.reduce((s, r) => s + parseFloat(r.remaining), 0)
  )} TL`);
  if (settings.include_cash_position) {
    lines.push(`TL Nakit Pozisyon : ${fmtTL(cashTotal)} TL`);
  }
  lines.push("");

  // Vadesi geçen detay
  if (settings.include_overdue && overdue.rowCount && overdue.rowCount > 0) {
    lines.push("VADESİ GEÇEN FATURALAR");
    lines.push("-".repeat(60));
    for (const inv of overdue.rows) {
      const tag = inv.type === "out" ? "ALACAK" : "BORÇ";
      lines.push(
        `${tag.padEnd(7)} | ${inv.due_date} | ${(inv.invoice_no ?? "-").padEnd(15)} | ` +
        `${inv.counterparty.substring(0, 25).padEnd(25)} | ` +
        `${fmtTL(parseFloat(inv.remaining)).padStart(15)} TL | ${inv.days_overdue} gün`
      );
    }
    lines.push("");
  }

  // Yaklaşan vadeler
  if (settings.include_due_soon && dueSoon.rowCount && dueSoon.rowCount > 0) {
    lines.push(`YAKLAŞAN VADELER (Önümüzdeki ${threshold} gün)`);
    lines.push("-".repeat(60));
    for (const inv of dueSoon.rows) {
      const tag = inv.type === "out" ? "ALACAK" : "BORÇ";
      lines.push(
        `${tag.padEnd(7)} | ${inv.due_date} | ${(inv.invoice_no ?? "-").padEnd(15)} | ` +
        `${inv.counterparty.substring(0, 25).padEnd(25)} | ` +
        `${fmtTL(parseFloat(inv.remaining)).padStart(15)} TL`
      );
    }
    lines.push("");
  }

  // 30 günlük ufuk
  if (settings.include_upcoming_30 && upcoming30.rowCount && upcoming30.rowCount > 0) {
    lines.push(`30 GÜNLÜK UFUK (${threshold + 1}-30 gün arası)`);
    lines.push("-".repeat(60));
    lines.push(`Toplam ${upcoming30.rowCount} fatura · ${fmtTL(
      upcoming30.rows.reduce((s, r) => s + parseFloat(r.remaining), 0)
    )} TL`);
    lines.push("");
  }

  lines.push("=".repeat(60));
  lines.push("Bu rapor Promet CF tarafından otomatik üretilmiştir.");

  return {
    text: lines.join("\n"),
    summary: {
      overdueCount: overdue.rowCount ?? 0,
      overdueTotal: overdue.rows.reduce((s, r) => s + parseFloat(r.remaining), 0),
      dueSoonCount: dueSoon.rowCount ?? 0,
      dueSoonTotal: dueSoon.rows.reduce((s, r) => s + parseFloat(r.remaining), 0),
      cashTotal,
    },
  };
}

/** E-mail gönder (SMTP kuruluysa) */
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.SMTP_HOST || !config.SMTP_PORT) return null;

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER && config.SMTP_PASS
      ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export async function sendDailyReport(
  companyId: number
): Promise<{ sentTo: string[]; sentAt: string }> {
  const settings = await pool.query<any>(
    `SELECT * FROM notification_settings WHERE company_id = $1 AND enabled = TRUE`,
    [companyId]
  );
  if (settings.rowCount === 0) {
    throw new Error("Bildirimler bu şirket için kapalı");
  }
  const s = settings.rows[0]!;
  const recipients: string[] = s.recipients ?? [];
  if (recipients.length === 0) {
    throw new Error("Alıcı listesi boş");
  }

  const report = await generateDailyReport(companyId);
  const transport = getTransporter();

  if (!transport) {
    // SMTP kurulmamış — sadece veritabanına kaydet (manuel kullanım için)
    await pool.query(
      `INSERT INTO notification_history (company_id, sent_to, subject, body, summary, status, error)
       VALUES ($1, $2, $3, $4, $5, 'failed', $6)`,
      [companyId, recipients, "Günlük Vade Raporu", report.text, report.summary, "SMTP kurulu değil"]
    );
    throw new Error("SMTP kurulu değil — rapor kaydedildi");
  }

  const subject = `Promet CF — Günlük Vade Raporu (${new Date().toLocaleDateString("tr-TR")})`;
  await transport.sendMail({
    from: config.SMTP_FROM,
    to: recipients,
    subject,
    text: report.text,
  });

  // Kayıt
  await pool.query(
    `INSERT INTO notification_history (company_id, sent_to, subject, body, summary, status)
     VALUES ($1, $2, $3, $4, $5, 'sent')`,
    [companyId, recipients, subject, report.text, report.summary]
  );
  await pool.query(
    `UPDATE notification_settings
     SET last_generated_at = NOW(), last_sent_at = NOW()
     WHERE company_id = $1`,
    [companyId]
  );

  return {
    sentTo: recipients,
    sentAt: new Date().toISOString(),
  };
}
