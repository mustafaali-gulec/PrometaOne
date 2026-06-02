/**
 * Vkn — Vergi Kimlik No (10 hane) veya TC Kimlik No (11 hane) value object.
 *
 * E-faturada karşı taraf kimliği VKN (tüzel) veya TCKN (gerçek kişi) olabilir.
 * Her ikisinin de resmi checksum algoritması uygulanır.
 *
 * - VKN (10 hane): Maliye Bakanlığı VKN algoritması.
 * - TCKN (11 hane): NVI mod10/mod11 algoritması (ilk hane != 0).
 *
 * Immutable; `create` geçersizse `InvalidVknError` fırlatır.
 */
import { InvalidVknError } from '../errors/EInvoiceErrors.js';

export type VknKind = 'vkn' | 'tckn';

export class Vkn {
  private constructor(
    public readonly value: string,
    public readonly kind: VknKind,
  ) {}

  static create(raw: unknown): Vkn {
    if (typeof raw !== 'string') {
      throw new InvalidVknError(raw);
    }
    const digits = raw.trim();
    if (!/^\d+$/.test(digits)) {
      throw new InvalidVknError(raw);
    }
    if (digits.length === 10) {
      if (!Vkn.isValidVkn(digits)) {
        throw new InvalidVknError(raw);
      }
      return new Vkn(digits, 'vkn');
    }
    if (digits.length === 11) {
      if (!Vkn.isValidTckn(digits)) {
        throw new InvalidVknError(raw);
      }
      return new Vkn(digits, 'tckn');
    }
    throw new InvalidVknError(raw);
  }

  /** Doğrulamadan geçer mi? (fırlatmaz) */
  static isValid(raw: unknown): boolean {
    try {
      Vkn.create(raw);
      return true;
    } catch {
      return false;
    }
  }

  /** VKN (10 hane) resmi checksum algoritması. */
  static isValidVkn(v: string): boolean {
    if (!/^\d{10}$/.test(v)) {
      return false;
    }
    const digits = v.split('').map((c) => Number(c));
    const last = digits[9]!;
    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
      const tmp = (digits[i]! + (9 - i)) % 10;
      if (tmp === 9) {
        sum += tmp;
      } else {
        sum += (tmp * Math.pow(2, 9 - i)) % 9;
      }
    }
    const check = (10 - (sum % 10)) % 10;
    return check === last;
  }

  /** TCKN (11 hane) NVI algoritması. */
  static isValidTckn(v: string): boolean {
    if (!/^\d{11}$/.test(v)) {
      return false;
    }
    const d = v.split('').map((c) => Number(c));
    if (d[0] === 0) {
      return false;
    }
    const oddSum = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;
    const evenSum = d[1]! + d[3]! + d[5]! + d[7]!;
    const tenth = (oddSum * 7 - evenSum) % 10;
    const normalizedTenth = ((tenth % 10) + 10) % 10;
    if (normalizedTenth !== d[9]) {
      return false;
    }
    const first10Sum = d.slice(0, 10).reduce((a, b) => a + b, 0);
    return first10Sum % 10 === d[10];
  }

  isVkn(): boolean {
    return this.kind === 'vkn';
  }

  isTckn(): boolean {
    return this.kind === 'tckn';
  }

  equals(other: Vkn): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
