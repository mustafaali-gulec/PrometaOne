/**
 * Email gönderim servisi.
 * 
 * Üç farklı backend destekler — env değişkenleriyle seçilir:
 * 
 * 1. SMTP (varsayılan, nodemailer)
 *    SMTP_HOST=smtp.gmail.com
 *    SMTP_PORT=587
 *    SMTP_USER=noreply@prometahr.com
 *    SMTP_PASS=...
 *    SMTP_FROM="Prometa One <noreply@prometahr.com>"
 * 
 * 2. SendGrid (production önerilen)
 *    SENDGRID_API_KEY=SG.xxx
 *    EMAIL_FROM=noreply@prometahr.com
 * 
 * 3. Console (development)
 *    EMAIL_PROVIDER=console
 *    → email'i console.log eder, gerçekten göndermez
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;
  
  const provider = process.env.EMAIL_PROVIDER || "smtp";
  
  if (provider === "console") {
    // Development modu: mock transporter
    _transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
    return _transporter;
  }
  
  if (provider === "sendgrid") {
    // SendGrid SMTP üzerinden
    _transporter = nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    });
    return _transporter;
  }
  
  // Varsayılan: standart SMTP
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export async function sendMail(options: MailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const provider = process.env.EMAIL_PROVIDER || "smtp";
    
    if (provider === "console") {
      console.log("\n========== EMAIL (CONSOLE MODE) ==========");
      console.log("TO:", options.to);
      console.log("SUBJECT:", options.subject);
      console.log("---");
      console.log(options.text || options.html.replace(/<[^>]+>/g, ""));
      console.log("==========================================\n");
      return { success: true, messageId: `console-${Date.now()}` };
    }
    
    const from = options.from || process.env.SMTP_FROM || process.env.EMAIL_FROM || "noreply@prometahr.com";
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });
    
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("Email gönderim hatası:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Şifre sıfırlama email şablonu (4 dilli)
 */
export function buildPasswordResetEmail(opts: {
  fullName: string;
  token: string;
  resetUrl?: string;       // varsa link içerir, yoksa sadece token gösterilir
  expiresInMinutes: number;
  lang?: "tr" | "en" | "de" | "ar";
}): { subject: string; html: string; text: string } {
  const lang = opts.lang || "tr";
  const isRTL = lang === "ar";
  
  const i18n: Record<string, Record<string, string>> = {
    tr: {
      subject: "Prometa One — Şifre Sıfırlama",
      greeting: "Merhaba",
      intro: "Prometa One hesabınız için bir şifre sıfırlama talebi aldık. Aşağıdaki kodu kullanarak şifrenizi sıfırlayabilirsiniz:",
      codeLabel: "Sıfırlama Kodu",
      expires: "Bu kod {mins} dakika içinde geçersiz olacak.",
      linkLabel: "Veya bağlantıya tıklayın:",
      buttonText: "Şifremi Sıfırla",
      notRequested: "Bu talebi siz yapmadıysanız bu e-postayı görmezden gelin. Hesabınız güvende.",
      footer: "Bu otomatik bir e-postadır, lütfen yanıtlamayın.",
      brand: "Prometa One · Finans ve İK Platformu",
    },
    en: {
      subject: "Prometa One — Password Reset",
      greeting: "Hello",
      intro: "We received a password reset request for your Prometa One account. Use the code below to reset your password:",
      codeLabel: "Reset Code",
      expires: "This code will expire in {mins} minutes.",
      linkLabel: "Or click the link:",
      buttonText: "Reset My Password",
      notRequested: "If you did not request this, please ignore this email. Your account is safe.",
      footer: "This is an automated email, please do not reply.",
      brand: "Prometa One · Finance & HR Platform",
    },
    de: {
      subject: "Prometa One — Passwort zurücksetzen",
      greeting: "Hallo",
      intro: "Wir haben eine Anfrage zum Zurücksetzen des Passworts für Ihr Prometa One-Konto erhalten. Verwenden Sie den unten stehenden Code, um Ihr Passwort zurückzusetzen:",
      codeLabel: "Reset-Code",
      expires: "Dieser Code läuft in {mins} Minuten ab.",
      linkLabel: "Oder klicken Sie auf den Link:",
      buttonText: "Passwort zurücksetzen",
      notRequested: "Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie bitte diese E-Mail. Ihr Konto ist sicher.",
      footer: "Dies ist eine automatisierte E-Mail, bitte antworten Sie nicht.",
      brand: "Prometa One · Finanz- & HR-Plattform",
    },
    ar: {
      subject: "بروميتا وان — إعادة تعيين كلمة المرور",
      greeting: "مرحبا",
      intro: "تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك في بروميتا وان. استخدم الرمز أدناه لإعادة تعيين كلمة المرور:",
      codeLabel: "رمز إعادة التعيين",
      expires: "ستنتهي صلاحية هذا الرمز خلال {mins} دقيقة.",
      linkLabel: "أو انقر على الرابط:",
      buttonText: "إعادة تعيين كلمة المرور",
      notRequested: "إذا لم تقدم هذا الطلب، يرجى تجاهل هذه الرسالة. حسابك آمن.",
      footer: "هذه رسالة تلقائية، يرجى عدم الرد عليها.",
      brand: "بروميتا وان · منصة المالية والموارد البشرية",
    },
  };
  
  const T = i18n[lang] || i18n.tr!;  // Fallback: TR
  const expiresText = T.expires.replace("{mins}", String(opts.expiresInMinutes));
  
  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${isRTL ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8"/>
<title>${T.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f766e 0%,#0a5651 100%);padding:32px 40px;color:#fff;text-align:${isRTL ? "right" : "left"};">
      <div style="font-size:24px;font-weight:600;letter-spacing:-0.03em;">
        prometa<span style="background:#fff;color:#0f766e;font-family:'JetBrains Mono',monospace;font-size:13px;padding:2px 8px;border-radius:3px;margin-${isRTL ? "right" : "left"}:8px;font-weight:700;">ONE</span>
      </div>
    </div>
    
    <!-- Body -->
    <div style="padding:40px;text-align:${isRTL ? "right" : "left"};">
      <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;color:#1c1917;">${T.greeting} ${opts.fullName},</h1>
      <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 24px;">
        ${T.intro}
      </p>
      
      <!-- Token Box -->
      <div style="background:#f5f3ef;border:2px dashed #d6d3d1;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
        <div style="font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">${T.codeLabel}</div>
        <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:36px;font-weight:700;color:#0f766e;letter-spacing:0.15em;">
          ${opts.token}
        </div>
      </div>
      
      <p style="font-size:13px;color:#78716c;margin:0 0 16px;">
        ⏰ ${expiresText}
      </p>
      
      ${opts.resetUrl ? `
        <p style="font-size:14px;color:#44403c;margin:24px 0 12px;">${T.linkLabel}</p>
        <div style="text-align:center;margin:16px 0;">
          <a href="${opts.resetUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:14px;">
            ${T.buttonText}
          </a>
        </div>
      ` : ""}
      
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:32px 0;">
      
      <p style="font-size:13px;color:#78716c;line-height:1.5;margin:0 0 8px;">
        ${T.notRequested}
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background:#fafaf9;padding:20px 40px;border-top:1px solid #e7e5e4;text-align:center;">
      <p style="font-size:12px;color:#78716c;margin:0 0 4px;">${T.footer}</p>
      <p style="font-size:11px;color:#a8a29e;margin:0;">${T.brand}</p>
    </div>
  </div>
</body>
</html>`;
  
  const text = `${T.greeting} ${opts.fullName},

${T.intro}

${T.codeLabel}: ${opts.token}

${expiresText}
${opts.resetUrl ? `\n${T.linkLabel}\n${opts.resetUrl}\n` : ""}
${T.notRequested}

${T.footer}
${T.brand}`;
  
  return {
    subject: T.subject,
    html,
    text,
  };
}
