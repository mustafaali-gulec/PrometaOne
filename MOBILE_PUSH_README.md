# 📱 Prometa One — Mobile Push Bildirimleri

Bu dokümantasyon, mobil push bildirim sisteminin **frontend hazır** durumunu açıklar ve **backend implementasyon** için yol haritası sunar.

## 🎯 Şu An Hazır Olanlar

### ✅ Frontend (App.jsx)
- Web Push API entegrasyonu
- Service Worker (`/public/sw.js`)
- Push tercih paneli (Self-Service Profilim'de)
- Cihaz token yönetimi
- VAPID public key tanımı
- PWA manifest (Ana Ekrana Ekle desteği)
- Bildirim helper'ları: `subscribeToPush()`, `unsubscribeFromPush()`, `registerPushDevice()`, vb.

### ✅ Veri Yapısı (createEmptyCompanyData)
```js
hrPushDevices: []        // Kayıtlı cihazlar (FCM/APN/Web Push tokens)
hrPushPreferences: {}    // Kullanıcı bazlı tercihler
```

### ⏳ Backend (Henüz Implement Edilmedi)
- `/v1/push/register-device` endpoint'i
- `/v1/push/unregister-device` endpoint'i
- `/v1/push/send` endpoint'i
- Firebase Admin SDK / web-push / apn paketleri

## 🚀 İlk Kurulum (Local Test)

### 1. VAPID Anahtarlarını Üret

```bash
cd backend
npx web-push generate-vapid-keys
```

Çıktıdaki **public key**'i `frontend/src/App.jsx` içindeki `VAPID_PUBLIC_KEY` değişkenine yapıştır.

**Private key**'i backend `.env` dosyasına ekle:
```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@prometa.com.tr
```

### 2. Service Worker Doğrula

Tarayıcıda `http://localhost:5173/sw.js` aç — Service Worker dosyası görünmeli.

### 3. PWA Manifest Bağlantısını HTML'e Ekle

`frontend/index.html` `<head>` içine:
```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#7c3aed" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

### 4. İkon Dosyaları

`/public/` klasörüne yerleştir:
- `icon-192.png` (192x192, transparent veya beyaz arka plan)
- `icon-512.png` (512x512)
- `badge-72.png` (72x72, monochrome — Android için)

## 🧪 Test Etme

### Frontend Test (Backend olmadan)
1. Tarayıcıda uygulamayı aç (`localhost:5173`)
2. Self-Service → 👤 Profilim → 📱 **Mobil Push Bildirimleri** kartı
3. "Etkinleştir" → tarayıcı izin pop-up'ı
4. İzin ver → ✓ Push etkin
5. "🧪 Test Et" butonu → bildirim toast'u görünmeli

### Backend Test (Hazır olduğunda)
1. Yukarıdaki gibi push'u etkinleştir
2. Admin olarak bir talep onayla
3. Backend tetiklenir → `web-push` paketi push gönderir
4. Tarayıcı kapalı bile olsa native OS bildirimi gelir

## 📦 Backend Kurulum Adımları (Sonra Yapılacak)

```bash
# 1. Paketleri yükle
cd backend
npm install web-push firebase-admin apn

# 2. Env'i tamamla (.env)
cat >> .env << EOF
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@prometa.com.tr
FCM_SERVICE_ACCOUNT='{"type":"service_account",...}'
APN_KEY_ID=ABCD1234
APN_TEAM_ID=XYZ987
APN_BUNDLE_ID=tr.com.prometa.app
APN_KEY_PATH=./certs/AuthKey_ABCD1234.p8
EOF

# 3. Endpoint'leri implement et — bkz: ./docs/PUSH_NOTIFICATIONS_API.md

# 4. Notification servisini tetikle
# Her bildirim oluşturulduğunda push gönderiminin de tetiklenmesi gerek
```

## 📱 Native Mobile App Yolu

Web Push %100 destekli **değil** (özellikle iOS Safari'de zorlu). Native bir uygulama gerekirse:

### Seçenek 1: Capacitor (Önerilen — kod tabanı paylaşılır)
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Prometa One" "tr.com.prometa.app"

# Push plugin
npm install @capacitor/push-notifications
npx cap sync

# iOS için
npx cap add ios
# Xcode'da: Capabilities → Push Notifications enable
# Apple Developer'da APN sertifikası oluştur

# Android için
npx cap add android
# Firebase Console'da projeyi oluştur, google-services.json indir
```

### Seçenek 2: React Native (yeniden yazılır)
```bash
npx react-native init PrometaOne
npm install @react-native-firebase/app @react-native-firebase/messaging
# iOS pod install, Android google-services.json
```

## 🔐 Güvenlik Kontrol Listesi

- [ ] VAPID Private Key sadece backend'de
- [ ] FCM service account JSON env veya secret manager'da
- [ ] APN .p8 dosyası sunucuda restricted access
- [ ] Push endpoint'leri auth required (JWT/session)
- [ ] Rate limiting (kullanıcı başına max push/min)
- [ ] Payload'unda PII yok
- [ ] HTTPS zorunlu (HTTP'de Service Worker çalışmaz)

## 📊 Yaygın Sorunlar

| Sorun | Çözüm |
|---|---|
| "Notification permission denied" | Tarayıcı ayarlarından site izinlerini sıfırla |
| Service Worker register failed | `/sw.js` path'i doğru mu? HTTPS gerekli (localhost hariç) |
| iOS Safari'de çalışmıyor | Safari Web Push 16.4+ gerektirir, manifest required |
| Push gelmedi ama subscribe başarılı | Backend tarafı henüz implement edilmedi |
| 410 Gone hatası | Endpoint expired — cihazı kaldır, kullanıcı yeniden subscribe olsun |

## 🎯 Yol Haritası

- [x] Frontend Web Push entegrasyonu
- [x] Service Worker
- [x] Push tercihleri UI
- [x] PWA manifest
- [x] Backend API kontratı (dokümantasyon)
- [ ] Backend endpoint implementasyonu
- [ ] Firebase/APN credential'larının alınması
- [ ] Production'da deploy + monitör
- [ ] Native app (Capacitor) - opsiyonel
