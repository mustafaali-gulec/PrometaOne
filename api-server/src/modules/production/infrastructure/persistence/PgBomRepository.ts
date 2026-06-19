/**
 * PgBomRepository — BomRepository PG implementasyonu.
 * Tablolar: production_boms + production_bom_components + production_bom_operations.
 *
 * Aggregate yazımı: başlık + bileşenler + operasyonlar tek transaction'da
 * yazılır (insert/update). Update'te child satırlar tamamen silinip yeniden
 * yazılır (replace) — basit ve tutarlı.
 */
import type { Pool } from 'pg';

import type { BomRepository, NewBomInput } from '../../application/ports/BomRepository.js';
import { Bom, type BomComponent, type BomOperation } from '../../domain/entities/Bom.js';
import type { BomStatus } from '../../domain/valueObjects/BomStatus.js';

import type { Queryable } from './Queryable.js';

interface BomRow {
  id: number;
  company_id: number;
  no: string;
  product_material_ref: string;
  name: string;
  output_qty: string;
  output_unit: string | null;
  version: string | null;
  status: BomStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface BomComponentRow {
  id: number;
  bom_id: number;
  material_ref: string;
  qty: string;
  unit: string | null;
  scrap_pct: string;
  is_semi: boolean;
  sort_order: number;
}

interface BomOperationRow {
  id: number;
  bom_id: number;
  work_center_id: number | null;
  name: string;
  setup_min: string;
  run_min_per_unit: string;
  seq: number;
}

const BOM_COLS =
  'id, company_id, no, product_material_ref, name, output_qty, output_unit, version, status, notes, created_at, updated_at';

export class PgBomRepository implements BomRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewBomInput): Promise<Bom> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const head = await client.query<BomRow>(
        `INSERT INTO production_boms
           (company_id, no, product_material_ref, name, output_qty, output_unit, version, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${BOM_COLS}`,
        [
          input.companyId,
          input.no,
          input.productMaterialRef,
          input.name,
          input.outputQty,
          input.outputUnit,
          input.version,
          input.status,
          input.notes,
        ],
      );
      const bomId = head.rows[0]!.id;
      await insertComponents(client, bomId, input.components);
      await insertOperations(client, bomId, input.operations);
      await client.query('COMMIT');

      return await this.loadById(bomId, input.companyId);
    } catch (err) {
      await safeRollback(client);
      throw err;
    } finally {
      client.release();
    }
  }

  async update(bom: Bom): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE production_boms
            SET no = $1, product_material_ref = $2, name = $3, output_qty = $4,
                output_unit = $5, version = $6, status = $7, notes = $8, updated_at = NOW()
          WHERE id = $9 AND company_id = $10`,
        [
          bom.no,
          bom.productMaterialRef,
          bom.name,
          bom.outputQty,
          bom.outputUnit,
          bom.version,
          bom.status,
          bom.notes,
          bom.id,
          bom.companyId,
        ],
      );
      // Child satırları tamamen yeniden yaz (replace).
      await client.query('DELETE FROM production_bom_components WHERE bom_id = $1', [bom.id]);
      await client.query('DELETE FROM production_bom_operations WHERE bom_id = $1', [bom.id]);
      await insertComponents(client, bom.id, bom.components);
      await insertOperations(client, bom.id, bom.operations);
      await client.query('COMMIT');
    } catch (err) {
      await safeRollback(client);
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: number, companyId: number): Promise<Bom | null> {
    const head = await this.pool.query<BomRow>(
      `SELECT ${BOM_COLS} FROM production_boms WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    if (!head.rows[0]) {
      return null;
    }
    return this.loadById(id, companyId);
  }

  async findByProductRef(productMaterialRef: string, companyId: number): Promise<Bom | null> {
    const head = await this.pool.query<BomRow>(
      `SELECT ${BOM_COLS} FROM production_boms
        WHERE company_id = $1 AND product_material_ref = $2
          AND status IN ('active', 'draft')
        ORDER BY (status = 'active') DESC, id DESC
        LIMIT 1`,
      [companyId, productMaterialRef],
    );
    const row = head.rows[0];
    if (!row) {
      return null;
    }
    return this.loadById(row.id, companyId);
  }

  async listByCompany(
    companyId: number,
    options?: { status?: BomStatus; search?: string },
  ): Promise<ReadonlyArray<Bom>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options?.search !== undefined && options.search.trim().length > 0) {
      params.push(`%${options.search.trim()}%`);
      conditions.push(`(no ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const heads = await this.pool.query<BomRow>(
      `SELECT ${BOM_COLS} FROM production_boms
        WHERE ${conditions.join(' AND ')}
        ORDER BY no ASC, id ASC`,
      params,
    );
    if (heads.rows.length === 0) {
      return [];
    }
    const ids = heads.rows.map((h) => h.id);
    const { compsByBom, opsByBom } = await this.loadChildren(ids);
    return heads.rows.map((h) => rowToBom(h, compsByBom.get(h.id) ?? [], opsByBom.get(h.id) ?? []));
  }

  async listAllForExplosion(companyId: number): Promise<ReadonlyArray<Bom>> {
    // Patlatma/maliyet için aktif + draft reçeteler yeterli.
    return this.listByCompany(companyId).then((all) =>
      all.filter((b) => b.status === 'active' || b.status === 'draft'),
    );
  }

  async delete(id: number, companyId: number): Promise<void> {
    // Child satırlar FK ON DELETE CASCADE ile silinir.
    await this.pool.query('DELETE FROM production_boms WHERE id = $1 AND company_id = $2', [
      id,
      companyId,
    ]);
  }

  async existsByNo(companyId: number, no: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, no];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM production_boms
        WHERE company_id = $1 AND LOWER(no) = LOWER($2)`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.pool.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }

  // --- yardımcılar ---------------------------------------------------------

  private async loadById(id: number, companyId: number): Promise<Bom> {
    const head = await this.pool.query<BomRow>(
      `SELECT ${BOM_COLS} FROM production_boms WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = head.rows[0]!;
    const { compsByBom, opsByBom } = await this.loadChildren([id]);
    return rowToBom(row, compsByBom.get(id) ?? [], opsByBom.get(id) ?? []);
  }

  private async loadChildren(bomIds: number[]): Promise<{
    compsByBom: Map<number, BomComponent[]>;
    opsByBom: Map<number, BomOperation[]>;
  }> {
    const comps = await this.pool.query<BomComponentRow>(
      `SELECT id, bom_id, material_ref, qty, unit, scrap_pct, is_semi, sort_order
         FROM production_bom_components
        WHERE bom_id = ANY($1::int[])
        ORDER BY sort_order ASC, id ASC`,
      [bomIds],
    );
    const ops = await this.pool.query<BomOperationRow>(
      `SELECT id, bom_id, work_center_id, name, setup_min, run_min_per_unit, seq
         FROM production_bom_operations
        WHERE bom_id = ANY($1::int[])
        ORDER BY seq ASC, id ASC`,
      [bomIds],
    );

    const compsByBom = new Map<number, BomComponent[]>();
    for (const c of comps.rows) {
      const list = compsByBom.get(c.bom_id) ?? [];
      list.push({
        id: c.id,
        materialRef: c.material_ref,
        qty: Number(c.qty),
        unit: c.unit,
        scrapPct: Number(c.scrap_pct),
        isSemi: c.is_semi,
        sortOrder: c.sort_order,
      });
      compsByBom.set(c.bom_id, list);
    }

    const opsByBom = new Map<number, BomOperation[]>();
    for (const o of ops.rows) {
      const list = opsByBom.get(o.bom_id) ?? [];
      list.push({
        id: o.id,
        workCenterId: o.work_center_id,
        name: o.name,
        setupMin: Number(o.setup_min),
        runMinPerUnit: Number(o.run_min_per_unit),
        seq: o.seq,
      });
      opsByBom.set(o.bom_id, list);
    }

    return { compsByBom, opsByBom };
  }
}

async function insertComponents(
  db: Queryable,
  bomId: number,
  components: ReadonlyArray<Omit<BomComponent, 'id'> | BomComponent>,
): Promise<void> {
  for (const c of components) {
    await db.query(
      `INSERT INTO production_bom_components
         (bom_id, material_ref, qty, unit, scrap_pct, is_semi, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [bomId, c.materialRef, c.qty, c.unit, c.scrapPct, c.isSemi, c.sortOrder],
    );
  }
}

async function insertOperations(
  db: Queryable,
  bomId: number,
  operations: ReadonlyArray<Omit<BomOperation, 'id'> | BomOperation>,
): Promise<void> {
  for (const o of operations) {
    await db.query(
      `INSERT INTO production_bom_operations
         (bom_id, work_center_id, name, setup_min, run_min_per_unit, seq)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bomId, o.workCenterId, o.name, o.setupMin, o.runMinPerUnit, o.seq],
    );
  }
}

async function safeRollback(client: { query: (q: string) => Promise<unknown> }): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // ROLLBACK hatası orijinal hatayı gölgelememeli
  }
}

function rowToBom(row: BomRow, components: BomComponent[], operations: BomOperation[]): Bom {
  return Bom.create({
    id: row.id,
    companyId: row.company_id,
    no: row.no,
    productMaterialRef: row.product_material_ref,
    name: row.name,
    outputQty: Number(row.output_qty),
    outputUnit: row.output_unit,
    version: row.version,
    status: row.status,
    notes: row.notes,
    components,
    operations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
