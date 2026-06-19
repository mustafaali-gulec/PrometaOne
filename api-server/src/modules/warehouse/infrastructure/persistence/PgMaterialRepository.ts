/**
 * PgMaterialRepository — MaterialRepository PG implementasyonu.
 * Tablo: materials (alt_units + wh_params JSONB kolonlarında taşınır).
 *
 * altUnits ve whParams çocuk koleksiyonları ayrı tablo yerine JSONB olarak
 * saklanır; entity bunları aggregate olarak serialize eder. Tüm sorgular
 * company_id ile multi-tenant izole edilir.
 */
import type { Pool } from 'pg';

import type {
  MaterialRepository,
  NewMaterialInput,
} from '../../application/ports/MaterialRepository.js';
import {
  Material,
  type MaterialAltUnit,
  type MaterialWhParam,
} from '../../domain/entities/Material.js';
import type {
  AbcClass,
  CostMethod,
  MaterialStatus,
  NegativeControl,
  TrackMethod,
} from '../../domain/valueObjects/MaterialEnums.js';

interface MaterialRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  group_id: number | null;
  type: string | null;
  base_unit: string;
  alt_units: MaterialAltUnit[] | null;
  brand: string | null;
  barcode: string | null;
  producer_code: string | null;
  gtip: string | null;
  abc: AbcClass | null;
  track_method: TrackMethod;
  cost_method: CostMethod;
  negative_control: NegativeControl;
  min_stock: string | null;
  max_stock: string | null;
  safety_stock: string | null;
  shelf_life_months: number | null;
  perishable: boolean;
  fragile: boolean;
  kdv_purchase: string | null;
  kdv_sale: string | null;
  tevkifat_code: string | null;
  extra_tax_rate: string | null;
  wh_params: MaterialWhParam[] | null;
  status: MaterialStatus;
  created_at: Date;
  updated_at: Date;
}

const MATERIAL_COLS =
  'id, company_id, code, name, group_id, type, base_unit, alt_units, brand, barcode, ' +
  'producer_code, gtip, abc, track_method, cost_method, negative_control, ' +
  'min_stock, max_stock, safety_stock, shelf_life_months, perishable, fragile, ' +
  'kdv_purchase, kdv_sale, tevkifat_code, extra_tax_rate, wh_params, status, created_at, updated_at';

export class PgMaterialRepository implements MaterialRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewMaterialInput): Promise<Material> {
    const r = await this.pool.query<MaterialRow>(
      `INSERT INTO materials
         (company_id, code, name, group_id, type, base_unit, alt_units, brand, barcode,
          producer_code, gtip, abc, track_method, cost_method, negative_control,
          min_stock, max_stock, safety_stock, shelf_life_months, perishable, fragile,
          kdv_purchase, kdv_sale, tevkifat_code, extra_tax_rate, wh_params, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9,
               $10, $11, $12, $13, $14, $15,
               $16, $17, $18, $19, $20, $21,
               $22, $23, $24, $25, $26::jsonb, $27)
       RETURNING ${MATERIAL_COLS}`,
      [
        input.companyId,
        input.code,
        input.name,
        input.groupId,
        input.type,
        input.baseUnit,
        JSON.stringify(input.altUnits),
        input.brand,
        input.barcode,
        input.producerCode,
        input.gtip,
        input.abc,
        input.trackMethod,
        input.costMethod,
        input.negativeControl,
        input.minStock,
        input.maxStock,
        input.safetyStock,
        input.shelfLifeMonths,
        input.perishable,
        input.fragile,
        input.kdvPurchase,
        input.kdvSale,
        input.tevkifatCode,
        input.extraTaxRate,
        JSON.stringify(input.whParams),
        input.status,
      ],
    );
    return rowToMaterial(r.rows[0]!);
  }

  async update(material: Material): Promise<void> {
    await this.pool.query(
      `UPDATE materials
          SET code = $1, name = $2, group_id = $3, type = $4, base_unit = $5,
              alt_units = $6::jsonb, brand = $7, barcode = $8, producer_code = $9,
              gtip = $10, abc = $11, track_method = $12, cost_method = $13,
              negative_control = $14, min_stock = $15, max_stock = $16,
              safety_stock = $17, shelf_life_months = $18, perishable = $19,
              fragile = $20, kdv_purchase = $21, kdv_sale = $22, tevkifat_code = $23,
              extra_tax_rate = $24, wh_params = $25::jsonb, status = $26,
              updated_at = NOW()
        WHERE id = $27 AND company_id = $28`,
      [
        material.code,
        material.name,
        material.groupId,
        material.type,
        material.baseUnit,
        JSON.stringify(material.altUnits),
        material.brand,
        material.barcode,
        material.producerCode,
        material.gtip,
        material.abc,
        material.trackMethod,
        material.costMethod,
        material.negativeControl,
        material.minStock,
        material.maxStock,
        material.safetyStock,
        material.shelfLifeMonths,
        material.perishable,
        material.fragile,
        material.kdvPurchase,
        material.kdvSale,
        material.tevkifatCode,
        material.extraTaxRate,
        JSON.stringify(material.whParams),
        material.status,
        material.id,
        material.companyId,
      ],
    );
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.pool.query('DELETE FROM materials WHERE id = $1 AND company_id = $2', [
      id,
      companyId,
    ]);
  }

  async findById(id: number, companyId: number): Promise<Material | null> {
    const r = await this.pool.query<MaterialRow>(
      `SELECT ${MATERIAL_COLS} FROM materials WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToMaterial(row) : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM materials
        WHERE company_id = $1 AND lower(code) = lower($2)`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.pool.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }

  async listByCompany(
    companyId: number,
    options?: { status?: MaterialStatus; groupId?: number; search?: string },
  ): Promise<ReadonlyArray<Material>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options?.groupId !== undefined) {
      params.push(options.groupId);
      conditions.push(`group_id = $${params.length}`);
    }
    if (options?.search !== undefined && options.search.trim().length > 0) {
      params.push(`%${options.search.trim()}%`);
      conditions.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const r = await this.pool.query<MaterialRow>(
      `SELECT ${MATERIAL_COLS} FROM materials
        WHERE ${conditions.join(' AND ')}
        ORDER BY code ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToMaterial);
  }
}

/** NUMERIC → number | null (pg NUMERIC'i string döndürür). */
function num(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function rowToMaterial(row: MaterialRow): Material {
  return Material.create({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    groupId: row.group_id,
    type: row.type,
    baseUnit: row.base_unit,
    altUnits: (row.alt_units ?? []).map((u) => ({
      unit: u.unit,
      factor: Number(u.factor),
      barcode: u.barcode ?? null,
    })),
    brand: row.brand,
    barcode: row.barcode,
    producerCode: row.producer_code,
    gtip: row.gtip,
    abc: row.abc,
    trackMethod: row.track_method,
    costMethod: row.cost_method,
    negativeControl: row.negative_control,
    minStock: num(row.min_stock),
    maxStock: num(row.max_stock),
    safetyStock: num(row.safety_stock),
    shelfLifeMonths: row.shelf_life_months,
    perishable: row.perishable,
    fragile: row.fragile,
    kdvPurchase: num(row.kdv_purchase),
    kdvSale: num(row.kdv_sale),
    tevkifatCode: row.tevkifat_code,
    extraTaxRate: num(row.extra_tax_rate),
    whParams: (row.wh_params ?? []).map((p) => ({
      warehouseId: p.warehouseId,
      minStock: p.minStock ?? null,
      maxStock: p.maxStock ?? null,
      safetyStock: p.safetyStock ?? null,
      locationId: p.locationId ?? null,
    })),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
