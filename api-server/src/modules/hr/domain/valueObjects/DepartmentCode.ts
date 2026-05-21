/**
 * DepartmentCode — şirket içi departman kısa kodu (opsiyonel).
 *
 * OrgUnitCode ile aynı kurallar (1-40 karakter, alfanumerik + tire + altçizgi).
 * Ayrı bir tip olarak tutuluyor çünkü domain dilinde farklı semantik:
 * departmanın kısa kodu org birimden bağımsız üretilir, kullanım yerleri ayrı.
 */
export class DepartmentCode {
  private constructor(public readonly value: string) {}

  static create(raw: string): DepartmentCode {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new InvalidDepartmentCodeError('DepartmentCode boş olamaz');
    }
    if (trimmed.length > 40) {
      throw new InvalidDepartmentCodeError('DepartmentCode 40 karakteri geçemez');
    }
    if (!DEPARTMENT_CODE_REGEX.test(trimmed)) {
      throw new InvalidDepartmentCodeError(
        `DepartmentCode sadece harf, rakam, tire ve altçizgi içerebilir: ${trimmed}`,
      );
    }
    return new DepartmentCode(trimmed);
  }

  toString(): string {
    return this.value;
  }
}

const DEPARTMENT_CODE_REGEX = /^[A-Za-z0-9_-]+$/;

export class InvalidDepartmentCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDepartmentCodeError';
  }
}
