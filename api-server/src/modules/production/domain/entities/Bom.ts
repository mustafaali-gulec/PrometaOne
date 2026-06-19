/**
 * Bom — Ürün Ağacı / Reçete (033_production_mrp.sql).
 *
 * Bir mamulün (product_material_ref) hangi bileşenlerden ve hangi
 * operasyonlardan üretildiğini tanımlar. WMS henüz backend'siz olduğundan
 * malzeme referansları opaque string'tir (materialRef).
 *
 * Aggregate root: bileşenler (components) ve operasyonlar (operations) bu
 * varlığa aittir; reçete kaydedilirken birlikte yeniden yazılır.
 *
 * Immutable — withComponents/withOperations/update yeni instance döner.
 */
import { InvalidBomError } from '../errors/ProductionErrors.js';
import type { BomStatus } from '../valueObjects/BomStatus.js';

export interface BomComponent {
  /** Yeni satırlarda id olmayabilir (DB'ye yazılınca dolar). */
  id?: number;
  materialRef: string;
  qty: number;
  unit: string | null;
  /** Fire yüzdesi (örn. 5 = %5). */
  scrapPct: number;
  /** Bu bileşen kendisi de üretiliyor mu (yarı mamul → çok seviyeli patlatma). */
  isSemi: boolean;
  sortOrder: number;
}

export interface BomOperation {
  id?: number;
  workCenterId: number | null;
  name: string;
  setupMin: number;
  runMinPerUnit: number;
  seq: number;
}

export interface BomProps {
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
  components: BomComponent[];
  operations: BomOperation[];
  createdAt: Date;
  updatedAt: Date;
}

export class Bom {
  private constructor(private readonly props: Readonly<BomProps>) {}

  static create(props: BomProps): Bom {
    if (props.id <= 0) {
      throw new InvalidBomError('id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new InvalidBomError('companyId pozitif olmalı');
    }
    if (props.no.trim().length === 0) {
      throw new InvalidBomError('reçete numarası boş olamaz');
    }
    if (props.productMaterialRef.trim().length === 0) {
      throw new InvalidBomError('mamul (ürün) referansı boş olamaz');
    }
    if (props.name.trim().length === 0) {
      throw new InvalidBomError('ad boş olamaz');
    }
    if (!(props.outputQty > 0)) {
      throw new InvalidBomError('çıktı miktarı pozitif olmalı');
    }
    Bom.validateComponents(props.components);
    Bom.validateOperations(props.operations);
    return new Bom(props);
  }

  private static validateComponents(components: readonly BomComponent[]): void {
    for (const c of components) {
      if (c.materialRef.trim().length === 0) {
        throw new InvalidBomError('bileşen malzeme referansı boş olamaz');
      }
      if (!(c.qty > 0)) {
        throw new InvalidBomError(`bileşen miktarı pozitif olmalı (${c.materialRef})`);
      }
      if (c.scrapPct < 0) {
        throw new InvalidBomError(`bileşen fire yüzdesi negatif olamaz (${c.materialRef})`);
      }
    }
  }

  private static validateOperations(operations: readonly BomOperation[]): void {
    for (const op of operations) {
      if (op.name.trim().length === 0) {
        throw new InvalidBomError('operasyon adı boş olamaz');
      }
      if (op.setupMin < 0) {
        throw new InvalidBomError(`operasyon hazırlık süresi negatif olamaz (${op.name})`);
      }
      if (op.runMinPerUnit < 0) {
        throw new InvalidBomError(`operasyon birim süresi negatif olamaz (${op.name})`);
      }
    }
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get no(): string {
    return this.props.no;
  }
  get productMaterialRef(): string {
    return this.props.productMaterialRef;
  }
  get name(): string {
    return this.props.name;
  }
  get outputQty(): number {
    return this.props.outputQty;
  }
  get outputUnit(): string | null {
    return this.props.outputUnit;
  }
  get version(): string | null {
    return this.props.version;
  }
  get status(): BomStatus {
    return this.props.status;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get components(): readonly BomComponent[] {
    return this.props.components;
  }
  get operations(): readonly BomOperation[] {
    return this.props.operations;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(
    patch: {
      no?: string;
      productMaterialRef?: string;
      name?: string;
      outputQty?: number;
      outputUnit?: string | null;
      version?: string | null;
      status?: BomStatus;
      notes?: string | null;
      components?: BomComponent[];
      operations?: BomOperation[];
    },
    now: Date,
  ): Bom {
    const next: BomProps = {
      ...this.props,
      no: patch.no !== undefined ? patch.no.trim() : this.props.no,
      productMaterialRef:
        patch.productMaterialRef !== undefined
          ? patch.productMaterialRef.trim()
          : this.props.productMaterialRef,
      name: patch.name !== undefined ? patch.name.trim() : this.props.name,
      outputQty: patch.outputQty ?? this.props.outputQty,
      outputUnit: patch.outputUnit !== undefined ? patch.outputUnit : this.props.outputUnit,
      version: patch.version !== undefined ? patch.version : this.props.version,
      status: patch.status ?? this.props.status,
      notes: patch.notes !== undefined ? patch.notes : this.props.notes,
      components: patch.components ?? this.props.components,
      operations: patch.operations ?? this.props.operations,
      updatedAt: now,
    };

    if (next.no.length === 0) {
      throw new InvalidBomError('reçete numarası boş olamaz');
    }
    if (next.productMaterialRef.length === 0) {
      throw new InvalidBomError('mamul (ürün) referansı boş olamaz');
    }
    if (next.name.length === 0) {
      throw new InvalidBomError('ad boş olamaz');
    }
    if (!(next.outputQty > 0)) {
      throw new InvalidBomError('çıktı miktarı pozitif olmalı');
    }
    Bom.validateComponents(next.components);
    Bom.validateOperations(next.operations);

    return new Bom(next);
  }

  toJSON(): Readonly<BomProps> {
    return { ...this.props };
  }
}
