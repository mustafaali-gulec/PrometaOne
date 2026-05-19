# Prometa One — Windows Kurulum Kılavuzu
**Sürüm:** 18 Mayıs 2026 · App.jsx 81.160 satır

## 📋 Gereksinimler

- **Docker Desktop** (Windows için) — https://www.docker.com/products/docker-desktop
- **Node.js 18+** (sadece local geliştirme yapacaksanız) — https://nodejs.org
- **Git** (opsiyonel) — https://git-scm.com

> Docker Desktop'ı kurduktan sonra **WSL2 backend** etkin olduğundan emin olun.

## 🚀 Hızlı Kurulum (3 Adım)

### 1. Dosyaları Çıkar
ZIP'i indirip `C:\prometa-one\` klasörüne çıkarın. Yapı şöyle olmalı:

```
C:\prometa-one\
├── frontend\
├── backend\
├── ml-service\
├── api-server\
├── docker-compose.yml
└── README.md
```

### 2. Docker Compose ile Başlat

```bash
# Komut istemcisi (cmd) veya PowerShell
cd C:\prometa-one
docker-compose up -d --build
```

İlk seferde 3-5 dakika sürebilir (image build + npm install). Sonraki başlatmalar 30 saniye.

### 3. Aç ve Giriş Yap

Tarayıcıda **http://localhost:5173** adresine gidin:

| Kullanıcı | Şifre | Rol |
|-----------|--------|-----|
| `admin` | `admin123` | Sistem Yöneticisi |
| `mustafa` | `promet` | CFO |
| `viewer` | `viewer` | Salt-Okunur |

## 🐳 Çalışan Servisler

| Servis | Port | Açıklama |
|--------|------|----------|
| Frontend (Vite) | **5173** | React UI |
| Backend (Node) | **3000** | API Server + cron + email |
| ML Service (FastAPI) | **8001** | Python AI/ML |
| Adminer (DB UI) | **8080** | PostgreSQL yönetim |

## ✅ Yeni Sürümde Eklenenler

### 🎨 4 Tema
- **Klasik** (Kurumsal yeşil — varsayılan)
- **Modern** (Cyan açık)
- **Karanlık** (Tam dark mode)
- **Gece** (Profesyonel lacivert)

Sağ üstte 🎨 ikonundan değiştirin. Seçim kalıcı (localStorage).

### 📱 PWA + Mobile
- Telefondan/tabletten erişim
- "Ana ekrana ekle" → Standalone uygulama gibi
- Çevrimdışı çalışır (Service Worker cache)
- iOS/Android safe-area desteği (notch)
- Mobil hamburger drawer + alt navigasyon

### 🤖 AI Geliştirmeleri
- **Akıllı Fatura→Proje Eşleştirme** (TF-IDF + hibrit skorlama)
- **AI Feedback Loop** (kullanıcı kabul/reddi öğrenir)
- **Milestone Tahmini** (geçmiş projelerden örüntü)
- **Kâr Eşiği Uyarısı** (proaktif notifications)
- **Bütçe Aşım Bildirimi**

### 📊 Reports v3 + Custom Dashboard
- 8 hazır rapor (Müşteri kar, Proje P&L, Pipeline, Cashflow, vs.)
- Excel (.xlsx) çoklu sayfa export
- Email zamanlama (günlük/haftalık/aylık)
- **Özel Dashboard Builder** — 6 widget tipi (KPI, bar, line, pie, top N, not)
- Sürükle-bırak yerleştirme

### 🏗 Proje Yönetimi (Kapsamlı)
- 🗓 **Gantt** çizelgesi + görev bağımlılıkları + kritik yol
- ⏰ **Zaman takibi** (saat girişi, faturalanabilir)
- 👥 **Kaynak planlama** (alokasyon %, çakışma uyarısı)
- ⚠ **Risk yönetimi** (5x5 matris, P×I skor)
- 📋 **Kapsam yönetimi** (in/out scope, change requests)
- 📚 **Öğrenilen dersler** (lessons learned)

### 🔍 Backend Servisleri
- `cronDaemon.js` — günlük otomatik bildirim + email scheduled reports
- `emailService.js` — SMTP/Mailgun/SendGrid
- `ml-service/main.py` — scikit-learn TF-IDF + feedback endpoint

## 🛠 Servisleri Yönetme

```bash
# Durdur
docker-compose down

# Yeniden başlat (tek servis)
docker-compose restart frontend
docker-compose restart backend
docker-compose restart ml-service

# Loglara bak
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f ml-service

# Tamamen sil ve yeniden kur (DİKKAT: veriyi siler!)
docker-compose down -v
docker-compose up -d --build
```

## 📦 Klasör Yapısı

```
C:\prometa-one\
├── frontend\               # React + Vite (port 5173)
│   ├── src\
│   │   ├── App.jsx        # 81.160 satır — ana uygulama
│   │   ├── styles.css     # Tema sistemi + PWA + mobile
│   │   ├── main.jsx
│   │   ├── api.js
│   │   └── utils\
│   ├── public\
│   │   ├── manifest.json  # PWA tanımı
│   │   ├── sw.js          # Service Worker v1.1.0
│   │   └── icons\         # 8 PWA ikonu
│   ├── package.json
│   ├── vite.config.js
│   └── index.html         # PWA meta, splash screen
│
├── backend\                # Node.js + cron daemon
│   ├── src\services\
│   │   ├── cronDaemon.js  # Günlük cron + scheduled reports
│   │   └── emailService.js
│   └── docs\               # API dokümantasyonu
│
├── ml-service\             # Python + FastAPI + scikit-learn
│   ├── main.py            # ML + AI feedback endpoints
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-compose.snippet.yml
│
├── api-server\             # PostgreSQL API (opsiyonel)
│   ├── migrations\
│   └── src\
│
├── docker-compose.yml
├── start-backend.bat       # Manuel başlatma için
├── start-frontend.bat
├── stop-all.bat
├── KURULUM.md (bu dosya)
├── INTEGRATION_AUDIT.md   # Entegrasyon denetim raporu
├── PWA_SETUP_README.md     # PWA detayları
└── README.md
```

## 🔄 Veri Yedekleme

```bash
# PostgreSQL dump (varsa)
docker-compose exec postgres pg_dump -U postgres prometa > backup.sql

# JSON-based veri için (frontend localStorage)
# Tarayıcıda F12 → Application → Local Storage → "prometa_data" export
```

## ⚠ Migration Notu (Önemli!)

Eski Prometa data.json'ınız varsa, yeni sürüm **otomatik olarak backfill** yapar:
- `crmDeals`, `projects`, `aiFeedback`, `scheduledReports`, `customDashboards` gibi yeni alanlar boş array `[]` olarak eklenir
- Mevcut verileriniz **kayıp olmaz**
- İlk açılışta birkaç saniye sürebilir

Detay: `INTEGRATION_AUDIT.md` dosyasına bakın.

## 📧 SMTP Yapılandırması

Email bildirimleri için `backend/.env` dosyası oluşturun:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=mustafa@promet.com.tr
SMTP_PASS=app-specific-password
SMTP_FROM=Prometa One <noreply@promet.com.tr>
APP_URL=http://localhost:5173
```

> Gmail için: Google Hesap → Güvenlik → 2-step → Uygulama şifresi alın.

## 🤖 ML Service Test

```bash
# Sağlık kontrolü
curl http://localhost:8001/

# AI proje önerisi
curl -X POST http://localhost:8001/v1/suggest-project \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_description": "ABC ERP Faz 2",
    "invoice_partyId": "p1",
    "invoice_amount": 50000,
    "projects": [{"id":"pr1","code":"PRJ-001","name":"ABC ERP","status":"active","customerId":"p1"}],
    "historical_invoices": [],
    "deals": []
  }'

# Feedback istatistikleri
curl http://localhost:8001/v1/feedback/stats
```

## 🐛 Sorun Giderme

### "Port 5173 already in use"
Başka bir Vite/uygulama portu kullanıyor:
```bash
# Windows'ta portu kullananı bul
netstat -ano | findstr :5173
# PID'i öldür
taskkill /F /PID <PID>
```

### "Docker daemon not running"
Docker Desktop'ı manuel başlatın (sistem tepsisinden).

### Frontend yüklenmiyor (boş ekran)
```bash
docker-compose logs frontend
# Hataya bakın

# Build cache'i temizle:
docker-compose down
docker-compose up -d --build --force-recreate frontend
```

### ML service başlamadı
Python paketlerinin yüklenmesi 2-3 dakika sürer:
```bash
docker-compose logs ml-service
# "Application startup complete" görünene kadar bekle
```

### Tema değişmiyor
1. F12 → Console → `localStorage.removeItem("prometa_theme")`
2. Ctrl+Shift+R (hard refresh)

### PWA install butonu gözükmüyor
- HTTPS gerekli (production). Local'de Chrome adres çubuğundaki + ikonuna tıklayın.
- iOS Safari: Paylaş ↑ → "Ana Ekrana Ekle"

## 🚀 Production Deploy

```bash
# 1. Build
cd frontend && npm run build

# 2. Reverse proxy (nginx/Caddy/Cloudflare Tunnel)
# Frontend → / → static dist/
# Backend  → /api → http://backend:3000
# ML       → /ml  → http://ml-service:8001

# 3. HTTPS şart (PWA install + push notifications için)
```

## 📞 Destek

Sorun olursa:
1. `docker-compose logs` çıktısını kontrol edin
2. `INTEGRATION_AUDIT.md`'ye bakın (bilinen sorunlar listelidir)
3. Tarayıcı console (F12) hatasını paylaşın

---
**İyi çalışmalar!** 🎯
