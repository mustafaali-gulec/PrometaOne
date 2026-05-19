# Prometa One — Cron & Email Backend Servisleri

## Kurulum

```bash
cd backend
npm install node-cron nodemailer
```

## Ortam Değişkenleri (.env)

```bash
# CRON
CRON_ENABLED=true
CRON_SCHEDULE="0 9 * * *"      # Her gün saat 9'da
CRON_DRY_RUN=false              # true ise yalnızca log, kayıt etmez

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false                # true ise 465
SMTP_USER=ornek@gmail.com
SMTP_PASS=app-password           # Gmail için "App Password"
SMTP_FROM_NAME="Prometa One"
SMTP_FROM_EMAIL=noreply@promet.com.tr

# App URL (e-posta link'lerinde)
APP_URL=https://prometa.promet.com.tr
```

## Mevcut Backend'e Entegrasyon

`backend/src/server.js` veya `app.js` içine ekleyin:

```javascript
const cronDaemon = require("./services/cronDaemon");
const emailService = require("./services/emailService");

// DB adaptörü — kendi DB'nizden veri çekecek wrapper
const dbAdapter = {
  async getTasks() {
    return await db.collection("data").findOne({ _id: "main" }).then(d => d?.tasks || []);
  },
  async getInvoices() { /* ... */ },
  async getApprovalRequests() { /* ... */ },
  async getChecks() { /* ... */ },
  async getUsers() { /* ... */ },
  async getUserByUsername(uname) { /* ... */ },
  async insertNotification(notif) {
    notif.id = "nt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    notif.createdAt = new Date().toISOString();
    notif.read = false;
    notif.readAt = null;
    await db.collection("data").updateOne(
      { _id: "main" },
      { $push: { notifications: notif } }
    );
  },
};

// Cron başlat
cronDaemon.start(dbAdapter);

// Test endpoint'i (sadece dev için)
app.post("/v1/admin/cron/run", async (req, res) => {
  const result = await cronDaemon.runOnce(dbAdapter);
  res.json(result);
});

app.post("/v1/admin/email/test", async (req, res) => {
  const { to } = req.body;
  const result = await emailService.testEmail(to);
  res.json(result);
});
```

## Docker Compose Güncellemesi

`docker-compose.yml` içindeki `backend` servisine env değişkenlerini ekleyin:

```yaml
services:
  backend:
    # ... mevcut config
    environment:
      # CRON
      - CRON_ENABLED=true
      - CRON_SCHEDULE=0 9 * * *
      # SMTP
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM_NAME=Prometa One
      - SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL}
      - APP_URL=https://prometa.promet.com.tr
```

`.env` dosyasında (Docker Compose root):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM_EMAIL=noreply@promet.com.tr
```

## Kontroller (Cron Daemon)

Otomatik çalışan 5 kontrol:

| # | Kontrol | Sıklık | Bildirim Türü |
|---|---------|--------|---------------|
| 1 | Görev vadesi yaklaşan (≤3 gün) | Günlük 09:00 | `task_due_soon` |
| 2 | Vadesi geçen faturalar | Günlük 09:00 | `invoice_overdue` |
| 3 | 3+ gündür bekleyen onaylar | Günlük 09:00 | `approval_stale` |
| 4 | Vergi takvimi (≤7 gün) | Günlük 09:00 | `tax_deadline_warning` |
| 5 | Çek/senet vadesi (≤5 gün) | Günlük 09:00 | `check_due_soon` |

## SMTP — Gmail Örneği

1. Google hesabınızda **2FA** aktif olmalı
2. https://myaccount.google.com/apppasswords adresinden bir "App Password" oluşturun
3. `.env` dosyasında:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=hesap@gmail.com
   SMTP_PASS=xxxx-xxxx-xxxx-xxxx
   ```

## SMTP — Office 365 Örneği

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=hesap@firma.com
SMTP_PASS=parola
```

## SMTP — Microsoft Exchange (Promet için)

```
SMTP_HOST=mail.promet.com.tr
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@promet.com.tr
SMTP_PASS=...
```

## Test

```bash
# 1. Cron daemon'u tek seferlik çalıştır
curl -X POST http://localhost:3000/v1/admin/cron/run

# 2. Test e-postası gönder
curl -X POST http://localhost:3000/v1/admin/email/test \
  -H "Content-Type: application/json" \
  -d '{"to":"sizin@email.com"}'
```

## Cron Pattern Açıklama

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Haftanın günü (0-7, 0 ve 7 = Pazar)
│ │ │ └─── Ay (1-12)
│ │ └───── Ayın günü (1-31)
│ └─────── Saat (0-23)
└───────── Dakika (0-59)

Örnekler:
"0 9 * * *"      → Her gün saat 09:00
"0 9 * * 1-5"    → Pazartesi-Cuma 09:00
"0 9,17 * * *"   → Her gün 09:00 ve 17:00
"*/15 * * * *"   → 15 dakikada bir
"0 0 1 * *"      → Her ayın 1'i gece 00:00
```

## Production Notları

- **Saat Dilimi**: Container saat dilimi `Europe/Istanbul` olmalı
- **Log**: Cron çıktıları stdout'a yazar, Docker logs ile izlenebilir
- **Hata Toleransı**: Her kontrol bağımsız try-catch içinde, biri patlasa diğerleri çalışır
- **Email Pool**: Nodemailer connection pool kullanır (max 5 paralel)
- **Rate Limit**: SMTP rate limit (10 mail/sn) — bulk gönderim için güvenli
