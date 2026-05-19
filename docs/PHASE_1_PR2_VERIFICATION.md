# Faz 1 / PR 2 — Production Doğrulaması (2026-05-19)

## Sonuç: ✅ Strangler Fig'in ilk dilimi prod'da yaşıyor

## Gerçek HTTP test çıktıları

```bash
$ curl -X POST http://localhost:3000/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}'

{"accessToken":"eyJhbGc...","user":{"id":5,"role":"admin",...}}

$ curl http://localhost:3000/v1/notifications \
    -H "Authorization: Bearer <token>"

{"notifications":[],"unreadCount":0}

$ curl http://localhost:3000/v1/notifications/unread-count \
    -H "Authorization: Bearer <token>"

{"count":0}
```

## Kanıtlanmış

- `registerNotificationsModule` DI composition root → `/v1/notifications` mount edildi
- `authMiddleware` yeni route'larda çalışıyor (tokensız 401, geçersiz token 401)
- `FetchNotificationsForUserUseCase` → `PgNotificationRepository` → PostgreSQL akışı uçtan uca çalışıyor
- 27 → 39 test, 0 typecheck hatası
- Migration 011 PostgreSQL'e uygulandı

## Süreç boyunca çözülen ortam sorunları

| Sorun | Çözüm |
|---|---|
| Cowork virtiofs Write tool'da truncation (null padding) | Bash heredoc ile dosya yazımı standartlaştı |
| `npm install` Cowork sandbox'ta yavaş | Windows host'ta çalıştırıldı |
| `.env` `password` vs container `prometa123` | `.env` düzeltildi |
| `seed.sql` `tax_office` sütunu yoktu | seed.sql migration ile hizalandı (commit `23494ee`) |
| Docker container'daki eski backend port 3000'i tutuyordu | `docker stop prometa-one-api`, host'taki `npm run dev` |
| Migration 009 (einvoice UUID/INTEGER uyumsuz) tüm migration'ı kilitliyordu | 011 manuel olarak `docker exec psql` ile uygulandı |

## Açık teknik borç (Faz 3+ için)

- [ ] Migration script 009 fail olunca 010/011'i atlamayacak (skip-on-fail flag)
- [ ] Migration 009: einvoice_credentials.company_id TEXT/UUID → INTEGER düzeltme
- [ ] `audit` middleware'i `ip` alanına `"unknown"` yazıyor, postgres `inet` tipi reddediyor (audit log silent fail)
- [ ] `api-server/docker-compose.yml`'a `volumes: - ./:/app` ekle (dev'de canlı kod hot reload)

---

## Faz 1 / PR 3 — Görsel Doğrulama (2026-05-19)

### Sonuç: ✅ Frontend modüler bell prod'da, App.jsx'e dokunulmadan

**Test akışı:**
1. http://localhost:5173/notifications-demo.html açıldı
2. admin/admin123 ile login (sayfa POST /v1/auth/login çağırdı)
3. Bell ikonu sağ üstte göründü, polling başladı (GET /v1/notifications)
4. Manuel SQL ile test bildirimi eklendi:
   ```sql
   INSERT INTO notifications (id, recipient_user_id, kind, title, body)
   VALUES ('demo-1', 5, '{"kind":"generic"}',
           'Strangler Fig çalışıyor',
           'Bu bildirim modüler bell üzerinden geliyor!');
   ```
5. Bell badge **"1"** olarak güncellendi
6. Bell tıklandı → dropdown'da bildirim listelendi

**Kanıtlanmış akış uçtan uca:**

```
[Tarayıcı]
  → useNotifications hook (30sn polling)
    → NotificationsApiClient.fetchForCurrentUser
      → fetch('http://localhost:3000/v1/notifications', { Bearer token })
        → [api-server Hono]
          → authMiddleware (JWT validate)
            → notificationsModule.router GET /
              → FetchNotificationsForUserUseCase.execute({ recipientUserId: 5 })
                → PgNotificationRepository.findByRecipient(5)
                  → SELECT * FROM notifications WHERE recipient_user_id = $1
                    → [PostgreSQL] → 1 row
                  → row → Notification entity
                → DTO mapper
              → JSON response
        ← {"notifications":[...], "unreadCount":1}
      ← state update
    ← render NotificationDropdown
  ← görsel: badge "1" + dropdown listesi
```

**App.jsx ne durumda?**
- 81.159 satır
- 79804. satırda eski local NotificationBell **dokunulmadı**
- main.jsx hâlâ App.jsx'i mount ediyor (root path)
- /notifications-demo.html ayrı entry point — paralel yaşıyor

**Strangler Fig commit serisi:**

```
6badc66 fix(frontend): inline tsconfig (Docker container '../tsconfig.base.json' bulamiyor)
902e835 feat(frontend/notifications): demo sayfasi (Faz 1 / PR 3B)
dda6c17 feat(frontend/notifications): bell + dropdown modulu (Faz 1 / PR 3A)
138d9db docs(verification): Faz 1 / PR 2 production'da çalıştığı kanıtlandı
23494ee fix(seed): align seed.sql with migration 002 schema
e686864 feat(modules/notifications): infrastructure + routes + DI (Faz 1 / PR 2)
e52ff3e feat(modules/notifications): domain + application iskelet (Faz 1 / PR 1)
9347e59 refactor(api): strict TS errors cleared (Faz 0.5)
```
