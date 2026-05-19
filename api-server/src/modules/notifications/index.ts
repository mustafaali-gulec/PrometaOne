/**
 * Notifications modülü — Public API + DI registration.
 *
 * Bu dosya bu modülün dış dünyaya açtığı tek arayüzdür.
 * `app.ts` (composition root) sadece `registerNotificationsModule`'u çağırır.
 *
 * Internal dosyalara doğrudan erişim ESLint kuralıyla yasaklanmıştır.
 */

// Şu an iskelet — implementasyon hazır olunca açılacak.

// import type { Hono } from 'hono';
// import type { Pool } from 'pg';
// import type { Logger } from '../../shared/logging';

// export function registerNotificationsModule(
//   app: Hono,
//   db: Pool,
//   logger: Logger,
// ): void {
//   // 1. Infrastructure binding'leri
//   const repo = new PgNotificationRepository(db);
//   const email = new NodemailerEmailService(/* config */);
//
//   // 2. Use-case'leri kur
//   const fetchNotifications = new FetchNotificationsUseCase(repo);
//   const markAsRead = new MarkAsReadUseCase(repo);
//
//   // 3. Route'ları mount et
//   app.route('/v1/notifications', createNotificationsRouter({
//     fetchNotifications,
//     markAsRead,
//   }));
//
//   // 4. Cron job'ları başlat
//   const scheduler = new CronScheduler(logger);
//   scheduler.schedule('0 9 * * *', new CheckTaskDueSoonUseCase(repo, email));
//   scheduler.schedule('0 9 * * *', new CheckOverdueInvoicesUseCase(repo, email));
//   // ...
//   scheduler.start();
// }

// Public types (paylaşılması gerekiyorsa)
// export type { Notification } from './domain/entities/Notification';
// export type { NotificationKind } from './domain/valueObjects/NotificationKind';

export {};
