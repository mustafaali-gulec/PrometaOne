/**
 * Notifications modülü — Public API.
 *
 * Dış dünyaya açılan tek arayüz. ESLint kuralı ile internal'a doğrudan
 * erişim yasak. App.tsx (veya Strangler Fig sürecinde App.jsx adapter)
 * sadece buradan import eder.
 */

// Domain types (paylaşılması gerekiyorsa)
export type {
  NotificationKind,
  TaskDueSoonKind,
  InvoiceOverdueKind,
  ApprovalStaleKind,
  TaxDeadlineWarningKind,
  CheckDueSoonKind,
  ScheduledReportKind,
  GenericKind,
} from './domain/valueObjects/NotificationKind';
export { notificationKindIcon } from './domain/valueObjects/NotificationKind';

// Application types
export type {
  NotificationDto,
  FetchNotificationsResult,
} from './application/dto/NotificationDto';

// Ports (concrete impl factory'leri için)
export type { AuthTokenProvider } from './application/ports/AuthTokenProvider';
export type { NotificationsApi } from './application/ports/NotificationsApi';

// Infrastructure (concrete)
export { NotificationsApiClient } from './infrastructure/api/NotificationsApiClient';

// Presentation (UI)
export { useNotifications, type UseNotificationsResult, type UseNotificationsOptions } from './presentation/hooks/useNotifications';
export { NotificationBell, type NotificationBellProps } from './presentation/components/NotificationBell';
