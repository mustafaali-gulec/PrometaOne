# Prometa One — PWA Setup

## ✅ Yapılanlar

1. ✓ `public/manifest.json` — PWA tanımı (8 ikon boyutu, 4 shortcut)
2. ✓ `public/sw.js` — Service Worker (cache + push + offline + sync)
3. ✓ `index.html` — Meta tagları, splash screen, safe-area
4. ✓ `src/App.jsx` — Install prompt, online/offline, SW update, mobile drawer, bottom nav
5. ✓ `src/styles.css` — Touch-friendly + safe-area + standalone tweaks

## 🎨 İkonlar Oluşturma (ZORUNLU)

Manifest 8 farklı boyutta PNG ikonu bekler. Şu klasör yapısını oluşturun:

```
frontend/public/icons/
├── icon-72x72.png
├── icon-96x96.png
├── icon-128x128.png
├── icon-144x144.png
├── icon-152x152.png
├── icon-192x192.png
├── icon-384x384.png
└── icon-512x512.png
```

### Yöntem 1: PWA Asset Generator (Önerilen)

```bash
npm install -g pwa-asset-generator

# 1024x1024 logo'dan tüm boyutları üret
pwa-asset-generator logo.png frontend/public/icons \
  --icon-only \
  --background "#0891b2" \
  --padding "10%" \
  --opaque false
```

### Yöntem 2: Manuel ImageMagick

```bash
# logo-source.png (en az 512x512) hazırlayın
cd frontend/public/icons
for size in 72 96 128 144 152 192 384 512; do
  magick convert ../../logo-source.png -resize ${size}x${size} icon-${size}x${size}.png
done
```

### Yöntem 3: Geçici Placeholder (Test İçin)

```bash
cd frontend/public/icons
for size in 72 96 128 144 152 192 384 512; do
  magick convert -size ${size}x${size} xc:'#0891b2' \
    -fill white -gravity center -font "Inter-Bold" -pointsize $((size/3)) \
    -annotate +0+0 "P1" icon-${size}x${size}.png
done
```

## 🐳 Docker Compose Notu

`docker-compose.yml`'de frontend servisinde public/ klasörünün mount edildiğinden emin olun:

```yaml
frontend:
  volumes:
    - ./frontend:/app
    - /app/node_modules
```

Service Worker `/sw.js` olarak servis edilmeli — Vite default olarak `public/` klasörünü root'a serve eder, ekstra konfigürasyon gerekmez.

## ✅ Test Listesi

### Browser DevTools'ta
1. **Application → Manifest** — Tüm alanlar doğru görünmeli
2. **Application → Service Workers** — Aktif olmalı, "Activated and is running"
3. **Application → Cache Storage** — `prometa-app-v*`, `prometa-runtime-v*`, `prometa-api-v*`
4. **Lighthouse → PWA** — Skor 90+ olmalı

### Mobil/Tablet Test
1. **Chrome Mobile**: ⋮ → "Ana ekrana ekle"
2. **iOS Safari**: Paylaş ↑ → "Ana Ekrana Ekle"
3. **Standalone modda**:
   - Adres çubuğu görünmez ✓
   - Status bar tema rengi #0891b2 ✓
   - Bottom nav 5 öğeli ✓
   - Hamburger menü açılır ✓

### Offline Test
1. DevTools → Network → "Offline" işaretle
2. Sayfayı yenile → Cache'ten yüklenir
3. Bir API çağrısı yap → 503 + offline indicator gözükür
4. "Çevrimdışı" kırmızı şerit üstte
5. Network'ü aç → Yeşil "online" otomatik
6. `sync-data` event tetiklenir → Bekleyen değişiklikler senkron olur

### Install Prompt
1. PWA criteria'yı karşılayan tarayıcıda otomatik banner
2. "Yükle" tıkla → OS install prompt'u açılır
3. "Sonra" tıkla → 7 gün gizlenir (localStorage)
4. Yüklendikten sonra banner artık görünmez

## 🔧 Yapılandırma

### Theme Color Değiştirme

`manifest.json` ve `index.html`'de:
```
theme_color: "#0891b2"  → istediğin renk
```

### Cache Strategileri

`sw.js` içinde:
- **API**: Network-first (3000/8001 portları)
- **JS/CSS/Images**: Stale-while-revalidate
- **Navigation**: Network + offline fallback
- **Default**: Cache-first

Cache'i temizlemek için:
```javascript
// Console'dan
navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" });
```

### Push Notifications

Mevcut `sw.js` zaten Web Push API'yi destekler. Backend'den VAPID anahtarı ile push gönderilebilir. Detay için: `backend/src/services/cronDaemon.js` ve `emailService.js`'e bakın.

## 📲 PWA Özellikleri

✓ Standalone display (tam ekran)
✓ Offline destek (Service Worker cache)
✓ Install prompt (otomatik banner)
✓ Push notifications (zaten vardı)
✓ Background sync (offline değişiklikler için)
✓ App shortcuts (long-press → Yeni Fatura, Onaylar, Görevler, Projeler)
✓ Splash screen (yükleme sırasında)
✓ Safe area (iOS notch, home indicator)
✓ Theme color (status bar)
✓ Maskable icons (Android adaptive)
✓ Online/offline indicator
✓ SW güncelleme bildirimi
✓ Mobile hamburger drawer
✓ Mobile bottom navigation (5 sık kullanılan)
✓ Touch-friendly hit areas (≥36px)
✓ iOS zoom prevention (16px font on inputs)

## 🚀 Production Build

```bash
cd frontend
npm run build
# dist/ klasörü oluşur
# Bu klasörü nginx/apache ile servis et
# sw.js root path'ten erişilebilir olmalı (Service-Worker-Allowed: /)
```

## 📊 Lighthouse PWA Kriterleri

✓ Installable
  ✓ manifest.json valid
  ✓ Icons 192x192 ve 512x512 var
  ✓ HTTPS (production'da)
  ✓ Service Worker register
✓ PWA Optimized
  ✓ viewport meta
  ✓ theme-color meta
  ✓ Apple touch icon
  ✓ Maskable icon
  ✓ Splash screen content
