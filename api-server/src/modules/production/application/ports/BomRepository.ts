/**
 * BomRepository — reçete (ürün ağacı) kalıcılık portu.
 *
 * Aggregate: Bom + components + operations birlikte yazılır/okunur.
 * Concrete: infrastructure/persistence/PgBomRepository.ts.
 */
import type { Bom, BomComponent, BomOperation } from '../../domain/entities/Bom.js';
import type { BomStatus } from '../../domain/valueObjects/BomStatus.js';

export interface NewBomInput {
  companyId: number;
  no: string;
  productMaterialRef: string;
  name: string;
  outputQty: number;
  outputUnit: string | null;
  version: string | null;
  status: BomStatus;
  notes: string | null;
  components: Omit<BomComponent, 'id'>[];
  operations: Omit<BomOperation, 'id'>[];
}

export interface BomRepository {
  insert(input: NewBomInput): Promise<Bom>;
  /** Başlık + bileşenler + operasyonlar tamamen güncellenir (replace). */
  update(bom: Bom): Promise<void>;
  findById(id: number, companyId: number): Promise<Bom | null>;
  /** productMaterialRef ile (aktif/draft) reçete bul — MRP/maliyet için. */
  findByProductRef(productMaterialRef: string, companyId: number): Promise<Bom | null>;
  listByCompany(
    companyId: number,
    options?: { status?: BomStatus; search?: string },
  ): Promise<ReadonlyArray<Bom>>;
  /** companyId kapsamındaki tüm reçeteleri (yarı mamul patlatması için) döner. */
  listAllForExplosion(companyId: number): Promise<ReadonlyArray<Bom>>;
  delete(id: number, companyId: number): Promise<void>;
  existsByNo(companyId: number, no: string, excludeId?: number): Promise<boolean>;
}
