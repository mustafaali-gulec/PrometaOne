/**
 * NotificationFactory — NotificationKind'a göre title + body üretir.
 *
 * Tüm i18n şu an Türkçe sabit; ileride locale parametresi alabilir.
 */
import type { NotificationKind } from '../valueObjects/NotificationKind.js';

export interface NotificationContent {
  title: string;
  body: string;
}

export function buildNotificationContent(kind: NotificationKind): NotificationContent {
  switch (kind.kind) {
    case 'task_due_soon':
      return {
        title: `${kind.taskIds.length} görevin vadesi yaklaşıyor`,
        body: `${kind.daysUntilDue} gün içinde tamamlanması gereken ${kind.taskIds.length} görev var.`,
      };

    case 'invoice_overdue':
      return {
        title: `${kind.invoiceCount} fatura vadesi geçti`,
        body: `Toplam gecikmiş tutar: ${formatMoney(kind.totalAmount, kind.currency)}`,
      };

    case 'approval_stale':
      return {
        title: `Geciken onay: ${kind.entitySummary}`,
        body: `${kind.daysWaiting} gündür onay bekliyor.`,
      };

    case 'tax_deadline_warning': {
      const lines = kind.taxes.map((t) => `• ${t.name} — ${t.daysLeft} gün kaldı`).join('\n');
      return {
        title: `${kind.taxes.length} vergi tarihi yaklaşıyor`,
        body: lines,
      };
    }

    case 'check_due_soon':
      return {
        title: `${kind.checkIds.length} çek/senet vadesi yaklaşıyor`,
        body: `${kind.checkIds.length} adet çek/senet 5 gün içinde vadesi geliyor.`,
      };

    case 'scheduled_report':
      return {
        title: `Rapor hazır: ${kind.reportTitle}`,
        body: `${friendlyFrequency(kind.frequency)} rapor üretildi.`,
      };

    case 'generic':
      return {
        title: 'Bildirim',
        body: '',
      };
  }
}

function formatMoney(amount: number, currency: 'TRY' | 'USD' | 'EUR'): string {
  const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '€';
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

function friendlyFrequency(freq: 'daily' | 'weekly' | 'monthly'): string {
  switch (freq) {
    case 'daily':
      return 'Günlük';
    case 'weekly':
      return 'Haftalık';
    case 'monthly':
      return 'Aylık';
  }
}
