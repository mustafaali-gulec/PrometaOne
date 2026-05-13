# 🚀 PROMETA ONE — Windows Kurulum Kılavuzu

> **Süre:** 60-90 dakika · **Zorluk:** Kolay (kopyala-yapıştır)
>
> **Hedef:** Frontend (React) + Backend (Node.js) + PostgreSQL veritabanını yerel makineye kurmak ve çalıştırmak.

---

## 📋 Kurulum Sırası

Tüm adımlar **sırasıyla** yapılmalı. Bir adımı atlama!

1. ✅ Gerekli yazılımları kur (15 dk)
2. ✅ Proje klasörünü hazırla (5 dk)
3. ✅ Backend'i Docker ile başlat (15 dk)
4. ✅ Veritabanını hazırla (5 dk)
5. ✅ Frontend'i kur ve çalıştır (10 dk)
6. ✅ Test et (5 dk)

---

## 🔧 ADIM 1 — Gerekli Yazılımları Kur

Sırayla şunları indir ve kur:

### 1.1 Node.js (JavaScript runtime)

1. **İndir:** https://nodejs.org/
2. **Yeşil "LTS" butonuna** tıkla (sürüm 20.x veya 22.x)
3. İndirilen `.msi` dosyasını çalıştır
4. **Tüm seçenekleri varsayılan bırak**, "Next" diyerek geç
5. ⚠️ "Automatically install the necessary tools" kutusunu **işaretle**
6. Kurulum biter → bilgisayarı yeniden başlat (önerilir)

**Test et:** PowerShell aç (Başlat → "PowerShell" yaz):
```powershell
node --version
# Beklenen çıktı: v20.x.x veya v22.x.x

npm --version
# Beklenen çıktı: 10.x.x veya benzeri
```

> ❌ "node is not recognized" hatası alıyorsan: PowerShell'i kapat, yeniden aç. Yine olmazsa bilgisayarı yeniden başlat.

---

### 1.2 Docker Desktop

1. **İndir:** https://www.docker.com/products/docker-desktop/
2. **"Download for Windows"** butonuna tıkla
3. İndirilen `Docker Desktop Installer.exe` dosyasını çalıştır
4. Kurulum sırasında **"Use WSL 2 instead of Hyper-V"** seçiliyse onayla (önerilen)
5. **Bilgisayarı yeniden başlat** (gerekli!)
6. Açılışta Docker Desktop otomatik başlar
7. **İlk açılışta** "Accept terms" → "Continue without signing in" (hesap gerekmez)
8. Docker Desktop simgesi sistem tepsisinde yeşilse → hazır 🟢

**Test et:**
```powershell
docker --version
# Beklenen çıktı: Docker version 27.x.x veya benzeri

docker compose version
# Beklenen çıktı: Docker Compose version v2.x.x
```

> ⚠️ **WSL 2 hatası** alıyorsan: https://learn.microsoft.com/en-us/windows/wsl/install — Microsoft'un kılavuzuyla WSL 2'yi kurman gerekli (`wsl --install` PowerShell'de admin olarak)

---

### 1.3 Git (Versiyon kontrol — opsiyonel ama önerilen)

1. **İndir:** https://git-scm.com/download/win
2. Standart kurulum (tüm seçenekleri varsayılan bırak)

**Test et:**
```powershell
git --version
# Beklenen çıktı: git version 2.x.x
```

---

### 1.4 Kod Editörü (VS Code önerilen)

1. **İndir:** https://code.visualstudio.com/
2. Standart kurulum
3. Açıldığında **Extensions** sekmesinden şunları kur:
   - ESLint
   - Prettier
   - PostgreSQL (Chris Kolkman)

---

## 📁 ADIM 2 — Proje Klasörünü Hazırla

### 2.1 Çalışma klasörü oluştur

PowerShell'de:
```powershell
# C:\ altında prometa-one klasörü oluştur
cd C:\
mkdir prometa-one
cd prometa-one
```

### 2.2 İndirilen dosyaları yerleştir

Sana verdiğim dosyaları (Claude artifacts'tan indirdiğin) bu yapıya göre yerleştir:

```
C:\prometa-one\
├── api-server\           ← İndirdiğin tüm api-server klasörü
│   ├── src\
│   ├── migrations\
│   ├── scripts\
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── package.json
│   ├── .env.example
│   └── ...
└── frontend\             ← İndirdiğin tüm frontend klasörü
    ├── src\
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── api.js
    │   └── styles.css
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── .env.example
```

**Kontrol et** PowerShell'de:
```powershell
cd C:\prometa-one
dir
# Beklenen çıktı:
# api-server
# frontend
```

---

## 🐘 ADIM 3 — Backend'i Docker ile Başlat

### 3.1 .env dosyasını oluştur

```powershell
cd C:\prometa-one\api-server
copy .env.example .env
notepad .env
```

Notepad açıldığında, **bu değerleri değiştir:**

```env
# Mevcut satırı değiştir:
JWT_SECRET=BURAYA-UZUN-RASTGELE-BIR-METIN-EN-AZ-32-KARAKTER-OLMALI

# Yeni satır ekle (yoksa):
JWT_REFRESH_SECRET=BAMBASKA-BIR-UZUN-METIN-DE-EN-AZ-32-KARAKTER-OLMALI

# Email'i konsola yaz (test için):
EMAIL_PROVIDER=console

# CORS — frontend'in adresi:
CORS_ORIGINS=http://localhost:5173
```

> 🎲 **Rastgele JWT secret üretmek için:** PowerShell'de şunu çalıştır:
> ```powershell
> -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
> ```

Notepad'te kaydet (Ctrl+S) ve kapat.

### 3.2 Docker container'larını başlat

```powershell
cd C:\prometa-one\api-server

# Postgres + API'yi build et ve başlat (ilk seferde 5-10 dk sürer)
docker compose up -d
```

**Beklenen çıktı:**
```
[+] Running 3/3
 ✔ Container prometa-one-db   Started
 ✔ Container prometa-one-api  Started
 ✔ Network ...                Created
```

**Container'ları kontrol et:**
```powershell
docker compose ps

# Beklenen:
# NAME                  STATUS              PORTS
# prometa-one-api       Up X seconds        0.0.0.0:3000->3000/tcp
# prometa-one-db        Up X seconds        0.0.0.0:5432->5432/tcp
```

> ❌ **Hata:** `port is already allocated`
> → 3000 veya 5432 portu kullanımda. Diğer uygulamayı kapat, veya docker-compose.yml'de portu değiştir (ör: `3001:3000`)

> ❌ **Hata:** `api container exits immediately`
> → Loglara bak:
> ```powershell
> docker compose logs api
> ```

### 3.3 API loglarını izle

```powershell
docker compose logs -f api
```

**Beklenen çıktı:**
```
Server listening on http://0.0.0.0:3000
✓ Database connected
✓ Cron jobs scheduled
```

Çıkmak için **Ctrl+C** (containerlar çalışmaya devam eder).

---

## 🗃️ ADIM 4 — Veritabanını Hazırla

### 4.1 Migration'ları çalıştır (tabloları oluştur)

```powershell
cd C:\prometa-one\api-server
docker compose exec api npm run migrate
```

**Beklenen çıktı:**
```
Migrating: 001_initial_users_and_sessions.sql... ✓
Migrating: 002_companies.sql... ✓
Migrating: 003_categories_and_cells.sql... ✓
...
Migrating: 010_password_resets.sql... ✓
✓ All migrations completed
```

### 4.2 Seed data ekle (demo kullanıcılar + örnek veri)

```powershell
docker compose exec api npm run seed
```

**Beklenen çıktı:**
```
Seeding users... ✓ (4 users)
Seeding companies... ✓ (2 companies)
Seeding categories... ✓
...
✓ Seed complete
```

### 4.3 Adminer ile veritabanını görüntüle (opsiyonel)

```powershell
docker compose --profile tools up -d
```

Tarayıcıda aç: **http://localhost:8080**

Login bilgileri:
- **System:** PostgreSQL
- **Server:** postgres
- **Username:** prometa
- **Password:** prometa123
- **Database:** prometa_one

Sol panelde `users`, `companies`, `password_resets` vb. tabloları görmelisin ✓

---

## 🎨 ADIM 5 — Frontend'i Kur ve Çalıştır

### 5.1 Bağımlılıkları yükle

```powershell
cd C:\prometa-one\frontend

# npm paketleri yükle (3-5 dakika sürer, kahvenizi alın ☕)
npm install
```

**Beklenen çıktı:**
```
added 350 packages in 2m
```

> ⚠️ **Uyarılar (warning)** görebilirsin — bu normal, sorun değil. Sadece **error**'lar problemli.

### 5.2 .env dosyasını oluştur

```powershell
copy .env.example .env
```

Varsayılan değerler doğru, değiştirmeye gerek yok.

### 5.3 Frontend dev server'ı başlat

```powershell
npm run dev
```

**Beklenen çıktı:**
```
  VITE v5.4.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### 5.4 Tarayıcıda aç

**Tarayıcıda git:** http://localhost:5173

Prometa One login ekranını görmelisin! 🎉

---

## ✅ ADIM 6 — Test Et

### Test 1: Backend bağlantısı

Tarayıcıda **F12** ile DevTools aç → Console sekmesine bak. Şunu görmelisin:
```
✓ Backend bağlantısı aktif (/v1)
```

Eğer şunu görüyorsan backend erişilemez:
```
⚠️ Backend erişilemez. Demo mod aktif.
```
→ Backend ayakta mı kontrol et: http://localhost:3000/v1/health

### Test 2: Demo kullanıcılarla login ol

| Kullanıcı | Şifre | Rol |
|---|---|---|
| `admin` | `admin123` | Yönetici |
| `mustafa` | `promet` | Mali Müdür |
| `editor` | `editor` | Düzenleyici |
| `viewer` | `viewer` | Görüntüleyici |

`admin / admin123` ile giriş yap.

### Test 3: Dil değiştir

Sağ üstte 🇹🇷 simgesine tıkla → 🇬🇧 English seç. Tüm menüler İngilizce olmalı.

### Test 4: Captcha

Logout ol → Bilerek **2 kere yanlış şifre** dene → 3. denemede **captcha alanı** çıkmalı (örn: "12 + 7 = ?")

### Test 5: Şifremi unuttum + EMAIL TEST 🎯

**En önemli test — backend email entegrasyonu:**

1. Login ekranında "Şifremi unuttum" linkine tıkla
2. `admin` veya `mustafa` yaz → "Sıfırlama Bağlantısı Gönder"
3. **Backend loglarına bak** (yeni PowerShell penceresinde):
   ```powershell
   cd C:\prometa-one\api-server
   docker compose logs -f api
   ```
4. Şunu görmelisin (console modunda):
   ```
   ========== EMAIL (CONSOLE MODE) ==========
   TO: admin@prometahr.com
   SUBJECT: Prometa One — Şifre Sıfırlama
   ---
   Merhaba Admin,
   
   Sıfırlama Kodu: 483291
   ...
   ==========================================
   ```
5. Token'i kopyala → frontend'te yapıştır → yeni şifre belirle → giriş yap ✓

### Test 6: Modülleri gez

- 📊 **Genel Bakış** → KPI kartları, grafik
- 💼 **HR** → Organizasyon yapısı (boş başlar, ekle)
- 🏦 **Bankalar** → Yeni hesap ekle
- 🤖 **Prometa AI** (sağ alt köşede) → "Aktif çalışan sayım?" gibi soru

---

## 🛑 Durdurmak / Yeniden Başlatmak

### Tüm sistemi durdur:
```powershell
cd C:\prometa-one\api-server
docker compose down

# Veritabanı verisini de silmek istersen (DİKKATLİ):
docker compose down -v
```

### Frontend'i durdur:
PowerShell'de **Ctrl+C** bas.

### Tekrar başlat:
```powershell
# Backend
cd C:\prometa-one\api-server
docker compose up -d

# Frontend (yeni PowerShell penceresi)
cd C:\prometa-one\frontend
npm run dev
```

---

## 📧 ADIM 7 — Gerçek Email Gönderimi (Production)

Şu anda email'ler console'a yazılıyor. Gerçek email göndermek için:

### Seçenek A: Gmail SMTP (en kolay)

1. Gmail hesabında **iki adımlı doğrulama** açık olmalı: https://myaccount.google.com/security
2. **Uygulama Parolası** oluştur: https://myaccount.google.com/apppasswords
3. `.env` dosyasını güncelle:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=senin-emailin@gmail.com
SMTP_PASS=APPS_PASSWORD_BURAYA  # 16 haneli uygulama parolası
SMTP_FROM="Prometa One <senin-emailin@gmail.com>"
```

4. API container'ını yeniden başlat:
```powershell
docker compose restart api
```

5. Test et → admin / mustafa user'ının `email` alanı dolu olmalı (Adminer üzerinden güncelle veya seed sırasında doldur)

### Seçenek B: SendGrid (Production önerilen — günde 100 ücretsiz)

1. https://signup.sendgrid.com/ → ücretsiz hesap
2. API Key oluştur
3. `.env`:
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
EMAIL_FROM=noreply@senindomainin.com
```

---

## 🐛 Yaygın Sorunlar ve Çözümleri

### Frontend açılmıyor — boş sayfa
1. **F12 → Console** kontrol et — kırmızı hata var mı?
2. `npm install` tamamlandı mı? — `node_modules` klasörü var mı?
3. Cache temizle: `Ctrl+Shift+R` (zorla yenile)

### Backend "Connection refused"
1. Docker Desktop açık mı? Sistem tepsisinde simge yeşil mi?
2. `docker compose ps` → containerlar `Up` durumda mı?
3. Loglara bak: `docker compose logs api`

### Migration hatası
```powershell
# Veritabanını sıfırla:
docker compose down -v
docker compose up -d
# Postgres tamamen ayağa kalkana kadar 30 sn bekle:
Start-Sleep -Seconds 30
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

### Email gelmiyor (Gmail SMTP)
- Uygulama parolasını **doğru kopyaladın mı?** (boşluksuz, 16 hane)
- Spam klasörünü kontrol et
- `docker compose logs api` → email hatası var mı?

### Port çakışması (3000, 5432, 5173)
docker-compose.yml veya vite.config.js içinde portları değiştir.

### "Module not found: 'lucide-react/icons/...'"
```powershell
cd C:\prometa-one\frontend
rm -rf node_modules
rm package-lock.json
npm install
```

---

## 🎯 Geliştirme İçin İpuçları

### Frontend kodunu değiştirmek
`frontend/src/App.jsx` dosyasını VS Code'da aç. Değişiklik yap → **otomatik olarak tarayıcıda yenilenir** (Hot Reload).

### Backend kodunu değiştirmek
Docker development mode için:
```powershell
docker compose down
# api-server/Dockerfile'da development modu varsa kullan
docker compose up -d --build
```

### Database'i kontrol etmek
Adminer: http://localhost:8080

### AI Asistan testleri
AI Asistan (sağ alt) **claude.ai üzerinden** çalışıyor (artifact ortamında). Local'de yerel olarak çalışmaz — production'da Anthropic API key gerekir.

---

## 📚 Sonraki Adımlar

✅ Kurulum tamam → bana yaz, geliştirmeye devam edelim:

- **Bordro modülü** ekle
- **Mobil responsive** iyileştirmeler
- **Çoklu şirket yönetimi** detayları
- **Excel import** geliştirmeleri
- **Production deployment** (nginx + SSL)

---

## ❓ Yardım

Bir sorunla karşılaşırsan, **tam olarak şunları paylaş:**

1. Hangi adımdaydın? (Örn: "ADIM 3.2'de")
2. Çalıştırdığın komut?
3. Aldığın hatanın tam metni (PowerShell'den kopyala)
4. `docker compose logs api` çıktısının son 20 satırı

Birlikte çözeriz 🚀

---

**İyi çalışmalar Mustafa!**  
*Prometa One — Türk teknolojisinin gücüyle, global standartlarda.*
