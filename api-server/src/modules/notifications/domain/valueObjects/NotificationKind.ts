/**
 * NotificationKind — bildirim türü (discriminated union).
 *
 * Her tür kendi ek alanlarıyla typed. `kind` field'ı runtime'da
 * pattern matching için kullanılır.
 */

export type NotificationKind =
  | TaskDueSoonKind
  | InvoiceOverdueKind
  | ApprovalStaleKind
  | TaxDeadlineWarningKind
  | CheckDueSoonKind
  | ScheduledReportKind
  | GenericKind;

export interface TaskDueSoonKind {
  kind: 'task_due_soon';
  taskIds: ReadonlyArray<string>;
  daysUntilDue: number;
}

export interface InvoiceOverdueKind {
  kind: 'invoice_overdue';
  invoiceCount: number;
  totalAmount: number;
  currency: 'TRY' | 'USD' | 'EUR';
}

export interface ApprovalStaleKind {
  kind: 'approval_stale';
  requestId: string;
  daysWaiting: number;
  entitySummary: string;
}

export interface TaxDeadlineWarningKind {
  kind: 'tax_deadline_warning';
  taxes: ReadonlyArray<{
    readonly name: string;
    readonly deadline: string;
    readonly daysLeft: number;
  }>;
}

export interface CheckDueSoonKind {
  kind: 'check_due_soon';
  checkIds: ReadonlyArray<string>;
}

export interface ScheduledReportKind {
  kind: 'scheduled_report';
  reportId: string;
  reportTitle: string;
  frequency: 'daily' | 'weekly' | 'monthly';
}

export interface GenericKind {
  kind: 'generic';
}

/** Tüm bilinen NotificationKind discriminator'ları. */
export const NOTIFICATION_KIND_VALUES = [
  'task_due_soon',
  'invoice_overdue',
  'approval_stale',
  'tax_deadline_warning',
  'check_due_soon',
  'scheduled_report',
  'generic',
] as const satisfies ReadonlyArray<NotificationKind['kind']>;
