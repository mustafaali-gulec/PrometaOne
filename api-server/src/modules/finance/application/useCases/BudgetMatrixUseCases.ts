/**
 * Bütçe matrisi use-case'leri (Faz 5 / PR 2).
 *
 * GetBudgetMatrix — okuma (kategoriler + hücreler → matris).
 * SetCellValue / BulkSetCells — yazma (hücre UPSERT).
 *
 * Para birimi: `cells` tablosunda currency yok; matris şirketin ana
 * biriminde planlanır. Şimdilik input'tan `currency` alınır (varsayılan TRY);
 * Faz 5 ilerleyince company ayarından türetilir.
 */
import { Cell } from '../../domain/entities/Cell.js';
import { CategoryNotFoundError } from '../../domain/errors/FinanceErrors.js';
import { BudgetMatrix } from '../../domain/services/BudgetMatrix.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';
import { FiscalYear } from '../../domain/valueObjects/FiscalYear.js';
import { Money } from '../../domain/valueObjects/Money.js';
import { MonthIndex } from '../../domain/valueObjects/MonthIndex.js';
import { toBudgetMatrixDto, type BudgetMatrixDto } from '../dto/BudgetDtos.js';
import type { CategoryRepository } from '../ports/CategoryRepository.js';
import type { CellRepository } from '../ports/CellRepository.js';
import type { Clock } from '../ports/Clock.js';

export interface GetBudgetMatrixInput {
  companyId: number;
  fiscalYear: number;
  currency?: Currency;
}

export class GetBudgetMatrixUseCase {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly cells: CellRepository,
  ) {}

  async execute(input: GetBudgetMatrixInput): Promise<BudgetMatrixDto> {
    const fy = FiscalYear.create(input.fiscalYear);
    const currency: Currency = input.currency ?? 'TRY';
    const [categories, cells] = await Promise.all([
      this.categories.listByCompany(input.companyId),
      this.cells.findByCompanyYear(input.companyId, fy.value),
    ]);
    const result = BudgetMatrix.build({
      currency,
      fiscalYear: fy.value,
      categories,
      cells,
    });
    return toBudgetMatrixDto(result);
  }
}

export interface SetCellValueInput {
  companyId: number;
  categoryId: number;
  fiscalYear: number;
  monthIdx: number;
  /** Major (ondalık) değer, örn. 1250.50. */
  value: number;
  currency?: Currency;
  actorUserId: number | null;
}

export class SetCellValueUseCase {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly cells: CellRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCellValueInput): Promise<void> {
    // Kategori aynı şirkette mi? (FK güvenliği + multi-tenant izolasyon)
    const category = await this.categories.findById(input.categoryId, input.companyId);
    if (!category) {
      throw new CategoryNotFoundError(input.categoryId);
    }
    const currency: Currency = input.currency ?? 'TRY';
    const cell = Cell.create({
      id: null,
      companyId: input.companyId,
      categoryId: input.categoryId,
      fiscalYear: FiscalYear.create(input.fiscalYear),
      monthIdx: MonthIndex.create(input.monthIdx),
      value: Money.fromMajor(input.value, currency),
      updatedAt: this.clock.now(),
      updatedBy: input.actorUserId,
    });
    await this.cells.upsert(cell);
  }
}

export interface BulkSetCellsInput {
  companyId: number;
  fiscalYear: number;
  currency?: Currency;
  actorUserId: number | null;
  entries: { categoryId: number; monthIdx: number; value: number }[];
}

export class BulkSetCellsUseCase {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly cells: CellRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: BulkSetCellsInput): Promise<void> {
    const now = this.clock.now();
    const currency: Currency = input.currency ?? 'TRY';
    const fy = FiscalYear.create(input.fiscalYear);

    // Geçerli kategori id'lerini tek seferde topla (multi-tenant izolasyon).
    const validIds = new Set(
      (await this.categories.listByCompany(input.companyId, { includeArchived: true })).map(
        (c) => c.id,
      ),
    );

    const cells: Cell[] = [];
    for (const e of input.entries) {
      if (!validIds.has(e.categoryId)) {
        throw new CategoryNotFoundError(e.categoryId);
      }
      cells.push(
        Cell.create({
          id: null,
          companyId: input.companyId,
          categoryId: e.categoryId,
          fiscalYear: fy,
          monthIdx: MonthIndex.create(e.monthIdx),
          value: Money.fromMajor(e.value, currency),
          updatedAt: now,
          updatedBy: input.actorUserId,
        }),
      );
    }
    await this.cells.bulkUpsert(cells);
  }
}
