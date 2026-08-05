# 🏢 M Suite

**Sürüm:** 5B (Bildirim + Yorum + Push + E-posta entegre)
**Tarih:** Mayıs 2026
**Stack:** React 18 + Vite + Node.js/Express + PostgreSQL + Docker

Türkiye finans + İK + AI iş yönetim platformu.

---

## 📦 Paket İçeriği

```
prometa-one/
├── frontend/                      ← React JSX frontend (Vite)
│   ├── src/
│   │   ├── App.jsx                ← 🎯 ANA KOD (41.5K satır / 1.79 MB)
│   │   ├── main.jsx
│   │   ├── api.js
│   │   └── styles.css
│   ├── public/
│   │   ├── sw.js                  ← Service Worker (Web Push)
│   │   └── manifest.webmanifest   ← PWA manifest
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── .env.example
│
├── api-server/                    ← Backend (Express + TypeScript)
│   ├── src/
│   │   ├── index.ts               ← Ana entry point
│   │   ├── config.ts
│   │   ├── db.ts                  ← PostgreSQL pool
│   │   ├── middleware/            ← auth, audit, error handler
│   │   ├── routes/                ← REST endpoint'leri
│   │   └── services/              ← business logic (AI, e-invoice, TCMB)
│   ├── migrations/                ← SQL migration'ları (010 dosya)
│   ├── scripts/
│   │   ├── migrate.js
│   │   └── seed.js
│   ├── seed.sql
│   ├── docker-compose.yml         ← PostgreSQL + Adminer
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── backend/docs/                  ← API Sözleşmeleri (referans)
│   ├── PUSH_NOTIFICATIONS_API.md  ← Push endpoint kontratı
│   └── EMAIL_NOTIFICATIONS_API.md ← E-posta endpoint kontratı
│
├── start-backend.bat              ← Windows: backend başlat
├── start-frontend.bat             ← Windows: frontend başlat
├── stop-all.bat                   ← Windows: tümünü durdur
│
├── WINDOWS_KURULUM.md             ← Adım adım Windows kurulum
├── MOBILE_PUSH_README.md          ← Push bildirimleri kullanım
└── EMAIL_NOTIFICATIONS_README.md  ← E-posta bildirimleri kurulum
```

---

## ⚡ Hızlı Başlangıç (Windows)

### Önkoşullar

- **Node.js 20+** — https://nodejs.org
- **Docker Desktop** — https://docker.com/products/docker-desktop
- **Git** (opsiyonel) — https://git-scm.com

### 1. Klasörü Aç

ZIP'i bir yere aç (ör: `C:\prometa-one\`).

### 2. Backend Başlat

```bat
cd C:\prometa-one
start-backend.bat
```

İlk açılışta:

- PostgreSQL Docker container başlar (port 5432)
- Adminer başlar (port 8080) — http://localhost:8080
- `api-server` `npm install` yapar
- Migration'lar otomatik çalışır
- Backend `localhost:3000/v1` adresinde hazır

### 3. Frontend Başlat

**Yeni bir CMD penceresinde:**

```bat
cd C:\prometa-one
start-frontend.bat
```

- `frontend` `npm install` yapar (~3-5 dakika)
- Vite dev server başlar (port 5173)
- http://localhost:5173

### 4. Login

- **Admin**: `admin` / `admin123`
- **CFO**: `mustafa` / `promet`

---

## 🛑 Sistemi Durdurmak

```bat
stop-all.bat
```

veya manuel:

```bat
docker-compose -f C:\prometa-one\api-server\docker-compose.yml down
taskkill /F /IM node.exe
```

---

## 🎯 Sistem Özellikleri (Tam Liste)

### 💰 Finans

- ✓ Bütçe takvimi (12 ay × kategori matrisi)
- ✓ Kasa & banka yönetimi (TL/USD/EUR multi-currency)
- ✓ Tahsilat/ödeme cell sistemi (her gün için)
- ✓ Banka transferi takibi
- ✓ E-Fatura (eLogo entegrasyonu, UBL parser)
- ✓ Döviz kuru tarihçesi (TCMB API)
- ✓ Yeniden değerleme (revaluation)
- ✓ Çoklu şirket desteği

### 👥 İnsan Kaynakları

- ✓ Çalışan & organizasyon yönetimi (4-tier: şirket → bölüm → departman → birim)
- ✓ İşe Alım (ATS) — Kanban iş ilanı + CV OCR (Tesseract.js + pdf.js)
- ✓ Pozisyon kütüphanesi
- ✓ Performans değerlendirme

### 💵 Bordro

- ✓ Türkiye mevzuatı uyumlu bordro motoru
  - Asgari ücret, SGK, GV, DV, AR-Ge teşvik
  - Yıllık parametre versiyonlama (2024/2025/2026)
- ✓ Kümülatif gelir vergisi (Ocak→geçerli ay simülasyonu)
- ✓ Yan hak sözleşmeleri (Sağlık/BES/Yemek/Yol kart)
- ✓ Bordro bileşen kütüphanesi (custom formüller)

### ⏰ Puantaj & İzin

- ✓ Toplu puantaj (matris view, sticky col)
- ✓ Takvimli puantaj (31-gün grid)
- ✓ PDKS CSV import (TC/SGK/Email match)
- ✓ İzin talep workflow (10 izin tipi, balance check)
- ✓ İzin onayı → takvime otomatik yansıma

### 📋 Talep Sistemi

- ✓ Avans (bordroya otomatik taksit kesinti)
- ✓ Masraf (10 kategori, KDV, belge)
- ✓ Zimmet (14 tip, stok entegrasyonu, teslim/iade)
- ✓ Unified yönetim, status filtreleri

### 🌟 Self-Service Portal

- ✓ 8 sekme (Ana sayfa / İzin / Avans / Masraf / Zimmet / Bordro / Puantaj / Profil)
- ✓ Mor tema, kişisel veri izolasyonu
- ✓ Tüm taleplerini kendi adına oluşturabilir
- ✓ Yıllık karne, performans öz-görünüm

### 🔔 Bildirim Sistemi

- ✓ In-app feed (bell + dropdown + badge)
- ✓ Yorum thread'leri (chat-tarzı, yönetici/çalışan ayrımı)
- ✓ Mobile Push (Web Push API + Service Worker)
- ✓ E-posta bildirimleri (5 provider: SendGrid/Mailgun/SES/SMTP/mailto)
- ✓ Push tercih paneli (10 toggle + sessiz saatler)
- ✓ E-posta tercih paneli (11 toggle + digest)
- ✓ HTML şablon önizleme (iframe)
- ✓ PWA manifest (Ana Ekrana Ekle desteği)

### 🤖 AI

- ✓ AI Asistan widget (Anthropic Claude API)
- ✓ Doğal dil sorgu → finansal analiz
- ✓ Şirket verisi context

### 🌍 Çoklu Dil

- ✓ TR (Türkçe), EN (English), DE (Deutsch), AR (العربية)
- ✓ RTL desteği (Arapça için sağdan-sola)

### 🔒 Yetkilendirme

- ✓ Rol bazlı (admin, cfo, editor, viewer, employee)
- ✓ Kaynak bazlı izin (RBAC)
- ✓ Audit log her aksiyonda

---

## 📚 Dokümantasyon

| Dosya                                     | İçerik                                       |
| ----------------------------------------- | -------------------------------------------- |
| `WINDOWS_KURULUM.md`                      | Adım adım Windows kurulum talimatı           |
| `MOBILE_PUSH_README.md`                   | Push bildirim kurulumu (VAPID, FCM, APN)     |
| `EMAIL_NOTIFICATIONS_README.md`           | E-posta kurulumu (SendGrid/Mailgun/SES/SMTP) |
| `backend/docs/PUSH_NOTIFICATIONS_API.md`  | Push API endpoint kontratı                   |
| `backend/docs/EMAIL_NOTIFICATIONS_API.md` | E-posta API endpoint kontratı                |
| `api-server/README.md`                    | Backend mimarisi ve geliştirme               |
| `api-server/FRONTEND_MIGRATION.md`        | Frontend ↔ Backend entegrasyon notları       |

---

## 🆘 Sorun Giderme

### Frontend yüklenmiyor

```bat
cd C:\prometa-one\frontend
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```

### Backend bağlanmıyor

```bat
cd C:\prometa-one\api-server
docker-compose down
docker-compose up -d postgres
# 30 saniye bekle
docker-compose logs postgres
npm install
npm run migrate
npm run dev
```

### Port çakışması

- Backend port 3000, Frontend port 5173, PostgreSQL port 5432, Adminer port 8080
- Bunlar kullanımdaysa `.env` ve `docker-compose.yml`'de değiştir

### Sunucu kapanıyor / "EADDRINUSE"

```bat
taskkill /F /IM node.exe
```

### "App.jsx çok büyük" — Vite yavaş

`vite.config.js`'e:

```js
export default {
  server: { warmup: { clientFiles: ['./src/App.jsx'] } },
  esbuild: { logLevel: 'error' },
};
```

---

## 📊 İstatistikler

- **Frontend kod**: 41.544 satır (App.jsx)
- **Backend kod**: ~3500 satır TypeScript
- **Migration'lar**: 10 dosya
- **Toplam dosya**: 60+
- **Toplam boyut**: ~2.8 MB (node_modules hariç)

---

## 📞 İletişim

Bu, Promet Bilgi Sistemleri A.Ş. için Mustafa tarafından geliştirilmiş özel sistemdir.

---

## 🎉 Test Kontrolü

İlk çalıştırma sonrası test akışı için `WINDOWS_KURULUM.md` içindeki **🧪 Hızlı Test** bölümüne bak.

**Mutlu çalışmalar!** 🚀
