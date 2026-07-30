/**
 * LocationRepository — mekân kırılımı kalıcılık portu.
 * Concrete: infrastructure/persistence/PgLocationRepository.ts
 */
import type { Location } from '../../domain/entities/Location.js';
import type { LocationKind } from '../../domain/valueObjects/LocationKind.js';

export interface NewLocationInput {
  companyId: number;
  projectId: number;
  parentId: number | null;
  kind: LocationKind;
  code: string;
  name: string;
  sortOrder: number;
  unitType: string | null;
  grossArea: number | null;
  netArea: number | null;
  landShare: number | null;
  facade: string | null;
  createdBy: number | null;
}

export interface ListLocationsOptions {
  includeInactive?: boolean;
  kind?: LocationKind;
  /** Yalnız bu düğümün alt ağacı (kendisi dahil) */
  subtreeOf?: number;
  search?: string;
}

/**
 * Lokasyona bağlı kayıt sayıları — silme öncesi kontrolde kullanılır.
 * Sıfırdan büyük her alan kullanıcıya "şu kadar gider bağlı" olarak gösterilir.
 */
export interface LocationUsage {
  boqLines: number;
  expenses: number;
  timesheets: number;
  machineLogs: number;
  stockMovements: number;
  measurements: number;
  materialRequests: number;
  attachments: number;
  trackingLocations: number;
  children: number;
}

export interface LocationRepository {
  insert(input: NewLocationInput): Promise<Location>;
  update(location: Location): Promise<void>;
  findById(id: number, companyId: number): Promise<Location | null>;
  listByProject(
    projectId: number,
    companyId: number,
    options?: ListLocationsOptions,
  ): Promise<ReadonlyArray<Location>>;
  /** Aynı ebeveyn altında kod çakışması var mı? */
  existsByCode(
    companyId: number,
    projectId: number,
    parentId: number | null,
    code: string,
    excludeId?: number,
  ): Promise<boolean>;
  /**
   * Ebeveyn değiştirir. path/depth'i (ve tüm alt ağacın path'ini) DB trigger'ı
   * tazeler; bu yüzden entity üzerinden değil ayrı bir yazma olarak durur —
   * Location entity'si parentId'yi değiştirilebilir alan olarak taşımaz.
   */
  moveTo(id: number, companyId: number, newParentId: number | null): Promise<void>;
  usage(id: number, companyId: number): Promise<LocationUsage>;
  /** Sert silme — yalnız bağlı kayıt yoksa çağrılır (use-case kontrol eder). */
  hardDelete(id: number, companyId: number): Promise<void>;
  /**
   * Toplu üretim: blok × kat × daire iskeletini tek transaction'da kurar.
   * Var olan kodlar atlanır (idempotent yeniden koşum).
   */
  bulkGenerate(input: BulkGenerateInput): Promise<ReadonlyArray<Location>>;
}

export interface BulkGenerateInput {
  companyId: number;
  projectId: number;
  /** Altına üretilecek kök düğüm; null ise bloklar kök olur. */
  parentId: number | null;
  createdBy: number | null;
  /** Blok kodları, ör. ['A','B','C'] */
  blocks: ReadonlyArray<string>;
  /** Kat kodları, ör. ['0','1','2'] — boşsa kat üretilmez */
  floors: ReadonlyArray<string>;
  /** Kat başına bağımsız bölüm sayısı; 0 ise daire üretilmez */
  unitsPerFloor: number;
  /**
   * Daire numaralandırma: 'sequential' tüm blokta 1..N devam eder,
   * 'per_floor' her katta 1'den başlar.
   */
  unitNumbering: 'sequential' | 'per_floor';
  /** Üretilen dairelere yazılacak varsayılan tip, ör. '2+1' */
  defaultUnitType: string | null;
  /** İsim şablonları — {code} yer tutucusu kodla değiştirilir */
  blockNameTemplate: string;
  floorNameTemplate: string;
  unitNameTemplate: string;
}
