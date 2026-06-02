/**
 * EInvoiceToInvoicePolicy — bir e-faturayı Faz 5 `Invoice` (AR/AP) kaydına çevirir.
 *
 * Eşleme:
 *   - type: incoming → 'out' (gelen fatura = borç/AP), outgoing → 'in' (alacak/AR)
 *   - total = subtotal + kdv (Invoice invariant'ı). Tevkifat/ÖTV gibi ek vergiler
 *     bu sürümde Invoice toplamına dahil edilmez (payableAmount'tan sapabilir) —
 *     bilinen sadeleştirme.
 *   - kdvRate: kdv/subtotal'den türetilir (0..1 clamp), subtotal 0 ise 0.
 *   - cashflowCatId: party mapping'den gelir (dışarıdan verilir).
 */
import { Invoice } from '../../../domain/entities/Invoice.js';
import { KdvRate } from '../../../domain/valueObjects/KdvRate.js';
import { Money } from '../../../domain/valueObjects/Money.js';
import type { EInvoice } from '../entities/EInvoice.js';

function deriveKdvRate(einvoice: EInvoice): KdvRate {
  const subtotal = Number(einvoice.subtotal.toDecimalString());
  const kdv = Number(einvoice.kdvTotal.toDecimalString());
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return KdvRate.create(0);
  }
  const raw = kdv / subtotal;
  const clamped = Math.min(1, Math.max(0, Math.round(raw * 10000) / 10000));
  return KdvRate.create(clamped);
}

export const EInvoiceToInvoicePolicy = {
  toInvoice(
    einvoice: EInvoice,
    ctx: { cashflowCatId: number | null; createdBy: number | null; now: Date },
  ): Invoice {
    const subtotal = einvoice.subtotal;
    const kdv = einvoice.kdvTotal;
    const total = subtotal.plus(kdv);
    const counterparty =
      (einvoice.partyName ?? einvoice.partyVknTckn ?? 'Bilinmeyen taraf').trim() ||
      'Bilinmeyen taraf';

    return Invoice.create({
      id: null,
      companyId: einvoice.companyId,
      type: einvoice.direction === 'incoming' ? 'out' : 'in',
      invoiceNo: einvoice.invoiceNo === '' ? null : einvoice.invoiceNo,
      counterparty,
      issueDate: einvoice.issueDate === '' ? null : einvoice.issueDate,
      dueDate: einvoice.dueDate ?? einvoice.issueDate,
      currency: einvoice.currency,
      subtotal,
      kdvRate: deriveKdvRate(einvoice),
      kdv,
      total,
      paidAmount: Money.zero(einvoice.currency),
      cashflowCatId: ctx.cashflowCatId,
      committedToCells: false,
      committedAt: null,
      note: `e-Fatura ${einvoice.uuid}`,
      createdBy: ctx.createdBy,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    });
  },
} as const;
