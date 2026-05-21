/**
 * TcKimlik — TC Vatandaşlık Numarası (11 hane, mod 10/11 algoritması).
 *
 * Algoritma (NVİ resmi):
 *   1. 11 hane, hepsi rakam
 *   2. İlk hane 0 olamaz
 *   3. 10. hane: (1+3+5+7+9. hanelerin toplamı × 7) - (2+4+6+8. hanelerin toplamı), mod 10
 *   4. 11. hane: ilk 10 hanenin toplamı, mod 10
 *
 * Referans: https://nvi.gov.tr (mod 10/11 algoritması, "TC Kimlik Numarası Doğrulama")
 */
export class TcKimlik {
  private constructor(public readonly value: string) {}

  static create(raw: string): TcKimlik {
    const trimmed = raw.trim();
    if (!/^\d{11}$/.test(trimmed)) {
      throw new InvalidTcKimlikError('TC Kimlik 11 haneli sayı olmalı');
    }
    if (trimmed[0] === '0') {
      throw new InvalidTcKimlikError('TC Kimlik ilk hanesi 0 olamaz');
    }

    const digits = trimmed.split('').map(Number);

    // 10. hane kontrolü
    const oddSum = digits[0]! + digits[2]! + digits[4]! + digits[6]! + digits[8]!;
    const evenSum = digits[1]! + digits[3]! + digits[5]! + digits[7]!;
    const tenthDigit = (oddSum * 7 - evenSum) % 10;
    // Modulo negative koruma
    const tenthExpected = (tenthDigit + 10) % 10;
    if (tenthExpected !== digits[9]) {
      throw new InvalidTcKimlikError(
        `TC Kimlik geçersiz: 10. hane checksum hatası (beklenen=${tenthExpected}, gelen=${digits[9]})`,
      );
    }

    // 11. hane kontrolü
    const firstTenSum = digits.slice(0, 10).reduce((a, b) => a + b, 0);
    const eleventhExpected = firstTenSum % 10;
    if (eleventhExpected !== digits[10]) {
      throw new InvalidTcKimlikError(
        `TC Kimlik geçersiz: 11. hane checksum hatası (beklenen=${eleventhExpected}, gelen=${digits[10]})`,
      );
    }

    return new TcKimlik(trimmed);
  }

  /**
   * Bir string'in geçerli bir TC Kimlik olup olmadığını fırlatmadan kontrol eder.
   */
  static isValid(raw: string): boolean {
    try {
      TcKimlik.create(raw);
      return true;
    } catch {
      return false;
    }
  }

  toString(): string {
    return this.value;
  }
}

export class InvalidTcKimlikError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTcKimlikError';
  }
}
