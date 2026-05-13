# Prometa One — Backend API

Production-ready Node.js + Hono + PostgreSQL backend for **Prometa One** Finance & HR Platform.

> **Stack:** Node.js 20 · TypeScript · Hono · PostgreSQL 16 · bcrypt · JWT · node-cron · nodemailer

---

## Şifre Sıfırlama Akışı (Yeni)

### Frontend tarafında

Frontend `window.PROMETA_API.sendPasswordResetEmail(...)` çağırır. Bu mevcut değilse demo modu devreye girer (token console'a yazılır).

Production'da `window.PROMETA_API`'yi şöyle tanımlayın:

```javascript
window.PROMETA_API = {
  sendPasswordResetEmail: async ({ username, email, token }) => {
    return fetch("/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrUsername: email || username, lang: "tr" }),
    }).then(r => r.json());
  },
  resetPassword: async ({ token, newPassword }) => {
    return fetch("/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    }).then(r => r.json());
  },
};
```

### Backend tarafında — Email konfigürasyonu

`.env` dosyasında 3 provider'dan birini seçin:

**1. Console (development)** — Email gerçek gönderilmez, console'a yazılır:
```env
EMAIL_PROVIDER=console
```

**2. SMTP (Gmail/Outlook/custom)**:
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@prometahr.com
SMTP_PASS=your-app-password  # Gmail için: https://myaccount.google.com/apppasswords
SMTP_FROM="Prometa One <noreply@prometahr.com>"
```

**3. SendGrid (production önerilen)**:
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=noreply@prometahr.com
```

### Email Şablonu

Email şablonu **4 dili** destekler (tr/en/de/ar) ve `lang` parametresine göre otomatik seçer. Şablon `src/services/mailer.ts` içinde `buildPasswordResetEmail()` fonksiyonunda.

### API Endpoints

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/v1/auth/forgot-password` | Token iste + email gönder. Body: `{emailOrUsername, lang?}` |
| GET  | `/v1/auth/verify-reset-token?token=xxx` | Token geçerli mi kontrol et |
| POST | `/v1/auth/reset-password` | Yeni şifre belirle. Body: `{token, newPassword}` |

### Güvenlik Özellikleri

- ✅ **Bilgi sızdırma yok** — Kullanıcı bulunamasa bile aynı yanıt döner
- ✅ **Token süresi 15 dakika** — `expires_at` ile DB seviyesinde
- ✅ **Tek kullanımlık** — `used_at` set edildikten sonra geçersiz
- ✅ **Eski tokenler iptal** — Yeni istek geldiğinde eski tokenler invalide edilir
- ✅ **Session purge** — Şifre sıfırlandığında tüm aktif session'lar iptal
- ✅ **Audit log** — Her talep ve sıfırlama audit'e işlenir
- ✅ **IP & UA tracking** — `password_resets` tablosunda kayıtlı

---

## Hızlı Başlangıç

### Docker Compose ile (önerilen)

```bash
# 1. Env değişkenleri
cp .env.example .env
# .env içinde JWT_SECRET ve JWT_REFRESH_SECRET'ı en az 32 karakter rastgele değerlerle değiştirin

# 2. Postgres + API'yi başlat
docker compose up -d

# 3. Migration'ları çalıştır
docker compose exec api npm run migrate

# 4. Seed (örnek veriler + 4 demo kullanıcı)
docker compose exec api npm run seed

# 5. Adminer (DB UI) — opsiyonel
docker compose --profile tools up -d
# → http://localhost:8080
```

API hazır: **http://localhost:3000/v1**

Health check: `curl http://localhost:3000/v1/health`

### Manuel kurulum (Docker'sız)

```bash
# Sistem gereksinimleri:
#   - Node.js 20+
#   - PostgreSQL 16+

# 1. Veritabanı
createdb promet_cf

# 2. Bağımlılıklar
npm install

# 3. Env
cp .env.example .env
# DATABASE_URL ve JWT_SECRET'ı düzenleyin

# 4. Migration + seed
npm run migrate
npm run seed

# 5. Dev server (hot reload ile)
npm run dev

# Production build:
npm run build
npm start
```

---

## Demo Kullanıcılar (seed sonrası)

| Kullanıcı | Şifre | Rol |
|---|---|---|
| `admin` | `admin123` | admin |
| `mustafa` | `promet` | cfo |
| `editor` | `editor123` | editor |
| `viewer` | `viewer123` | viewer |

⚠️ Bu şifreleri **production'da hemen değiştirin**: `POST /v1/auth/change-password`

---

## Proje Yapısı

```
api-server/
├── package.json, tsconfig.json, .env.example
├── Dockerfile, docker-compose.yml, .dockerignore
├── migrations/         # SQL migration dosyaları (.sql, sıralı)
├── seed.sql           # Demo veriler
├── scripts/
│   ├── migrate.js     # Migration runner (idempotent)
│   └── seed.js        # Seed runner (bcrypt parolaları)
└── src/
    ├── index.ts       # Hono app entry
    ├── config.ts      # ENV → zod-doğrulanmış config
    ├── db.ts          # pg pool + helpers
    ├── types.ts       # OpenAPI'dan TypeScript tipleri
    ├── middleware/
    │   ├── auth.ts    # JWT verify, requireRole, requireCompanyAccess
    │   ├── audit.ts   # Audit log writer
    │   └── error.ts   # Global error handler
    ├── services/
    │   ├── auth.ts            # JWT sign, bcrypt, session yönetimi
    │   ├── tcmb.ts            # TCMB EVDS API + cache
    │   ├── notifications.ts   # Günlük rapor üretici + nodemailer
    │   ├── ai.ts              # Linear regression + MA + ES ensemble
    │   └── cron.ts            # Scheduler (TCMB, notifications, cleanup)
    └── routes/
        ├── auth.ts            # /v1/auth/* (login, refresh, logout, me, change-password)
        ├── companies.ts       # /v1/companies/* (+ kritik /state bootstrap)
        ├── cells.ts           # /v1/companies/:cid/categories, cells
        ├── invoices.ts        # /v1/companies/:cid/invoices (+ bulk-commit)
        └── misc.ts            # banks, kasa, transfers, fx, archives, audit, notifications, ai
```

---

## Mimari Notlar

### Authentication

- **Access token**: 15 dakika TTL, request başına `Authorization: Bearer <token>`
- **Refresh token**: 7 gün TTL, `sessions` tablosunda sha256 hash'lenmiş şekilde saklanır
- 401 alındığında frontend `/v1/auth/refresh` ile yeni access token alır
- Şifre değişiminde tüm session'lar revoke edilir

### Şirket-Bazlı Erişim

Her şirket-scoped endpoint `requireCompanyAccess(minRole)` middleware'i ile korunur:

1. **Admin** her şirkete otomatik erişir
2. Diğer roller için `user_company_access` tablosuna bakılır
3. Per-company rol override edilebilir (örn: bir kullanıcı Şirket A'da CFO, Şirket B'de viewer)

### Bootstrap: `/companies/:cid/state`

Frontend'in tek seferde tüm şirket verisini alabilmesi için tasarlandı. 11 paralel query ile:
- Şirket, kategoriler, hücreler, banka hesapları (bakiyeli), kasa, hareketler
- Transferler, faturalar (ödemelerle birlikte), revaluations
- Bildirim ayarları, arşiv metadata

### Bulk-Commit (en kritik iş kuralı)

`POST /v1/companies/:cid/invoices/bulk-commit` — bekleyen tüm faturaları, kasa hareketlerini ve transferleri nakit akış hücrelerine yansıtır:

1. Tek transaction içinde tüm pending kayıtları al
2. `(catId, monthIdx)` çiftlerine göre delta toplamı hesapla
3. `cells` tablosuna `+=` semantiği ile upsert
4. Tüm kaynak kayıtları `committed_to_cells=TRUE` işaretle

### AI Tahmin Algoritması

`predictForCompany()` 3 yöntem birleşimi:
- Linear regression (trend)
- 3-month moving average
- Exponential smoothing (α=0.4)

Ağırlıklar R²'ye göre dinamik: yüksek R² → linear daha baskın. Çoklu yıl arşivlerinden tarihsel veri zenginleştirme.

### Cron

Tek-instance deployment için in-process `node-cron`. 3 görev:
- **09:30 hafta içi**: TCMB kurları çek + DB cache
- **Her saat başı**: aktif `notification_settings.cron_schedule`'a göre bildirim gönder
- **Gece yarısı**: eski session'ları temizle

Multi-instance için `ENABLE_CRON=false` ile kapatıp ayrı worker çalıştırın.

---

## API Endpoints

Tam spesifikasyon için `openapi.yaml` dosyasına bakın. Özet:

| Group | Endpoint örnekleri |
|---|---|
| Auth | `POST /v1/auth/login`, `/refresh`, `/logout`, `GET /auth/me` |
| Companies | `GET /v1/companies`, `POST /v1/companies`, `GET /v1/companies/:cid/state` |
| Cells | `GET/PUT /v1/companies/:cid/cells`, `PUT /v1/companies/:cid/cells/:catId/:monthIdx` |
| Invoices | `POST /v1/companies/:cid/invoices`, `POST /v1/companies/:cid/invoices/bulk-commit` |
| FX | `GET /v1/exchange-rates`, `POST /v1/exchange-rates/fetch-tcmb`, `POST /v1/companies/:cid/revaluations` |
| Archives | `POST /v1/companies/:cid/archives/close-year`, `GET /v1/companies/:cid/archives/:year` |
| AI | `GET /v1/companies/:cid/ai/predictions?horizon=3` |
| Audit | `GET /v1/audit-logs?from=&to=&action=&companyId=` |

---

## Environment Variables

| Variable | Default | Açıklama |
|---|---|---|
| `NODE_ENV` | `development` | `production`, `development`, `test` |
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | — | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET` | — | **Zorunlu**, min 32 karakter |
| `JWT_REFRESH_SECRET` | — | **Zorunlu**, JWT_SECRET'tan farklı |
| `JWT_ACCESS_EXPIRES` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES` | `7d` | Refresh token TTL |
| `CORS_ORIGINS` | `http://localhost:5173` | Virgülle ayrılmış origin'ler |
| `BCRYPT_ROUNDS` | `10` | Cost factor (10-14 önerilir) |
| `TCMB_API_KEY` | (opsiyonel) | Yoksa public endpoint |
| `SMTP_HOST` | (opsiyonel) | E-mail gönderimi için |
| `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | | |
| `ENABLE_CRON` | `true` | Cron jobs in-process çalışsın mı |

---

## Production Deployment

### Kontrol listesi

- [ ] `JWT_SECRET` ve `JWT_REFRESH_SECRET` rastgele 64-karakter değerler (`openssl rand -hex 32`)
- [ ] Demo kullanıcı parolalarını değiştir veya sil
- [ ] `CORS_ORIGINS` sadece frontend domain'ini içersin
- [ ] HTTPS reverse proxy (nginx/Caddy/Traefik)
- [ ] Database backup stratejisi (`pg_dump` cron)
- [ ] Log aggregation (`docker logs` veya syslog/Loki)
- [ ] Health check monitoring (`/v1/health`)
- [ ] Multi-instance kullanılacaksa `ENABLE_CRON=false` + ayrı cron worker

### Reverse proxy örneği (nginx)

```nginx
server {
  listen 443 ssl http2;
  server_name api.promet-cf.example.com;
  ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }
}
```

### Backup

```bash
# Günlük tam yedek
docker compose exec -T postgres pg_dump -U promet promet_cf | gzip > backup-$(date +%F).sql.gz

# Geri yükleme
gunzip < backup-2026-05-12.sql.gz | docker compose exec -T postgres psql -U promet promet_cf
```

---

## Geliştirme

```bash
# Type check
npm run lint

# Test (basit smoke tests)
npm test

# Production build kontrol
npm run build && npm start
```

### Yeni endpoint ekleme

1. `openapi.yaml`'a endpoint tanımını ekle
2. `src/types.ts`'e request/response tiplerini ekle
3. İlgili route dosyasına Hono handler'ı ekle:
   ```ts
   router.post(
     "/:cid/my-endpoint",
     requireCompanyAccess("editor"),
     zValidator("json", z.object({ ... })),
     async (c) => { ... }
   );
   ```
4. Audit log eklemeyi unutma: `await logAudit(c, "action_name", { ... }, cid);`

---

## Lisans

Proprietary — Promet HR Teknoloji A.Ş.
