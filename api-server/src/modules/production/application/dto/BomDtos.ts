/**
 * BOM (reçete) DTO'ları — REST sınırında kullanılan düz tipler.
 *
 * Miktar/oran alanları number olarak serileşir (operasyonel hassasiyet;
 * NUMERIC(20,4) → Number). Tarihler ISO string.
 */
import type { Bom, BomComponent, BomOperation } from '../../domain/entities/Bom.js';
import type { ExplodeResult } from '../../domain/services/BomExploder.js';
import type { CostRollupResult } from '../../domain/services/CostRollup.js';
import type { BomStatus } from '../../domain/valueObjects/BomStatus.js';

export interface BomComponentDto {
  id: number | null;
  materialRef: string;
  qty: number;
  unit: string | null;
  scrapPct: number;
  isSemi: boolean;
  sortOrder: number;
}

export interface BomOperationDto {
  id: number | null;
  workCenterId: number | null;
  name: string;
  setupMin: number;
  runMinPerUnit: number;
  seq: number;
}

export interface BomDto {
  id: number;
  companyId: number;
  no: string;
  productMaterialRef: string;
  name: string;
  outputQty: number;
  outputUnit: string | null;
  version: string | null;
  status: BomStatus;
  notes: string | null;
  components: BomComponentDto[];
  operations: BomOperationDto[];
  createdAt: string;
  updatedAt: string;
}

function toComponentDto(c: BomComponent): BomComponentDto {
  return {
    id: c.id ?? null,
    materialRef: c.materialRef,
    qty: c.qty,
    unit: c.unit,
    scrapPct: c.scrapPct,
    isSemi: c.isSemi,
    sortOrder: c.sortOrder,
  };
}

function toOperationDto(o: BomOperation): BomOperationDto {
  return {
    id: o.id ?? null,
    workCenterId: o.workCenterId,
    name: o.name,
    setupMin: o.setupMin,
    runMinPerUnit: o.runMinPerUnit,
    seq: o.seq,
  };
}

export function toBomDto(b: Bom): BomDto {
  const j = b.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    no: j.no,
    productMaterialRef: j.productMaterialRef,
    name: j.name,
    outputQty: j.outputQty,
    outputUnit: j.outputUnit,
    version: j.version,
    status: j.status,
    notes: j.notes,
    components: j.components.map(toComponentDto),
    operations: j.operations.map(toOperationDto),
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export interface ExplodeBomDto {
  bomId: number;
  productMaterialRef: string;
  qty: number;
  requirements: ExplodeResult['requirements'];
  rootOperations: ExplodeResult['rootOperations'];
}

export interface BomCostDto extends CostRollupResult {
  bomId: number;
  productMaterialRef: string;
  outputQty: number;
}
