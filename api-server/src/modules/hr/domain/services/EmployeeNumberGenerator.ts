/**
 * EmployeeNumberGenerator — yeni Employee numarası üretme stratejisi.
 *
 * Saf domain interface — concrete implementation infrastructure'da
 * (PR 4'te) PG sequence veya başka strateji kullanır. Test'te fake.
 *
 * Default strategy (PR 4'te): prefix + 6 haneli sıralı sayı (örn. EMP-000001).
 */
import { EmployeeNumber } from '../valueObjects/EmployeeNumber.js';

export interface EmployeeNumberGenerator {
  /**
   * Bir şirket için yeni, kullanılmamış EmployeeNumber üret.
   * Repository'nin "şu an kullanılan numaralar"ı bilmesine güvenir.
   */
  next(companyId: number): Promise<EmployeeNumber>;
}

/**
 * Basit, deterministik sequence-based generator.
 *
 * Üretim için kullanılır (infrastructure PR'ında PG sequence ile çalışır).
 * Test için bu sınıf direkt kullanılabilir — caller'ın "şu ana kadar kaç tane
 * çalışan var?" bilgisini sağlaması gerekir.
 */
export class SequentialEmployeeNumberGenerator implements EmployeeNumberGenerator {
  constructor(
    private readonly nextSequenceFn: (companyId: number) => Promise<number>,
    private readonly options: { prefix?: string; width?: number } = {},
  ) {}

  async next(companyId: number): Promise<EmployeeNumber> {
    const seq = await this.nextSequenceFn(companyId);
    const prefix = this.options.prefix ?? 'EMP-';
    const width = this.options.width ?? 6;
    const padded = String(seq).padStart(width, '0');
    return EmployeeNumber.create(prefix + padded);
  }
}
