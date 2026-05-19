# 📧 Prometa One — Email Notifications API Sözleşmesi

Backend tarafından implement edilmesi gereken endpoint'ler ve veri yapıları.

## 📦 Gerekli Backend Paketleri

### Node.js
```json
{
  "dependencies": {
    "@sendgrid/mail": "^8.1.3",          // SendGrid
    "mailgun.js": "^10.2.1",              // Mailgun
    "@aws-sdk/client-ses": "^3.500.0",   // AWS SES
    "nodemailer": "^6.9.7",               // Klasik SMTP
    "html-to-text": "^9.0.5",             // HTML → plain text
    "handlebars": "^4.7.8"                // Şablon engine (opsiyonel)
  }
}
```

### Python (alternatif)
```
sendgrid==6.11.0
boto3==1.34.34          # AWS SES
mailgun-py==0.0.5
secure-smtplib==0.1.1
```

## 🔑 Environment Variables

```env
# Genel
EMAIL_PROVIDER=sendgrid                 # sendgrid | mailgun | ses | smtp | mailto
EMAIL_FROM_ADDRESS=noreply@prometa.com.tr
EMAIL_FROM_NAME=Prometa One
EMAIL_REPLY_TO=ik@prometa.com.tr

# SendGrid
SENDGRID_API_KEY=SG.abc123...

# Mailgun
MAILGUN_API_KEY=key-...
MAILGUN_DOMAIN=mg.prometa.com.tr
MAILGUN_REGION=us                       # us | eu

# AWS SES
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=...                   # ya da IAM role
AWS_SECRET_ACCESS_KEY=...

# SMTP (klasik)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=noreply@prometa.com.tr
SMTP_PASS=...
SMTP_SECURE=false                       # true=465 SSL, false=587 STARTTLS

# Rate limiting
EMAIL_RATE_LIMIT_PER_USER=20            # /dakika
EMAIL_RATE_LIMIT_GLOBAL=500             # /dakika
```

## 🌐 API Endpoint'leri

### 1️⃣ POST `/v1/email/send`

Bildirim e-postası gönderir. Backend bildirim oluşturulduğunda tetikler.

**Request:**
```json
{
  "to": "mustafa@prometa.com.tr",
  "subject": "✓ Talebiniz Onaylandı",
  "html": "<!DOCTYPE html>...",
  "text": "Talebiniz onaylandı. Detaylar için portala giriş yapın.",
  "fromName": "Prometa One",
  "replyTo": "ik@prometa.com.tr",
  "meta": {
    "kind": "request_approved",
    "recipientUserId": "mustafa",
    "notificationId": "nt_abc123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "<abc.123@sendgrid.net>",
  "provider": "sendgrid"
}
```

**Hata Response:**
```json
{
  "success": false,
  "error": "Invalid recipient",
  "code": "RECIPIENT_INVALID"
}
```

---

### 2️⃣ POST `/v1/email/send-batch`

Toplu e-posta (digest) gönderir.

**Request:**
```json
{
  "emails": [
    { "to": "...", "subject": "...", "html": "..." },
    ...
  ]
}
```

---

### 3️⃣ GET `/v1/email/log`

E-posta gönderim geçmişi (audit).

**Query params:**
- `username` — Kullanıcı filtreleme
- `kind` — Bildirim tipine göre
- `status` — sent | failed | bounced
- `from`, `to` — tarih aralığı

**Response:**
```json
{
  "items": [
    {
      "id": "el_abc123",
      "to": "mustafa@prometa.com.tr",
      "subject": "✓ Talebiniz Onaylandı",
      "status": "sent",
      "provider": "sendgrid",
      "sentAt": "2026-05-15T14:30:00Z",
      "messageId": "<abc.123@sendgrid.net>",
      "meta": { "kind": "request_approved" }
    }
  ],
  "total": 1
}
```

---

### 4️⃣ POST `/v1/email/test`

Test e-postası gönderir (admin için).

---

### 5️⃣ POST `/v1/email/webhook` (gelen webhook)

E-posta sağlayıcılarından bounce/spam/delivery webhook'larını kabul eder.

**SendGrid webhook events:**
- `delivered`
- `bounce`
- `dropped`
- `spamreport`

**Mailgun events:**
- `delivered`
- `failed`
- `complained`

Bounce alındığında:
- `hrEmailLog` tablosunda durumu `bounced` yap
- Çok fazla bounce varsa kullanıcının e-postasını flag'le

---

## 📤 SendGrid Sender (Node.js)

```javascript
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendViaSendGrid({ to, subject, html, text, fromName, replyTo }) {
  const msg = {
    to,
    from: {
      email: process.env.EMAIL_FROM_ADDRESS,
      name: fromName || process.env.EMAIL_FROM_NAME,
    },
    replyTo: replyTo || process.env.EMAIL_REPLY_TO,
    subject,
    html,
    text: text || htmlToText(html),
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
    },
  };

  try {
    const [response] = await sgMail.send(msg);
    return {
      success: true,
      messageId: response.headers["x-message-id"],
      statusCode: response.statusCode,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      code: err.code,
    };
  }
}
```

## 📤 Mailgun Sender (Node.js)

```javascript
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mg = new Mailgun(formData);
const mgClient = mg.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY,
  url: process.env.MAILGUN_REGION === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net",
});

async function sendViaMailgun({ to, subject, html, text, fromName, replyTo }) {
  try {
    const result = await mgClient.messages.create(process.env.MAILGUN_DOMAIN, {
      from: `${fromName || "Prometa One"} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      "h:Reply-To": replyTo || process.env.EMAIL_REPLY_TO,
      subject,
      html,
      text: text || htmlToText(html),
      "o:tracking": "yes",
      "o:tracking-clicks": "yes",
      "o:tracking-opens": "yes",
    });
    return { success: true, messageId: result.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

## 📤 AWS SES Sender (Node.js)

```javascript
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const ses = new SESClient({ region: process.env.AWS_REGION });

async function sendViaSes({ to, subject, html, text, fromName, replyTo }) {
  const command = new SendEmailCommand({
    Source: `"${fromName || "Prometa One"}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    Destination: { ToAddresses: [to] },
    ReplyToAddresses: [replyTo || process.env.EMAIL_REPLY_TO],
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: { Data: text || htmlToText(html), Charset: "UTF-8" },
      },
    },
  });

  try {
    const result = await ses.send(command);
    return { success: true, messageId: result.MessageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

## 📤 SMTP Sender (Node.js)

```javascript
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendViaSmtp({ to, subject, html, text, fromName, replyTo }) {
  try {
    const info = await transporter.sendMail({
      from: `"${fromName || 'Prometa One'}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      replyTo: replyTo || process.env.EMAIL_REPLY_TO,
      subject,
      html,
      text: text || htmlToText(html),
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

## 🎯 Provider Dispatcher

```javascript
async function sendEmail({ to, subject, html, text, fromName, replyTo, meta }) {
  const provider = process.env.EMAIL_PROVIDER || "sendgrid";

  // HTML → text fallback
  if (!text && html) text = htmlToText(html);

  // Rate limiting kontrolü
  const canSend = await checkRateLimit(meta?.recipientUserId);
  if (!canSend) {
    return { success: false, error: "Rate limit exceeded", code: "RATE_LIMIT" };
  }

  let result;
  switch (provider) {
    case "sendgrid": result = await sendViaSendGrid({ to, subject, html, text, fromName, replyTo }); break;
    case "mailgun":  result = await sendViaMailgun({ to, subject, html, text, fromName, replyTo }); break;
    case "ses":      result = await sendViaSes({ to, subject, html, text, fromName, replyTo }); break;
    case "smtp":     result = await sendViaSmtp({ to, subject, html, text, fromName, replyTo }); break;
    default:
      return { success: false, error: "Unknown provider: " + provider };
  }

  // E-posta log'una kaydet
  await db.email_log.insert({
    to,
    subject,
    status: result.success ? "sent" : "failed",
    provider,
    sentAt: new Date(),
    messageId: result.messageId,
    error: result.error,
    meta,
  });

  return result;
}
```

## 🗄️ Veritabanı Şemaları

### `email_log`
```sql
CREATE TABLE email_log (
  id VARCHAR(50) PRIMARY KEY,
  to_address VARCHAR(255) NOT NULL,
  from_address VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  status VARCHAR(20) NOT NULL,          -- sent | failed | bounced | spam
  provider VARCHAR(20) NOT NULL,
  message_id VARCHAR(255),
  error_message TEXT,
  meta JSONB,
  sent_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ
);

CREATE INDEX idx_email_log_to ON email_log(to_address);
CREATE INDEX idx_email_log_status ON email_log(status);
CREATE INDEX idx_email_log_sent_at ON email_log(sent_at DESC);
```

### `email_preferences`
```sql
CREATE TABLE email_preferences (
  username VARCHAR(50) PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  kinds JSONB,
  digest JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `email_settings` (şirket bazlı)
```sql
CREATE TABLE email_settings (
  company_id VARCHAR(50) PRIMARY KEY,
  provider VARCHAR(20),
  from_address VARCHAR(255),
  from_name VARCHAR(100),
  reply_to VARCHAR(255),
  api_key_encrypted TEXT,                 -- AES-256 ile şifreli
  domain VARCHAR(255),                     -- Mailgun için
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_user VARCHAR(255),
  smtp_pass_encrypted TEXT,
  enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔐 API Key Şifreleme

```javascript
const crypto = require("crypto");

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex"); // 32 byte
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

## 📌 Digest (Toplu Özet) Cron

```javascript
const cron = require("node-cron");

// Her gün 09:00'da digest gönder
cron.schedule("0 9 * * *", async () => {
  const users = await db.email_preferences.find({
    "digest.enabled": true,
    "digest.frequency": "daily",
  });

  for (const user of users) {
    const employee = await db.employees.findOne({ userId: user.username });
    if (!employee?.email) continue;

    // Son 24 saatte oluşan bildirimleri topla
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const notifs = await db.notifications.find({
      recipientUserId: user.username,
      createdAt: { $gte: since },
    });

    if (notifs.length === 0) continue;

    const html = generateDigestHtml(notifs, user, employee);
    await sendEmail({
      to: employee.email,
      subject: `Prometa One — Günlük Özet (${notifs.length} bildirim)`,
      html,
      meta: { kind: "digest", recipientUserId: user.username },
    });
  }
});

// Her Pazartesi 09:00'da haftalık özet
cron.schedule("0 9 * * 1", async () => {
  // Aynı mantık, since = 7 days ago
});
```

## 🎨 HTML Şablon Optimizasyonu

E-posta HTML'i mümkün olduğunca **inline CSS** ve **tablo bazlı layout** kullanmalı:
- Gmail, Outlook, Yahoo Mail farklı CSS desteği
- `<style>` etiketi bazı client'larda silinir
- `flexbox` ve `grid` desteklenmiyor — table layout şart
- Web font'lar yerine system fallback'lar kullan
- Resimler `https://` ile mutlak URL

Frontend'deki `generateEmailHtml()` zaten bu kuralları takip eder.

## 🚨 Bounce/Spam Yönetimi

```javascript
// Webhook handler
app.post("/v1/email/webhook/:provider", async (req, res) => {
  const events = req.body;
  for (const event of events) {
    if (event.event === "bounce" || event.event === "dropped") {
      // E-posta log'unu güncelle
      await db.email_log.update(
        { messageId: event.sg_message_id || event["message-id"] },
        { status: "bounced", bouncedAt: new Date(), bounceReason: event.reason }
      );

      // Çok bounce eden e-postayı flag'le
      const recentBounces = await db.email_log.count({
        to_address: event.email,
        status: "bounced",
        sent_at: { $gte: new Date(Date.now() - 30 * 86400000) },
      });

      if (recentBounces >= 3) {
        // E-posta gönderimi kapat
        await db.email_preferences.update(
          { username: getUsernameByEmail(event.email) },
          { enabled: false, suspendedReason: "Hard bounce" }
        );
      }
    }
  }
  res.json({ ok: true });
});
```

## 🌍 Çoklu Dil Desteği

Frontend `buildEmailFromNotification()` zaten alıcının diline göre konu/içerik üretir:
- `recipientEmp.preferredLang` öncelikli
- yoksa `lang` parametresi
- fallback: TR

Backend'de de aynı mantığı uygula — kullanıcı dilinde gönder.

## ⚠️ Güvenlik & Best Practices

- [ ] API key'leri sadece backend env'de + şifreli DB'de
- [ ] DKIM/SPF/DMARC kayıtları DNS'te ayarlı
- [ ] Rate limiting (kullanıcı + global)
- [ ] PII içeren bilgiler (TC, IBAN) e-postada plain text gönderilmez
- [ ] Unsubscribe link her e-postada (List-Unsubscribe header)
- [ ] HTML escape kullanıcı girdisi (özellikle reason, comment)
- [ ] Bounce/complaint webhook'ları aktif
- [ ] Şüpheli kullanıcı domain'leri için domain whitelist
- [ ] SendGrid/Mailgun sender verification yapılı

## 📊 Provider Karşılaştırması

| Provider | Free Tier | Pricing (10K mail) | Türkiye SLA | Önerilen |
|----------|-----------|-------------------|-------------|----------|
| SendGrid | 100/gün | $19.95/mo | ✓ İyi | ⭐ Önerilen |
| Mailgun | 5K/ay | $35/mo | ✓ İyi | ✓ |
| AWS SES | 62K (EC2'den) | $1/mo | ⚠ Bölge | ✓ Ucuz |
| SMTP | Sınırsız | Ücretsiz | ⚠ IP reputation | Sadece düşük hacim |

## 🎯 Frontend ↔ Backend Akışı

```
[Bildirim oluşturuldu - createNotification()]
       ↓
[Frontend: getUserEmailPreferences() kontrolü]
       ↓ izin var
[buildEmailFromNotification() → HTML üret]
       ↓
[POST /v1/email/send]
       ↓
[Backend: rate limit check]
       ↓
[Provider'a göre: SendGrid/Mailgun/SES/SMTP]
       ↓
[Başarılı/Başarısız → email_log tablosuna]
       ↓
... (zamanla)
       ↓
[Webhook: delivered/bounced]
       ↓
[email_log güncelle, kullanıcıyı flag'le]
```
