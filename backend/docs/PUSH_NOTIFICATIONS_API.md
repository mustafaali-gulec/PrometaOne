# 📱 Prometa One — Mobile Push API Sözleşmesi

Backend tarafından implement edilmesi gereken endpoint'ler ve veri yapıları.

## 📦 Gerekli Backend Paketleri

### Node.js (önerilen)
```json
{
  "dependencies": {
    "web-push": "^3.6.7",         // Web Push API (browser native)
    "firebase-admin": "^12.0.0",   // FCM (Android + Web)
    "apn": "^2.2.0",              // APN (iOS native)
    "node-cron": "^3.0.3"          // Scheduled push (opsiyonel)
  }
}
```

### Python (alternatif)
```
pywebpush==1.14.0
firebase-admin==6.4.0
apns2==0.7.2
```

## 🔑 Environment Variables

```env
# Web Push (VAPID Keys)
VAPID_PUBLIC_KEY=BMjL7gJZD-fp5...
VAPID_PRIVATE_KEY=Hv9zRfQ-T3Lm...
VAPID_SUBJECT=mailto:admin@prometa.com.tr

# Firebase Cloud Messaging
FCM_PROJECT_ID=prometa-one-prod
FCM_PRIVATE_KEY_PATH=./certs/firebase-admin.json
# veya environment olarak:
FCM_SERVICE_ACCOUNT={"type":"service_account",...}

# Apple Push Notification
APN_KEY_ID=ABCD1234
APN_TEAM_ID=XYZ987
APN_BUNDLE_ID=tr.com.prometa.app
APN_KEY_PATH=./certs/AuthKey_ABCD1234.p8
APN_PRODUCTION=true
```

## 🔄 VAPID Key Üretimi

```bash
npx web-push generate-vapid-keys
```

Public key'i `App.jsx` içinde `VAPID_PUBLIC_KEY` değişkenine yaz.

## 🌐 API Endpoint'leri

### 1️⃣ POST `/v1/push/register-device`

Cihazı kaydeder. Frontend kullanıcı push'u etkinleştirdiğinde çağrılır.

**Request:**
```json
{
  "id": "dev_1715234567_abc123",
  "userId": "mustafa-uuid",
  "username": "mustafa",
  "platform": "web",                
  "provider": "web_push",           
  "endpoint": "https://fcm.googleapis.com/fcm/send/eU8X...",
  "keys": {
    "p256dh": "BPm3a5n0-...",
    "auth": "yT5Lm-_g..."
  },
  "userAgent": "Mozilla/5.0 ...",
  "registeredAt": "2026-05-15T14:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "deviceId": "dev_..."
}
```

**Notlar:**
- Aynı endpoint zaten kayıtlıysa `lastUsedAt` güncellenir, yeni kayıt eklenmez
- `provider: "fcm"` ise `endpoint` = FCM registration token
- `provider: "apn"` ise `endpoint` = APN device token (hex)

---

### 2️⃣ POST `/v1/push/unregister-device`

Cihazı çıkarır.

**Request:**
```json
{
  "username": "mustafa",
  "provider": "web_push",
  "endpoint": "https://fcm.googleapis.com/..." 
}
```

**Response:**
```json
{ "success": true, "removed": 1 }
```

---

### 3️⃣ POST `/v1/push/send` (Internal)

Backend uygulaması bildirim gönderdiğinde kullanılır.

**Request:**
```json
{
  "notification": {
    "title": "✓ Talebiniz onaylandı",
    "body": "5.000 ₺ · 'İyi tatiller!'",
    "icon": "/icon-192.png",
    "badge": "/badge-72.png",
    "tag": "request-abc123",
    "link": { "type": "request", "id": "req_abc123" },
    "data": { "kind": "advance", "amount": 5000 }
  },
  "recipients": [
    { "username": "mustafa" }
  ]
}
```

**Backend Mantığı:**
1. `recipients` içindeki her username için `hrPushDevices`'tan aktif cihazları bul
2. Her cihaz için **provider'a göre** uygun servisi kullan:
   - `web_push` → `web-push` paketi
   - `fcm` → `firebase-admin`
   - `apn` → `apn` paketi
3. Push gönderildikten sonra:
   - Başarısız (404, 410 — endpoint expired) cihazları `active: false` yap
   - Başarılı cihazların `lastUsedAt`'ini güncelle

**Response:**
```json
{
  "success": true,
  "sent": 2,
  "failed": 0,
  "expired": []
}
```

---

### 4️⃣ GET `/v1/push/devices/:username`

Kullanıcının kayıtlı cihazlarını listeler (admin için).

---

### 5️⃣ POST `/v1/push/test` (Development only)

Test bildirimi gönderir. Production'da disable edilmeli.

---

## 📤 Web Push Sender (Node.js Örneği)

```javascript
const webpush = require("web-push");

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendWebPush(device, notification) {
  const subscription = {
    endpoint: device.endpoint,
    keys: device.keys,
  };

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: notification.icon || "/icon-192.png",
    badge: notification.badge || "/badge-72.png",
    tag: notification.tag,
    link: notification.link,
    data: notification.data,
  });

  try {
    await webpush.sendNotification(subscription, payload, {
      TTL: 60 * 60 * 24,  // 24h
      urgency: "normal",
    });
    return { success: true };
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // Expired/gone - cihazı kaldır
      return { success: false, expired: true };
    }
    return { success: false, error: err.message };
  }
}
```

## 📤 FCM Sender (Node.js Örneği)

```javascript
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FCM_SERVICE_ACCOUNT)
  ),
});

async function sendFcm(device, notification) {
  const message = {
    token: device.endpoint,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: {
      link_type: notification.link?.type || "",
      link_id: notification.link?.id || "",
      ...notification.data,
    },
    android: {
      notification: {
        icon: "ic_notification",
        color: "#7c3aed",
        clickAction: "OPEN_NOTIFICATION",
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: notification.title,
            body: notification.body,
          },
          sound: "default",
          badge: 1,
        },
      },
    },
  };

  try {
    const messageId = await admin.messaging().send(message);
    return { success: true, messageId };
  } catch (err) {
    if (err.code === "messaging/registration-token-not-registered") {
      return { success: false, expired: true };
    }
    return { success: false, error: err.message };
  }
}
```

## 📤 APN Sender (Node.js Örneği)

```javascript
const apn = require("apn");

const provider = new apn.Provider({
  token: {
    key: process.env.APN_KEY_PATH,
    keyId: process.env.APN_KEY_ID,
    teamId: process.env.APN_TEAM_ID,
  },
  production: process.env.APN_PRODUCTION === "true",
});

async function sendApn(device, notification) {
  const note = new apn.Notification();
  note.alert = {
    title: notification.title,
    body: notification.body,
  };
  note.badge = 1;
  note.sound = "default";
  note.topic = process.env.APN_BUNDLE_ID;
  note.payload = {
    link: notification.link,
    data: notification.data,
  };

  try {
    const result = await provider.send(note, device.endpoint);
    if (result.failed.length > 0) {
      const reason = result.failed[0].response?.reason;
      if (reason === "BadDeviceToken" || reason === "Unregistered") {
        return { success: false, expired: true };
      }
      return { success: false, error: reason };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

## 🔁 Backend Tetikleme Mantığı

Backend'de bildirim oluşturulduğunda (örn. talep onaylandığında):

```javascript
// Pseudocode
async function notifyApprovalToEmployee(request) {
  const employee = await db.employees.findOne({ id: request.employeeId });
  if (!employee?.userId) return;

  const devices = await db.push_devices.find({
    username: employee.userId,
    active: true,
  });

  const prefs = await db.push_preferences.findOne({ username: employee.userId });
  if (!prefs?.enabled) return;
  if (prefs.kinds?.request_approved === false) return;

  // Sessiz saatler?
  const now = new Date();
  const isQuiet = isInQuietHours(now, prefs.quietHours);

  const notification = {
    title: "✓ Talebiniz onaylandı",
    body: `${formatTL(request.amount)} ₺`,
    tag: `request-${request.id}`,
    link: { type: "request", id: request.id },
    data: { kind: request.kind, status: "approved" },
    silent: isQuiet,
  };

  for (const device of devices) {
    let result;
    if (device.provider === "web_push") result = await sendWebPush(device, notification);
    else if (device.provider === "fcm")  result = await sendFcm(device, notification);
    else if (device.provider === "apn")  result = await sendApn(device, notification);

    if (result.expired) {
      await db.push_devices.update({ id: device.id }, { active: false });
    } else if (result.success) {
      await db.push_devices.update({ id: device.id }, { lastUsedAt: new Date() });
    }
  }
}
```

## 🗄️ Veritabanı Tablo Şemaları

### `push_devices`
```sql
CREATE TABLE push_devices (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  username VARCHAR(50) NOT NULL,
  platform VARCHAR(20) NOT NULL,     -- 'web' | 'ios' | 'android'
  provider VARCHAR(20) NOT NULL,     -- 'web_push' | 'fcm' | 'apn'
  endpoint TEXT NOT NULL,
  keys JSONB,                         -- { p256dh, auth } web_push için
  user_agent TEXT,
  registered_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  CONSTRAINT push_devices_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX idx_push_devices_username ON push_devices(username);
CREATE INDEX idx_push_devices_active ON push_devices(active);
```

### `push_preferences`
```sql
CREATE TABLE push_preferences (
  username VARCHAR(50) PRIMARY KEY,
  enabled BOOLEAN DEFAULT FALSE,
  kinds JSONB,                        -- { request_pending: true, ... }
  quiet_hours JSONB,                  -- { enabled, from, to }
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 📱 Native App Entegrasyonu

### React Native (FCM)
```javascript
import messaging from "@react-native-firebase/messaging";

async function registerForPush() {
  await messaging().requestPermission();
  const token = await messaging().getToken();

  // Backend'e gönder
  await fetch("/v1/push/register-device", {
    method: "POST",
    body: JSON.stringify({
      username: currentUser.username,
      platform: Platform.OS,         // "ios" or "android"
      provider: "fcm",
      endpoint: token,
    }),
  });
}
```

### Capacitor (iOS APN + Android FCM)
```javascript
import { PushNotifications } from "@capacitor/push-notifications";

PushNotifications.addListener("registration", async (token) => {
  await fetch("/v1/push/register-device", {
    method: "POST",
    body: JSON.stringify({
      username: currentUser.username,
      platform: Capacitor.getPlatform(),
      provider: Capacitor.getPlatform() === "ios" ? "apn" : "fcm",
      endpoint: token.value,
    }),
  });
});

await PushNotifications.requestPermissions();
await PushNotifications.register();
```

## 🧪 Test Komutları

```bash
# Web Push test (curl)
curl -X POST https://api.prometa.com.tr/v1/push/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notification": {
      "title": "Test",
      "body": "Test mesajı",
      "tag": "test-1"
    },
    "recipients": [{ "username": "mustafa" }]
  }'

# VAPID keys yeniden üret (manuel)
npx web-push generate-vapid-keys
```

## 📌 Frontend ↔ Backend Akış Şeması

```
[Çalışan tarayıcı]
       ↓ (Push Tercihleri → "Etkinleştir")
[App.jsx subscribeToPush()]
       ↓ (Browser Push Manager → endpoint + keys)
[POST /v1/push/register-device]
       ↓
[Backend: push_devices tablosuna kaydet]
       ↓
... (zamanla)
       ↓
[Çalışan başka çalışana talep gönderdi]
       ↓
[Backend: notification oluştur + push tetikle]
       ↓ (provider'a göre)
[web-push.sendNotification() | FCM | APN]
       ↓
[Çalışanın cihazında native bildirim toast]
       ↓ (tıklama)
[Service Worker → uygulamayı aç → ilgili sayfaya git]
```

## ⚠️ Güvenlik Notları

1. **VAPID Private Key sadece backend'de.** Frontend'e koyma.
2. **APN .p8 dosyası** sadece sunucuda, env'de path olarak.
3. **FCM Service Account JSON** sadece backend env'de.
4. **Rate limiting**: Bir kullanıcıya maksimum X push/dakika.
5. **Auth**: Tüm push endpoint'lerinde JWT/session zorunlu.
6. **Endpoint validation**: `register-device` endpoint'inde URL şeması kontrolü.
7. **PII**: Push payload'unda hassas bilgi (TC, IBAN) gönderme.

## 🔒 İcon Dosyaları

Yerleşim: `/public/icon-192.png`, `/public/badge-72.png`

192x192 PNG (uygulama ikonu) ve 72x72 monochrome PNG (badge).
