/**
 * Notifications modülü — Public API + DI registration.
 *
 * Dış dünyaya açılan tek arayüz. ESLint kuralı ile internal'a doğrudan
 * erişim yasak. `app.ts` (composition root) sadece bu dosyadan import eder.
 *
 * NOT: Şu an Faz 1 / PR 1 — sadece domain + application + DTO + port'lar
 * ihraç ediliyor. Infrastructure (PgNotificationRepository,
 * NodemailerEmailService) + Hono route'ları henüz yok. Sonraki PR'larda.
 */

// Domain (public types — diğer modüllerle paylaşılabilir)
export { Notification } from './domain/entities/Notification.js';
export type { NotificationProps } from './domain/entities/Notification.js';
export type {
  NotificationKind,
  TaskDueSoonKind,
  InvoiceOverdueKind,
  ApprovalStaleKind,
  TaxDeadlineWarningKind,
  CheckDueSoonKind,
  ScheduledReportKind,
  GenericKind,
} from './domain/valueObjects/NotificationKind.js';
export { NOTIFICATION_KIND_VALUES } from './domain/valueObjects/NotificationKind.js';
export {
  buildNotificationContent,
  type NotificationContent,
} from './domain/services/NotificationFactory.js';

// Application
export type { NotificationDto } from './application/dto/NotificationDto.js';
export { toNotificationDto } from './application/dto/NotificationDto.js';

// Ports (concrete impl'ler infrastructure/'da olacak)
export type { NotificationRepository } from './application/ports/NotificationRepository.js';
export type { EmailService, SendEmailRequest } from './application/ports/EmailService.js';
export type { IdGenerator } from './application/ports/IdGenerator.js';
export { systemClock, type Clock } from './application/ports/Clock.js';

// Use-cases
export {
  FetchNotificationsForUserUseCase,
  type FetchNotificationsForUserInput,
  type FetchNotificationsForUserResult,
} from './application/useCases/FetchNotificationsForUser.js';
export {
  MarkNotificationAsReadUseCase,
  NotificationNotFoundError,
  NotificationForbiddenError,
  type MarkNotificationAsReadInput,
} from './application/useCases/MarkNotificationAsRead.js';
export {
  CreateNotificationUseCase,
  type CreateNotificationInput,
} from './application/useCases/CreateNotification.js';
