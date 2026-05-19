/**
 * NotificationKind — backend ile birebir aynı.
 * api-server/src/modules/notifications/domain/valueObjects/NotificationKind.ts
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

/** İkon eşleştirmesi — UI için (lucide-react isimleri). */
export function notificationKindIcon(kind: NotificationKind['kind']): string {
  switch (kind) {
    case 'task_due_soon':
      return 'ClipboardList';
    case 'invoice_overdue':
      return 'AlertCircle';
    case 'approval_stale':
      return 'Clock';
    case 'tax_deadline_warning':
      return 'Calendar';
    case 'check_due_soon':
      return 'Receipt';
    case 'scheduled_report':
      return 'FileText';
    case 'generic':
      return 'Bell';
  }
}
