/**
 * InvoiceStatusPolicy — fatura durumu hesaplama domain servisi.
 *
 * 005_invoices.sql v_invoice_status mantığı ile birebir:
 *   paid    : paidAmount >= total − 1 kuruş
 *   partial : paidAmount > 0 (tam değil) — vade geçse bile partial kalır
 *   overdue : hiç ödeme yok + dueDate < today
 *   open    : hiç ödeme yok + vade gelmemiş
 *
 * remaining = total − paidAmount (negatife düşmez).
 */
import type { Invoice } from '../entities/Invoice.js';
import type { InvoiceStatus } from '../valueObjects/InvoiceStatus.js';
import { Money } from '../valueObjects/Money.js';

export const InvoiceStatusPolicy = {
  /**
   * @param invoice Fatura
   * @param today Bugünün tarihi (YYYY-MM-DD) — overdue kıyası için.
   */
  status(invoice: Invoice, today: string): InvoiceStatus {
    const oneKurus = Money.fromMinor(1, invoice.currency);
    const paid = invoice.paidAmount;
    const total = invoice.total;

    // paid: paidAmount >= total − 1 kuruş
    if (paid.isGreaterThan(total.minus(oneKurus)) || paid.equals(total.minus(oneKurus))) {
      return 'paid';
    }
    if (paid.isPositive()) {
      return 'partial';
    }
    // Hiç ödeme yok: vade geçmiş mi?
    if (invoice.dueDate < today) {
      return 'overdue';
    }
    return 'open';
  },

  remaining(invoice: Invoice): Money {
    return invoice.remaining();
  },

  isOpen(invoice: Invoice): boolean {
    return invoice.paidAmount.isZero();
  },
} as const;
