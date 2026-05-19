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
