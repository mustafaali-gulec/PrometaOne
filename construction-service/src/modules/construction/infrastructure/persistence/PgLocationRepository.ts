/**
 * PgLocationRepository — LocationRepository PG implementasyonu.
 * Tablo: cs_locations (005_locations.sql).
 *
 * `path` / `depth` DB trigger'ının yazdığı türetilmiş alanlardır: INSERT/UPDATE
 * cümlelerinde HİÇ geçmezler, RETURNING ile geri okunurlar.
 *
 * bulkGenerate çok statement'lı olduğu için Pool alır ve kendi transaction'ını
 * yönetir (modüldeki header+detay repo'larıyla aynı kalıp).
 */
import type { Pool } from 'pg';

import type {
  BulkGenerateInput,
  ListLocationsOptions,
  LocationRepository,
  LocationUsage,
  NewLocationInput,
} from '../../application/ports/LocationRepository.js';
import { Location } from '../../domain/entities/Location.js';
import type { LocationKind } from '../../domain/valueObjects/LocationKind.js';

interface LocationRow {
  id: number;
  company_id: number;
  project_id: number;
  parent_id: number | null;
  kind: LocationKind;
  code: string;
  name: string;
  sort_order: number;
  path: string;
  depth: number;
  unit_type: string | null;
  gross_area: string | null;
  net_area: string | null;
  land_share: string | null;
  facade: string | null;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, project_id, parent_id, kind, code, name, sort_order, path, depth, ' +
  'unit_type, gross_area, net_area, land_share, facade, active, created_by, created_at, updated_at';

function num(v: string | null): number | null {
  return v === null ? null : Number(v);
}

function rowToLocation(r: LocationRow): Location {
  return Location.create({
    id: r.id,
    companyId: r.company_id,
    projectId: r.project_id,
    parentId: r.parent_id,
    kind: r.kind,
    code: r.code,
    name: r.name,
    sortOrder: r.sort_order,
    path: r.path,
    depth: r.depth,
    unitType: r.unit_type,
    grossArea: num(r.gross_area),
    netArea: num(r.net_area),
    landShare: num(r.land_share),
    facade: r.facade,
    active: r.active,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

/** '{code}' yer tutucusunu kodla değiştirir. */
function applyTemplate(template: string, code: string): string {
  return template.includes('{code}') ? template.replaceAll('{code}', code) : `${template}${code}`;
}

export class PgLocationRepository implements LocationRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewLocationInput): Promise<Location> {
    const r = await this.pool.query<LocationRow>(
      `INSERT INTO cs_locations
         (company_id, project_id, parent_id, kind, code, name, sort_order,
          unit_type, gross_area, net_area, land_share, facade, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.projectId,
        input.parentId,
        input.kind,
        input.code,
        input.name,
        input.sortOrder,
        input.unitType,
        input.grossArea,
        input.netArea,
        input.landShare,
        input.facade,
        input.createdBy,
      ],
    );
    return rowToLocation(r.rows[0]!);
  }

  async update(location: Location): Promise<void> {
    const j = location.toJSON();
    await this.pool.query(
      `UPDATE cs_locations
          SET code = $1, name = $2, sort_order = $3, unit_type = $4, gross_area = $5,
              net_area = $6, land_share = $7, facade = $8, active = $9, updated_at = NOW()
        WHERE id = $10 AND company_id = $11`,
      [
        j.code,
        j.name,
        j.sortOrder,
        j.unitType,
        j.grossArea,
        j.netArea,
        j.landShare,
        j.facade,
        j.active,
        j.id,
        j.companyId,
      ],
    );
  }

  async moveTo(id: number, companyId: number, newParentId: number | null): Promise<void> {
    await this.pool.query(
      `UPDATE cs_locations SET parent_id = $1, updated_at = NOW()
        WHERE id = $2 AND company_id = $3`,
      [newParentId, id, companyId],
    );
  }

  async findById(id: number, companyId: number): Promise<Location | null> {
    const r = await this.pool.query<LocationRow>(
      `SELECT ${COLS} FROM cs_locations WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToLocation(row) : null;
  }

  async listByProject(
    projectId: number,
    companyId: number,
    options: ListLocationsOptions = {},
  ): Promise<ReadonlyArray<Location>> {
    const where: string[] = ['project_id = $1', 'company_id = $2'];
    const params: unknown[] = [projectId, companyId];

    if (options.includeInactive !== true) where.push('active = TRUE');
    if (options.kind !== undefined) {
      params.push(options.kind);
      where.push(`kind = $${params.length}`);
    }
    if (options.search !== undefined && options.search.trim() !== '') {
      params.push(`%${options.search.trim()}%`);
      where.push(
        `(name ILIKE $${params.length} OR code ILIKE $${params.length} OR path ILIKE $${params.length})`,
      );
    }
    if (options.subtreeOf !== undefined) {
      // Alt ağaç: recursive CTE ile id kümesi. Materialized path'e LIKE atmak
      // ad içinde ' > ' geçen lokasyonlarda yanlış eşleşir; id zinciri kesin.
      params.push(options.subtreeOf);
      where.push(`id IN (
        WITH RECURSIVE sub AS (
          SELECT id FROM cs_locations WHERE id = $${params.length}
          UNION ALL
          SELECT l.id FROM cs_locations l JOIN sub ON l.parent_id = sub.id
        ) SELECT id FROM sub
      )`);
    }

    const r = await this.pool.query<LocationRow>(
      `SELECT ${COLS} FROM cs_locations
        WHERE ${where.join(' AND ')}
        ORDER BY depth, sort_order, code`,
      params,
    );
    return r.rows.map(rowToLocation);
  }

  async existsByCode(
    companyId: number,
    projectId: number,
    parentId: number | null,
    code: string,
    excludeId?: number,
  ): Promise<boolean> {
    // parent_id NULL karşılaştırması: `= NULL` hiçbir zaman true olmaz, bu yüzden
    // IS NULL dalı ayrı yazılır — yoksa kök seviyede kod çakışması yakalanmaz.
    const parentClause = parentId === null ? 'parent_id IS NULL' : 'parent_id = $4';
    const params: unknown[] = [companyId, projectId, code];
    if (parentId !== null) params.push(parentId);
    let sql = `SELECT 1 FROM cs_locations
                WHERE company_id = $1 AND project_id = $2 AND code = $3 AND ${parentClause}`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    const r = await this.pool.query(`${sql} LIMIT 1`, params);
    return r.rowCount !== null && r.rowCount > 0;
  }

  async usage(id: number, companyId: number): Promise<LocationUsage> {
    // Her alt sorgu company_id ile de kısıtlanır. Yalnız location_id'ye bakmak
    // teknik olarak yeterli görünür (lokasyon zaten tek şirkete ait) ama sayımı
    // çağıranın tenant'ıyla hizalamak, ileride tablolar arası bir veri kayması
    // olursa yanlış "bağlı kayıt yok" kararı verilmesini engeller.
    const r = await this.pool.query<Record<string, string>>(
      `SELECT
         (SELECT count(*) FROM cs_locations          WHERE parent_id   = $1 AND company_id = $2) AS children,
         (SELECT count(*) FROM cs_boq_lines          WHERE location_id = $1 AND company_id = $2) AS boq_lines,
         (SELECT count(*) FROM cs_expenses           WHERE location_id = $1 AND company_id = $2) AS expenses,
         (SELECT count(*) FROM cs_timesheets         WHERE location_id = $1 AND company_id = $2) AS timesheets,
         (SELECT count(*) FROM cs_machine_logs       WHERE location_id = $1 AND company_id = $2) AS machine_logs,
         (SELECT count(*) FROM cs_stock_movements    WHERE location_id = $1 AND company_id = $2) AS stock_movements,
         (SELECT count(*) FROM cs_measurement_book   WHERE location_id = $1 AND company_id = $2) AS measurements,
         (SELECT count(*) FROM cs_material_requests  WHERE location_id = $1 AND company_id = $2) AS material_requests,
         (SELECT count(*) FROM cs_attachments        WHERE location_id = $1 AND company_id = $2) AS attachments,
         (SELECT count(*) FROM cs_tracking_locations WHERE location_id = $1 AND company_id = $2) AS tracking_locations`,
      [id, companyId],
    );
    const row = r.rows[0]!;
    return {
      children: Number(row.children),
      boqLines: Number(row.boq_lines),
      expenses: Number(row.expenses),
      timesheets: Number(row.timesheets),
      machineLogs: Number(row.machine_logs),
      stockMovements: Number(row.stock_movements),
      measurements: Number(row.measurements),
      materialRequests: Number(row.material_requests),
      attachments: Number(row.attachments),
      trackingLocations: Number(row.tracking_locations),
    };
  }

  async hardDelete(id: number, companyId: number): Promise<void> {
    await this.pool.query(`DELETE FROM cs_locations WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
  }

  async bulkGenerate(input: BulkGenerateInput): Promise<ReadonlyArray<Location>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const created: Location[] = [];

      /** Var olanı bulur, yoksa oluşturur — sihirbaz tekrar koşturulunca kopya üretmez. */
      const ensure = async (
        parentId: number | null,
        kind: LocationKind,
        code: string,
        name: string,
        sortOrder: number,
        unitType: string | null,
      ): Promise<number> => {
        const parentClause = parentId === null ? 'parent_id IS NULL' : 'parent_id = $4';
        const findParams: unknown[] = [input.companyId, input.projectId, code];
        if (parentId !== null) findParams.push(parentId);
        const found = await client.query<{ id: number }>(
          `SELECT id FROM cs_locations
            WHERE company_id = $1 AND project_id = $2 AND code = $3 AND ${parentClause} LIMIT 1`,
          findParams,
        );
        const existing = found.rows[0];
        if (existing) return existing.id;

        const ins = await client.query<LocationRow>(
          `INSERT INTO cs_locations
             (company_id, project_id, parent_id, kind, code, name, sort_order, unit_type, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING ${COLS}`,
          [
            input.companyId,
            input.projectId,
            parentId,
            kind,
            code,
            name,
            sortOrder,
            unitType,
            input.createdBy,
          ],
        );
        const row = ins.rows[0]!;
        created.push(rowToLocation(row));
        return row.id;
      };

      let blockIdx = 0;
      for (const blockCode of input.blocks) {
        const blockId = await ensure(
          input.parentId,
          'block',
          blockCode,
          applyTemplate(input.blockNameTemplate, blockCode),
          blockIdx++,
          null,
        );

        if (input.floors.length === 0) continue;

        // 'sequential' numaralandırmada daire no blok içinde katlar boyunca artar
        let unitSeq = 1;
        let floorIdx = 0;
        for (const floorCode of input.floors) {
          const floorId = await ensure(
            blockId,
            'floor',
            floorCode,
            applyTemplate(input.floorNameTemplate, floorCode),
            floorIdx++,
            null,
          );

          for (let u = 1; u <= input.unitsPerFloor; u++) {
            const unitCode = String(input.unitNumbering === 'sequential' ? unitSeq++ : u);
            await ensure(
              floorId,
              'unit',
              unitCode,
              applyTemplate(input.unitNameTemplate, unitCode),
              u,
              input.defaultUnitType,
            );
          }
        }
      }

      await client.query('COMMIT');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
