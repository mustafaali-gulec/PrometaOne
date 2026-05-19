# 📧 Prometa One — E-posta Bildirimleri

Bildirimler artık 3 kanalda gider: **In-app** + **Push** + **E-posta**.

## ✅ Frontend Hazır

### Hazır Özellikler (App.jsx)
- **10 E-posta Şablonu** (HTML, responsive, inline CSS):
  - request_pending, request_approved, request_rejected, request_paid, request_delivered, request_returned
  - leave_pending, leave_approved, leave_rejected
  - comment_added
  - payslip_ready
  - generic
- **Şablon dolduran fonksiyon** `buildEmailFromNotification()`:
  - Placeholder replace (`{{employeeName}}`, `{{amount}}`)
  - Otomatik CTA link üretimi (talep → talepler sekmesi)
  - Detay tablosu (tutar, tarih, taksit vb.)
  - Çoklu dil (TR/EN/DE/AR)
- **Kullanıcı tercih paneli** (Self-Service → Profilim)
  - Genel açma/kapama
  - 11 bildirim tipi için ayrı toggle
  - Toplu özet (digest) — günlük/haftalık
- **Şirket ayarları paneli** (Admin → Settings)
  - 5 provider: SendGrid, Mailgun, AWS SES, SMTP, mailto
  - From address, name, reply-to
  - API key (şifreli) yönetimi
  - **Şablon önizleme** (iframe ile canlı preview)
- **Mailto fallback** — Backend yokken bile çalışır
- **Otomatik tetikleme** — `createNotification` her çağrıldığında push + e-posta otomatik

### Veri Yapısı (createEmptyCompanyData)
```js
hrEmailPreferences: {}     // { username: { enabled, kinds, digest } }
hrEmailLog: []             // Gönderim audit + retry
hrEmailSettings: {         // Şirket bazlı provider config
  provider: "mailto",
  fromAddress: "",
  fromName: "Prometa One",
  apiKey: "",              // Backend'de şifreli
  domain: "",              // Mailgun
  smtpHost, smtpPort, smtpUser, smtpPass,
  enabled: false,
}
```

## ⏳ Backend (Sonra Implement Edilecek)

- `POST /v1/email/send` — Tek e-posta
- `POST /v1/email/send-batch` — Toplu (digest için)
- `GET /v1/email/log` — Geçmiş
- `POST /v1/email/test` — Admin test
- `POST /v1/email/webhook/:provider` — Bounce/delivery

Tam dokümantasyon: `backend/docs/EMAIL_NOTIFICATIONS_API.md`

## 🚀 SendGrid Hızlı Kurulum (Önerilen)

### 1. SendGrid Hesabı Aç
- https://sendgrid.com → Sign Up (free tier: 100 mail/gün)
- **Sender Authentication** → Single Sender Verification
  - From email: `noreply@prometa.com.tr`
  - Doğrulama e-postası gelir

### 2. API Key Üret
- Settings → API Keys → Create API Key
- Permission: **Full Access** veya en azından **Mail Send**
- Key'i kopyala (sadece bir kez gösterilir)

### 3. Frontend'de Provider Seç
1. Admin → Ayarlar → **📧 E-posta Bildirim Ayarları**
2. Provider: **SendGrid**
3. From Address: `noreply@prometa.com.tr`
4. API Key: yapıştır
5. Etkinleştir + Kaydet

### 4. Backend Implementasyonu (Node.js)
```bash
cd backend
npm install @sendgrid/mail html-to-text

# .env'e
SENDGRID_API_KEY=SG.abc123...
EMAIL_PROVIDER=sendgrid
EMAIL_FROM_ADDRESS=noreply@prometa.com.tr

# /v1/email/send endpoint'ini ekle (bkz: API kontratı)
```

### 5. Test Et
- Frontend: Self-Service → Profilim → 📧 E-posta → **🧪 Test**
- Mailto modunda → tarayıcı mail istemcisi açılır
- SendGrid modunda → backend gönderir, inbox'a düşer

## 🚀 Mailgun Hızlı Kurulum

### 1. Domain Doğrula
- https://app.mailgun.com → Sending → Domains
- Yeni domain ekle: `mg.prometa.com.tr`
- DNS kayıtlarını ayarla (TXT, MX, CNAME)
- "Verified" olunca devam et

### 2. API Key Al
- Settings → API Keys → **Private API key**

### 3. Frontend + Backend
Admin Settings → Provider: **Mailgun** → Domain + API Key

```bash
npm install mailgun.js form-data
```

```env
MAILGUN_API_KEY=key-...
MAILGUN_DOMAIN=mg.prometa.com.tr
MAILGUN_REGION=eu                   # EU veya US
```

## 🚀 AWS SES Hızlı Kurulum

### 1. Domain Doğrula
- AWS Console → SES → Verified identities
- Domain ekle, DNS TXT kayıtlarını doğrula
- DKIM keys ayarla

### 2. Production Access İste (önemli!)
- Default: SES sadece doğrulanmış adreslere yollar (sandbox)
- Production access için ticket aç (genelde 24 saatte onaylanır)

### 3. IAM Role
- EC2/Lambda için role oluştur: `AmazonSESFullAccess`
- Local için access key (önerilmez)

### 4. Backend
```bash
npm install @aws-sdk/client-ses
```

```env
AWS_REGION=eu-central-1
EMAIL_PROVIDER=ses
```

## 🚀 Klasik SMTP (Gmail/Office365/Custom)

### Gmail için
- Google hesabınız → Security → 2-Step Verification → App passwords
- "Mail" için app password üret (16 karakter)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youremail@gmail.com
SMTP_PASS=app-password-here
SMTP_SECURE=false
```

### Office365 için
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=user@company.com
SMTP_PASS=...
```

⚠️ Gmail/Office365 günlük gönderim limiti vardır (~500 mail/gün). Yoğun kullanım için Pro provider kullan.

## 🎨 Şablon Önizleme

Admin Settings → E-posta Ayarları → **🎨 Şablon Önizleme**:
- Dropdown'dan bildirim tipi seç
- "▼ Göster" → iframe içinde canlı HTML preview
- Tüm responsive özellikler ve renkler görünür

## 🧪 Test Akışı

### Mailto Modu (Backend olmadan)
1. Admin Settings → Provider: **Mailto**
2. Self-Service → Profilim → 📧 E-posta → **🧪 Test**
3. Tarayıcı mail istemcisi açılır (Outlook, Mail.app, Gmail)
4. Subject/body önceden doldurulmuş

### Provider Modu (Backend hazır)
1. Provider seç + API key gir + Etkinleştir
2. Bir talep oluştur
3. Çalışanın inbox'ına gelmeli (1-2 dakika)
4. HTML render OK, CTA link çalışıyor
5. Reply-To doğru

## 📊 Provider Karşılaştırma

| Provider | Free | $/10K mail | Avantaj | Dezavantaj |
|----------|------|-----------|---------|-----------|
| SendGrid | 100/gün | $19.95/ay | Kolay setup, iyi destek | Free tier düşük |
| Mailgun | 5K/ay | $35/ay | EU bölge, güçlü API | Fiyat |
| AWS SES | 62K/ay (EC2) | $1/ay | En ucuz, ölçeklenir | Sandbox başlangıç |
| SMTP | ∞ | ücretsiz | Var olan altyapı | Düşük volume only |
| Mailto | ∞ | ücretsiz | Backend yok | Manuel tıklama |

## 🌍 Çoklu Dil

`buildEmailFromNotification()` alıcının diline göre HTML üretir:
- `recipientEmp.preferredLang` → TR/EN/DE/AR
- Subject ve body otomatik çevirilir
- RTL desteği (Arapça için `dir="rtl"`)

## 🔐 Güvenlik

- ✅ API keys sadece backend'de + şifreli DB
- ✅ DKIM/SPF/DMARC DNS kayıtları
- ✅ Rate limiting (20 mail/kullanıcı/dakika)
- ✅ Bounce webhook'ları aktif
- ✅ HTML escape kullanıcı içeriği
- ✅ Unsubscribe link her mailde
- ❌ PII (TC, IBAN) e-postada plain text gönderme
- ❌ Şifre veya OTP plain text gönderme

## 🚨 Yaygın Sorunlar

| Sorun | Çözüm |
|---|---|
| Mailler spam'e düşüyor | DKIM/SPF/DMARC ayarla, sender reputation yükselsin |
| 403 forbidden | API key yanlış veya domain doğrulanmamış |
| Gmail "via amazonses.com" gösteriyor | DKIM ayarla, custom MAIL FROM domain |
| HTML render bozuk | Inline CSS kullan, table layout |
| Bounce yüksek | Validate email addresses, suppress list aktif |

## 🎯 Yol Haritası

- [x] Frontend HTML şablon sistemi
- [x] Kullanıcı tercih paneli
- [x] Şirket ayarları paneli (5 provider)
- [x] Şablon önizleme (iframe)
- [x] Mailto fallback
- [x] Otomatik tetikleme (createNotification)
- [x] Backend API kontratı
- [ ] Backend endpoint implementasyonu (Node.js)
- [ ] DKIM/SPF/DMARC DNS kurulumu
- [ ] Bounce webhook handler
- [ ] Digest (toplu özet) cron job
- [ ] Production deploy + monitoring
