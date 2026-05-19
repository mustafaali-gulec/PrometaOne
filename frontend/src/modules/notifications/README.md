# `modules/notifications/`

Bildirim feed, badge, dropdown, push tercihleri.

## ⚠️ Durum: İSKELET — implementasyon yok

Bu modül **Strangler Fig migration için ilk hedef** olarak öneriliyor. Şu an sadece katmanlı yapı dosyaları var (örnek olarak).

İlk migration PR'ında:

1. `domain/entities/Notification.ts` — Notification entity'si (id, kind, title, body, createdAt, readAt, ...)
2. `domain/valueObjects/NotificationKind.ts` — Discriminated union veya enum
3. `application/useCases/fetchNotifications.ts` — Liste çek
4. `application/useCases/markAsRead.ts`
5. `infrastructure/api/NotificationsApiClient.ts` — fetch wrap
6. `presentation/components/NotificationBell.tsx` — Eski `App.jsx`'teki bell dropdown buraya taşınır
7. `presentation/hooks/useNotifications.ts` — TanStack Query benzeri pattern

Detay: `docs/MIGRATION_ROADMAP.md` (eklenecek).
