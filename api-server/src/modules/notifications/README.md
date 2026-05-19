# `api-server/modules/notifications/`

Bildirim domain'i + cron daemon + e-posta gönderimi.

## ⚠️ Durum: İSKELET — implementasyon yok

`legacy/backend/src/services/cronDaemon.js` + `emailService.js` buraya **TypeScript strict** olarak yeniden yazılacak.

İlk migration PR'ında yapılacaklar:

### Domain
- `domain/entities/Notification.ts` — id, recipientId, kind, title, body, link, meta, createdAt, readAt
- `domain/valueObjects/NotificationKind.ts` — `task_due_soon | invoice_overdue | approval_stale | tax_deadline_warning | check_due_soon | ...`
- `domain/services/NotificationFactory.ts` — Notification oluşturma kuralları

### Application
- `application/useCases/CheckTaskDueSoon.ts` — Cron job logic
- `application/useCases/CheckOverdueInvoices.ts`
- `application/useCases/CheckStaleApprovals.ts`
- `application/useCases/CheckTaxDeadlines.ts`
- `application/useCases/CheckUpcomingChecks.ts`
- `application/useCases/SendScheduledReports.ts`
- `application/useCases/MarkNotificationAsRead.ts`
- `application/useCases/SendNotificationEmail.ts`
- `application/dto/NotificationDto.ts`

### Infrastructure
- `infrastructure/persistence/PgNotificationRepository.ts` — interface: `NotificationRepository`
- `infrastructure/email/NodemailerEmailService.ts` — interface: `EmailService`
- `infrastructure/email/templates/notificationEmail.ts` — HTML şablonlar (eski emailService'tan modernize)
- `infrastructure/cron/CronScheduler.ts` — node-cron wrapper

### Presentation
- `presentation/routes.ts` — REST endpoint'leri: `GET /v1/notifications`, `POST /v1/notifications/:id/read`

### DI
- `index.ts`: composition function `registerNotificationsModule(app, db, logger)` — Hono app'e mount eder, DI'ı yapar.

## Migration sırasında dikkat edilecekler

- Eski `db.getTasks()` çağrıları → gerçek PostgreSQL sorguları (api-server'ın `db.ts` pool'u)
- Eski `CommonJS require` → `import` (ESM zaten ayarlı)
- Eski "user.username" recipient ID → PostgreSQL `users.id` (UUID veya numerik)
- Eski HTML template'leri korunur ama TS'te template literal olarak; testle doğrulanır

## Test stratejisi

- `__tests__/domain/`: NotificationFactory'nin kural sırasını test eder
- `__tests__/application/`: Her use-case için mock repository + mock email service
- `__tests__/infrastructure/`: testcontainers ile gerçek PostgreSQL + nodemailer test transport
