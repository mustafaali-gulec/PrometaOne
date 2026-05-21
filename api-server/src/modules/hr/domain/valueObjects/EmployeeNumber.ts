/**
 * EmployeeNumber — şirket içi çalışan numarası.
 *
 * Format: 1-40 karakter, alfanumerik + tire + altçizgi. Şirket içinde
 * benzersizlik DB unique index ile uygulanır (uq_employees_company_employee_no).
 * Domain VO sadece format kontrolü yapar.
 */
export class EmployeeNumber {
  private constructor(public readonly value: string) {}

  static create(raw: string): EmployeeNumber {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new InvalidEmployeeNumberError('EmployeeNumber boş olamaz');
    }
    if (trimmed.length > 40) {
      throw new InvalidEmployeeNumberError('EmployeeNumber 40 karakteri geçemez');
    }
    if (!EMPLOYEE_NUMBER_REGEX.test(trimmed)) {
      throw new InvalidEmployeeNumberError(
        `EmployeeNumber sadece harf, rakam, tire ve altçizgi içerebilir: ${trimmed}`,
      );
    }
    return new EmployeeNumber(trimmed);
  }

  toString(): string {
    return this.value;
  }
}

const EMPLOYEE_NUMBER_REGEX = /^[A-Za-z0-9_-]+$/;

export class InvalidEmployeeNumberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmployeeNumberError';
  }
}
