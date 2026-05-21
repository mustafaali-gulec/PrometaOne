/**
 * OrgUnitRepository — port.
 *
 * Concrete: infrastructure/persistence/PgOrgUnitRepository.ts (PR 4'te).
 * Tüm metodlar şirket-bağlamlı (companyId) — multi-tenant izolasyon.
 */
import type { OrgUnit } from '../../domain/entities/OrgUnit.js';

export interface OrgUnitRepository {
  /** Yeni bir OrgUnit ekler. Döndürdüğü OrgUnit'in `id`'si DB'den gelir. */
  insert(input: NewOrgUnitInput): Promise<OrgUnit>;

  /** Mevcut OrgUnit'i günceller (id ile). */
  update(unit: OrgUnit): Promise<void>;

  /** Tek bir OrgUnit, yoksa null. Şirket farklıysa null döner (izolasyon). */
  findById(id: number, companyId: number): Promise<OrgUnit | null>;

  /**
   * Bir şirketin tüm OrgUnit'lerini listeler.
   * `includeInactive: true` arşivli olanları da getirir (default false).
   */
  listByCompany(
    companyId: number,
    options?: { includeInactive?: boolean },
  ): Promise<ReadonlyArray<OrgUnit>>;

  /**
   * Verilen parent altında çocuk var mı? `archive` öncesi kontrol için.
   */
  hasChildren(unitId: number, companyId: number): Promise<boolean>;
}

/**
 * insert için giriş — id ve timestamp'ler DB tarafından üretildiği için
 * domain entity'sinden farklı bir input tipi.
 */
export interface NewOrgUnitInput {
  companyId: number;
  parentId: number | null;
  name: string;
  /** OrgUnitCode raw string formatında — repository validate eder, kabul ederse saklar. */
  code: string | null;
  sortOrder: number;
  active: boolean;
}
