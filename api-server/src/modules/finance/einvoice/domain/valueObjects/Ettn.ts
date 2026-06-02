/**
 * Ettn — Elektronik Ticari Belge Numarası (GİB UUID).
 *
 * Her e-fatura GİB tarafında bir ETTN (UUID v1/v4) taşır. einvoice_invoices.uuid
 * kolonuna karşılık gelir; cache idempotency'si bu değere dayanır
 * (UNIQUE(company_id, uuid)).
 *
 * Immutable; geçersiz formatta `InvalidEttnError` fırlatır. Karşılaştırma
 * büyük/küçük harf duyarsız (UUID hex), saklama normalize lowercase.
 */
import { InvalidEttnError } from '../errors/EInvoiceErrors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class Ettn {
  private constructor(public readonly value: string) {}

  static create(raw: unknown): Ettn {
    if (typeof raw !== 'string' || !UUID_RE.test(raw.trim())) {
      throw new InvalidEttnError(raw);
    }
    return new Ettn(raw.trim().toLowerCase());
  }

  static isValid(raw: unknown): boolean {
    return typeof raw === 'string' && UUID_RE.test(raw.trim());
  }

  equals(other: Ettn): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
