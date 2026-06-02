/**
 * CashflowCommitPolicy — bir nakit hareketinin hangi bütçe hücresine
 * (Cell) ne kadar yansıyacağını hesaplayan domain servisi.
 *
 * "Commit-to-cells": gerçekleşen kasa hareketi / transfer / fatura, bütçe
 * matrisindeki ilgili (kategori × ay) hücresine eklenir. Böylece plan
 * (bütçe) ile gerçekleşen yan yana görülebilir.
 *
 * Eşleme:
 *   - kategori: hareketin cashflowCatId'si (yoksa commit edilemez → null)
 *   - ay/yıl  : hareketin tarihinden (date / dueDate)
 *   - tutar   : kasa → signedAmount (in +, out −)
 *               transfer → fromAmount (çıkış tarafı)
 *               fatura → total, type in → +, out → −
 */
import type { Invoice } from '../entities/Invoice.js';
import type { KasaEntry } from '../entities/KasaEntry.js';
import type { Transfer } from '../entities/Transfer.js';
import type { Money } from '../valueObjects/Money.js';

export interface CellDelta {
  categoryId: number;
  fiscalYear: number;
  monthIdx: number;
  amount: Money;
}

/** 'YYYY-MM-DD' → { year, monthIdx (0=Ocak) }. */
function parseYearMonth(isoDate: string): { year: number; monthIdx: number } {
  const [y, m] = isoDate.split('-');
  return { year: Number(y), monthIdx: Number(m) - 1 };
}

export const CashflowCommitPolicy = {
  forKasaEntry(entry: KasaEntry): CellDelta | null {
    if (entry.cashflowCatId === null) {
      return null;
    }
    const { year, monthIdx } = parseYearMonth(entry.date);
    return {
      categoryId: entry.cashflowCatId,
      fiscalYear: year,
      monthIdx,
      amount: entry.signedAmount(),
    };
  },

  forTransfer(transfer: Transfer): CellDelta | null {
    if (transfer.cashflowCatId === null) {
      return null;
    }
    const { year, monthIdx } = parseYearMonth(transfer.date);
    return {
      categoryId: transfer.cashflowCatId,
      fiscalYear: year,
      monthIdx,
      amount: transfer.fromAmount,
    };
  },

  forInvoice(invoice: Invoice): CellDelta | null {
    if (invoice.cashflowCatId === null) {
      return null;
    }
    const { year, monthIdx } = parseYearMonth(invoice.dueDate);
    return {
      categoryId: invoice.cashflowCatId,
      fiscalYear: year,
      monthIdx,
      amount: invoice.type === 'in' ? invoice.total : invoice.total.negate(),
    };
  },
} as const;
