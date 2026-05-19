/* =====================================================================
   PROMETA ONE — EMAIL SERVICE (SMTP)
   ---------------------------------------------------------------------
   Nodemailer üzerinde SMTP entegrasyonu.
   
   Kullanım:
     const { sendEmail, sendBulk } = require("./emailService");
     await sendEmail({ to: "x@y.com", subject: "...", text: "..." });
   
   Ortam Değişkenleri (.env):
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_SECURE=false   (true ise 465)
     SMTP_USER=ornek@gmail.com
     SMTP_PASS=app-password
     SMTP_FROM_NAME=Prometa One
     SMTP_FROM_EMAIL=noreply@promet.com.tr
===================================================================== */

const nodemailer = require("nodemailer");

// ----- SINGLETON TRANSPORTER -----
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // SMTP konfigürasyonu .env'den
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[EMAIL] SMTP not configured (missing SMTP_HOST/USER/PASS). Emails will not be sent.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,            // bağlantı havuzu
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,        // 1 sn'de
    rateLimit: 10,          // max 10 mesaj
  });

  // İlk açılışta verify
  transporter.verify((err) => {
    if (err) {
      console.error("[EMAIL] SMTP verify failed:", err.message);
    } else {
      console.log("[EMAIL] SMTP ready");
    }
  });

  return transporter;
}

// ----- ANA FONKSİYONLAR -----

/**
 * Tek bir e-posta gönderir.
 * @param {object} opts - { to, subject, text, html, attachments? }
 * @returns {Promise<object>} - { messageId, accepted, rejected }
 */
async function sendEmail({ to, subject, text, html, attachments, cc, bcc, replyTo }) {
  const t = getTransporter();
  if (!t) {
    return { skipped: true, reason: "SMTP not configured" };
  }

  const fromName = process.env.SMTP_FROM_NAME || "Prometa One";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  try {
    const info = await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      cc,
      bcc,
      replyTo,
      subject,
      text,
      html,
      attachments,
    });

    console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (err) {
    console.error(`[EMAIL] Send failed to ${to}:`, err.message);
    throw err;
  }
}

/**
 * Toplu e-posta gönderir.
 * @param {Array} list - [{ to, subject, text, html, ... }]
 * @returns {Promise<object>} - { total, success, failed, results }
 */
async function sendBulk(list) {
  const results = { total: list.length, success: 0, failed: 0, errors: [] };

  for (const opts of list) {
    try {
      await sendEmail(opts);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ to: opts.to, error: err.message });
    }
  }

  console.log(`[EMAIL] Bulk done. Success: ${results.success}, Failed: ${results.failed}`);
  return results;
}

/**
 * Test e-postası gönder.
 */
async function testEmail(to) {
  return sendEmail({
    to,
    subject: "Prometa One - SMTP Test",
    text: "Bu bir test mesajıdır.",
    html: `
      <h2 style="color:#0f766e;">Prometa One - SMTP Test</h2>
      <p>SMTP yapılandırmanız çalışıyor!</p>
      <p style="color:#6b7280;font-size:11pt;">Bu otomatik bir test e-postasıdır.</p>
    `,
  });
}

/**
 * Belirli bir kullanıcıya bildirim e-postası.
 */
async function sendNotificationEmail(user, notification) {
  if (!user?.email) return { skipped: true, reason: "No email" };
  if (user.emailNotifications === false) return { skipped: true, reason: "User opted out" };

  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${notification.title}</title>
<style>
  body { font-family: 'Segoe UI', Helvetica, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
  .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .header { background: linear-gradient(135deg, #0f766e 0%, #15803d 100%); padding: 20px; color: #fff; }
  .header h1 { margin: 0; font-size: 18pt; }
  .header .subtitle { opacity: 0.9; font-size: 11pt; margin-top: 4px; }
  .body { padding: 20px; }
  .body h2 { color: #0f766e; font-size: 13pt; margin-top: 0; }
  .body p { line-height: 1.6; font-size: 11pt; white-space: pre-line; }
  .cta { display: inline-block; padding: 10px 20px; background: #0f766e; color: #fff !important; text-decoration: none; border-radius: 4px; font-weight: 700; margin-top: 12px; }
  .footer { padding: 16px 20px; background: #f3f4f6; font-size: 9pt; color: #6b7280; text-align: center; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>Prometa One</h1>
      <div class="subtitle">Bildirim</div>
    </div>
    <div class="body">
      <h2>${notification.title}</h2>
      <p>${notification.body || ""}</p>
      <a href="${appUrl}/${notification.link || ""}" class="cta">Uygulamayı Aç →</a>
    </div>
    <div class="footer">
      Merhaba ${user.fullName || user.username}, bu otomatik bir bildirimdir.<br>
      E-posta tercihlerinizi <a href="${appUrl}/settings">ayarlardan</a> yönetebilirsiniz.
    </div>
  </div>
</body></html>`;

  return sendEmail({
    to: user.email,
    subject: notification.title,
    text: notification.body,
    html,
  });
}

module.exports = {
  sendEmail,
  sendBulk,
  testEmail,
  sendNotificationEmail,
  getTransporter,
};
