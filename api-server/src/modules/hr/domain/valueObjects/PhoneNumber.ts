/**
 * PhoneNumber — TR formatına normalize eden telefon numarası.
 *
 * Kabul edilen girişler (örnek):
 *   - "0532 123 45 67"
 *   - "+905321234567"
 *   - "905321234567"
 *   - "532-123-45-67"
 *   - "(0532) 1234567"
 *
 * Çıktı (value): E.164 benzeri TR formatı: "+90XXXXXXXXXX" (12 karakter)
 *
 * NOT: Şu an sadece Türkiye numaralarını destekliyoruz; uluslararası
 * destek gerekirse `libphonenumber-js` veya benzeri kütüphane sonra eklenir.
 */
export class PhoneNumber {
  private constructor(public readonly value: string) {}

  static create(raw: string): PhoneNumber {
    if (raw == null) {
      throw new InvalidPhoneNumberError('PhoneNumber boş olamaz');
    }
    // Sadece rakamları al
    const digitsOnly = raw.replace(/\D/g, '');

    if (digitsOnly.length === 0) {
      throw new InvalidPhoneNumberError('PhoneNumber boş olamaz');
    }

    // Olası ön ekleri normalize et:
    //   "905321234567" → 12 hane, +90 ekle değil zaten 90 ile başlıyor
    //   "05321234567"  → 11 hane, başındaki 0'ı 90 ile değiştir
    //   "5321234567"   → 10 hane, başına 90 ekle
    let normalized: string;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('90')) {
      normalized = digitsOnly;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      normalized = '90' + digitsOnly.slice(1);
    } else if (digitsOnly.length === 10 && digitsOnly.startsWith('5')) {
      normalized = '90' + digitsOnly;
    } else {
      throw new InvalidPhoneNumberError(`PhoneNumber TR formatına uymuyor: ${raw}`);
    }

    // TR cep numarası operatör kodları 5 ile başlar — kontrol et
    if (normalized.charAt(2) !== '5') {
      throw new InvalidPhoneNumberError(
        `PhoneNumber TR cep numarası olmalı (5xx ile başlamalı): ${raw}`,
      );
    }

    return new PhoneNumber('+' + normalized);
  }

  toString(): string {
    return this.value;
  }
}

export class InvalidPhoneNumberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPhoneNumberError';
  }
}
