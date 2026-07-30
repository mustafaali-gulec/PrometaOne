/**
 * Fiziksel ilerleme takibi PG repository'leri (FAZ 2).
 * Tablolar/view'lar: 006_physical_progress.sql
 *
 * Şablon gövdesi ve takip materyalizasyonu çok statement'lı olduğu için her iki
 * repo da Pool alıp kendi transaction'ını yönetir.
 *
 * Rollup hesapları SQL view'larından okunur (cs_v_*): yüzdeyi tek yerde tutmak,
 * ekran ile raporun ayrışmasını engeller.
 */
import type { Pool } from 'pg';

import type {
  ListTemplatesOptions,
  ListTrackingsOptions,
  NewTemplateInput,
  NewTrackingInput,
  ProgressTemplateRepository,
  ProjectPhysicalProgress,
  SetItemStateInput,
  TemplateBodyInput,
  TrackingItemHistoryRow,
  TrackingItemRow,
  TrackingLocationProgress,
  TrackingProgress,
  TrackingRepository,
} from '../../application/ports/TrackingRepositories.js';
import {
  ProgressTemplate,
  type TemplateGroupProps,
} from '../../domain/entities/ProgressTemplate.js';
import { Tracking, type TrackingLocationProps } from '../../domain/entities/Tracking.js';
import type { ItemState } from '../../domain/valueObjects/ItemState.js';
import type { TrackScope, TrackingStatus } from '../../domain/valueObjects/TrackingStatus.js';

// ===== ŞABLON ===============================================================

interface TemplateRow {
  id: string;
  company_id: number;
  code: string;
  name: string;
  scope: TrackScope;
  description: string | null;
  pct_in_progress: string;
  pct_has_defects: string;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

interface GroupRow {
  id: string;
  company_id: number;
  template_id: string;
  code: string;
  name: string;
  weight_pct: string;
  sort_order: number;
}

interface ItemRow {
  id: string;
  company_id: number;
  group_id: string;
  code: string;
  name: string;
  weight_pct: string;
  sort_order: number;
  poz_id: string | null;
}

const TPL_COLS =
  'id, company_id, code, name, scope, description, pct_in_progress, pct_has_defects, ' +
  'active, created_by, created_at, updated_at';

export class PgProgressTemplateRepository implements ProgressTemplateRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewTemplateInput): Promise<ProgressTemplate> {
    const r = await this.pool.query<TemplateRow>(
      `INSERT INTO cs_progress_templates
         (company_id, code, name, scope, description, pct_in_progress, pct_has_defects, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${TPL_COLS}`,
      [
        input.companyId,
        input.code,
        input.name,
        input.scope,
        input.description,
        input.pctInProgress,
        input.pctHasDefects,
        input.createdBy,
      ],
    );
    return this.hydrate(r.rows[0]!, new Map());
  }

  async update(template: ProgressTemplate): Promise<void> {
    const j = template.toJSON();
    await this.pool.query(
      `UPDATE cs_progress_templates
          SET name = $1, scope = $2, description = $3, pct_in_progress = $4,
              pct_has_defects = $5, active = $6, updated_at = NOW()
        WHERE id = $7 AND company_id = $8`,
      [
        j.name,
        j.scope,
        j.description,
        j.pctInProgress,
        j.pctHasDefects,
        j.active,
        j.id,
        j.companyId,
      ],
    );
  }

  /**
   * Gövdeyi tamamen değiştirir. Grup/iş satırları silinip yeniden yazılır; bu
   * yüzden cs_tracking_items'taki FK ON DELETE CASCADE var olan takiplerin
   * durum satırlarını da siler. Bunu kabul ediyoruz çünkü şablonu değiştirmek
   * "ölçüm cetvelini değiştirmek"tir — eski cetvele göre girilmiş tikler yeni
   * cetvelde anlam taşımaz. Arayüz kaç takibin etkileneceğini önceden söyler
   * (SaveTemplateBodyUseCase.affectedTrackings).
   */
  async replaceBody(templateId: number, companyId: number, body: TemplateBodyInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM cs_progress_template_groups WHERE template_id = $1 AND company_id = $2`,
        [templateId, companyId],
      );
      for (const g of body.groups) {
        const gr = await client.query<{ id: string }>(
          `INSERT INTO cs_progress_template_groups
             (company_id, template_id, code, name, weight_pct, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [companyId, templateId, g.code, g.name, g.weightPct, g.sortOrder],
        );
        const groupId = Number(gr.rows[0]!.id);
        for (const i of g.items) {
          await client.query(
            `INSERT INTO cs_progress_template_items
               (company_id, group_id, code, name, weight_pct, sort_order, poz_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [companyId, groupId, i.code, i.name, i.weightPct, i.sortOrder, i.pozId],
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: number, companyId: number): Promise<ProgressTemplate | null> {
    const t = await this.pool.query<TemplateRow>(
      `SELECT ${TPL_COLS} FROM cs_progress_templates WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    const row = t.rows[0];
    if (!row) return null;
    return this.hydrate(row, await this.loadGroups([id], companyId));
  }

  async listByCompany(
    companyId: number,
    options: ListTemplatesOptions = {},
  ): Promise<ReadonlyArray<ProgressTemplate>> {
    const where: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options.includeInactive !== true) where.push('active = TRUE');
    if (options.scope !== undefined) {
      params.push(options.scope);
      where.push(`scope = $${params.length}`);
    }
    if (options.search !== undefined && options.search.trim() !== '') {
      params.push(`%${options.search.trim()}%`);
      where.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }

    const t = await this.pool.query<TemplateRow>(
      `SELECT ${TPL_COLS} FROM cs_progress_templates
        WHERE ${where.join(' AND ')} ORDER BY code`,
      params,
    );
    if (t.rows.length === 0) return [];

    const groups = await this.loadGroups(
      t.rows.map((r) => Number(r.id)),
      companyId,
    );
    return t.rows.map((r) => this.hydrate(r, groups));
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT 1 FROM cs_progress_templates WHERE company_id = $1 AND code = $2`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    const r = await this.pool.query(`${sql} LIMIT 1`, params);
    return r.rowCount !== null && r.rowCount > 0;
  }

  async usageCount(id: number, companyId: number): Promise<number> {
    const r = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM cs_trackings
        WHERE template_id = $1 AND company_id = $2 AND status <> 'cancelled'`,
      [id, companyId],
    );
    return Number(r.rows[0]!.n);
  }

  /** Birden çok şablonun grup+iş satırlarını tek turda çeker (N+1 önlemi). */
  private async loadGroups(
    templateIds: ReadonlyArray<number>,
    companyId: number,
  ): Promise<Map<number, TemplateGroupProps[]>> {
    const out = new Map<number, TemplateGroupProps[]>();
    if (templateIds.length === 0) return out;

    const g = await this.pool.query<GroupRow>(
      `SELECT id, company_id, template_id, code, name, weight_pct, sort_order
         FROM cs_progress_template_groups
        WHERE template_id = ANY($1::bigint[]) AND company_id = $2
        ORDER BY sort_order, code`,
      [templateIds as number[], companyId],
    );
    if (g.rows.length === 0) return out;

    const i = await this.pool.query<ItemRow>(
      `SELECT id, company_id, group_id, code, name, weight_pct, sort_order, poz_id
         FROM cs_progress_template_items
        WHERE group_id = ANY($1::bigint[]) AND company_id = $2
        ORDER BY sort_order, code`,
      [g.rows.map((r) => r.id), companyId],
    );

    // Anahtar string: group_id satırda BIGINT olduğu için string gelir ve
    // arama tarafı da (gr.id) aynı temsili kullanır — çevirme yapmadan eşleşir.
    const itemsByGroup = new Map<string, ItemRow[]>();
    for (const it of i.rows) {
      const arr = itemsByGroup.get(it.group_id);
      if (arr) arr.push(it);
      else itemsByGroup.set(it.group_id, [it]);
    }

    for (const gr of g.rows) {
      const props: TemplateGroupProps = {
        id: Number(gr.id),
        companyId: Number(gr.company_id),
        templateId: Number(gr.template_id),
        code: gr.code,
        name: gr.name,
        weightPct: Number(gr.weight_pct),
        sortOrder: gr.sort_order,
        items: (itemsByGroup.get(gr.id) ?? []).map((it) => ({
          id: Number(it.id),
          companyId: Number(it.company_id),
          groupId: Number(it.group_id),
          code: it.code,
          name: it.name,
          weightPct: Number(it.weight_pct),
          sortOrder: it.sort_order,
          pozId: it.poz_id === null ? null : Number(it.poz_id),
        })),
      };
      const arr = out.get(Number(gr.template_id));
      if (arr) arr.push(props);
      else out.set(Number(gr.template_id), [props]);
    }
    return out;
  }

  private hydrate(
    r: TemplateRow,
    groups: ReadonlyMap<number, TemplateGroupProps[]>,
  ): ProgressTemplate {
    const g = groups.get(Number(r.id)) ?? [];
    return ProgressTemplate.create({
      id: Number(r.id),
      companyId: Number(r.company_id),
      code: r.code,
      name: r.name,
      scope: r.scope,
      description: r.description,
      pctInProgress: Number(r.pct_in_progress),
      pctHasDefects: Number(r.pct_has_defects),
      active: r.active,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      groups: g,
    });
  }
}

// ===== TAKİP ================================================================

interface TrackingRow {
  id: string;
  company_id: number;
  project_id: string;
  template_id: string;
  code: string;
  name: string;
  project_weight_pct: string;
  planned_start: string | null;
  planned_end: string | null;
  status: TrackingStatus;
  assigned_user_id: number | null;
  visible_all: boolean;
  note: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const TRK_COLS =
  'id, company_id, project_id, template_id, code, name, project_weight_pct, ' +
  'planned_start::text AS planned_start, planned_end::text AS planned_end, status, ' +
  'assigned_user_id, visible_all, note, created_by, created_at, updated_at';

function rowToTracking(r: TrackingRow): Tracking {
  return Tracking.create({
    id: Number(r.id),
    companyId: Number(r.company_id),
    projectId: Number(r.project_id),
    templateId: Number(r.template_id),
    code: r.code,
    name: r.name,
    projectWeightPct: Number(r.project_weight_pct),
    plannedStart: r.planned_start,
    plannedEnd: r.planned_end,
    status: r.status,
    assignedUserId: r.assigned_user_id,
    visibleAll: r.visible_all,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

interface ItemQueryRow {
  id: string;
  tracking_id: string;
  tracking_location_id: string;
  location_id: string;
  location_path: string;
  template_item_id: string;
  group_id: string;
  group_name: string;
  group_weight: string;
  item_name: string;
  item_weight: string;
  state: ItemState;
  override_pct: string | null;
  effective_pct: string;
  inspected_by: number | null;
  inspected_at: string | null;
  note: string | null;
  poz_id: string | null;
}

/**
 * Durum satırlarının okuma sorgusu. effective_pct'yi cs_v_tracking_item_pct
 * view'ından alıyoruz — yüzde mantığı tek yerde (view) durur.
 */
const ITEM_SELECT = `
  SELECT ti.id,
         ti.tracking_id,
         ti.tracking_location_id,
         tl.location_id,
         loc.path                AS location_path,
         ti.template_item_id,
         tpi.group_id,
         tpg.name                AS group_name,
         tpg.weight_pct          AS group_weight,
         tpi.name                AS item_name,
         tpi.weight_pct          AS item_weight,
         ti.state,
         ti.override_pct,
         v.effective_pct,
         ti.inspected_by,
         ti.inspected_at::text   AS inspected_at,
         ti.note,
         tpi.poz_id
    FROM cs_tracking_items ti
    JOIN cs_tracking_locations       tl  ON tl.id  = ti.tracking_location_id
    JOIN cs_locations                loc ON loc.id = tl.location_id
    JOIN cs_progress_template_items  tpi ON tpi.id = ti.template_item_id
    JOIN cs_progress_template_groups tpg ON tpg.id = tpi.group_id
    JOIN cs_v_tracking_item_pct      v   ON v.tracking_item_id = ti.id`;

function toItemRow(r: ItemQueryRow): TrackingItemRow {
  return {
    id: Number(r.id),
    trackingId: Number(r.tracking_id),
    trackingLocationId: Number(r.tracking_location_id),
    locationId: Number(r.location_id),
    locationPath: r.location_path,
    templateItemId: Number(r.template_item_id),
    groupId: Number(r.group_id),
    groupName: r.group_name,
    groupWeight: Number(r.group_weight),
    itemName: r.item_name,
    itemWeight: Number(r.item_weight),
    state: r.state,
    overridePct: r.override_pct === null ? null : Number(r.override_pct),
    effectivePct: Number(r.effective_pct),
    inspectedBy: r.inspected_by,
    inspectedAt: r.inspected_at,
    note: r.note,
    pozId: r.poz_id === null ? null : Number(r.poz_id),
  };
}

export class PgTrackingRepository implements TrackingRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewTrackingInput): Promise<Tracking> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const t = await client.query<TrackingRow>(
        `INSERT INTO cs_trackings
           (company_id, project_id, template_id, code, name, project_weight_pct,
            planned_start, planned_end, assigned_user_id, visible_all, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING ${TRK_COLS}`,
        [
          input.companyId,
          input.projectId,
          input.templateId,
          input.code,
          input.name,
          input.projectWeightPct,
          input.plannedStart,
          input.plannedEnd,
          input.assignedUserId,
          input.visibleAll,
          input.note,
          input.createdBy,
        ],
      );
      const trackingId = Number(t.rows[0]!.id);

      for (const loc of input.locations) {
        const tl = await client.query<{ id: string }>(
          `INSERT INTO cs_tracking_locations
             (company_id, tracking_id, location_id, weight_pct, sort_order)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [input.companyId, trackingId, loc.locationId, loc.weightPct, loc.sortOrder],
        );
        await materializeItems(
          client,
          input.companyId,
          trackingId,
          Number(tl.rows[0]!.id),
          input.templateId,
        );
      }

      await client.query('COMMIT');
      return rowToTracking(t.rows[0]!);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(tracking: Tracking): Promise<void> {
    const j = tracking.toJSON();
    await this.pool.query(
      `UPDATE cs_trackings
          SET name = $1, project_weight_pct = $2, planned_start = $3, planned_end = $4,
              status = $5, assigned_user_id = $6, visible_all = $7, note = $8, updated_at = NOW()
        WHERE id = $9 AND company_id = $10`,
      [
        j.name,
        j.projectWeightPct,
        j.plannedStart,
        j.plannedEnd,
        j.status,
        j.assignedUserId,
        j.visibleAll,
        j.note,
        j.id,
        j.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Tracking | null> {
    const r = await this.pool.query<TrackingRow>(
      `SELECT ${TRK_COLS} FROM cs_trackings WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToTracking(row) : null;
  }

  async listByCompany(
    companyId: number,
    options: ListTrackingsOptions = {},
  ): Promise<ReadonlyArray<Tracking>> {
    const where: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options.projectId !== undefined) {
      params.push(options.projectId);
      where.push(`project_id = $${params.length}`);
    }
    if (options.status !== undefined) {
      params.push(options.status);
      where.push(`status = $${params.length}`);
    } else if (options.includeCancelled !== true) {
      where.push(`status <> 'cancelled'`);
    }
    if (options.search !== undefined && options.search.trim() !== '') {
      params.push(`%${options.search.trim()}%`);
      where.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }
    const r = await this.pool.query<TrackingRow>(
      `SELECT ${TRK_COLS} FROM cs_trackings WHERE ${where.join(' AND ')} ORDER BY code DESC`,
      params,
    );
    return r.rows.map(rowToTracking);
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT 1 FROM cs_trackings WHERE company_id = $1 AND code = $2`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    const r = await this.pool.query(`${sql} LIMIT 1`, params);
    return r.rowCount !== null && r.rowCount > 0;
  }

  async listLocations(
    trackingId: number,
    companyId: number,
  ): Promise<ReadonlyArray<TrackingLocationProps>> {
    const r = await this.pool.query<{
      id: string;
      company_id: number;
      tracking_id: string;
      location_id: string;
      weight_pct: string;
      sort_order: number;
      location_path: string;
      location_name: string;
    }>(
      `SELECT tl.id, tl.company_id, tl.tracking_id, tl.location_id, tl.weight_pct, tl.sort_order,
              loc.path AS location_path, loc.name AS location_name
         FROM cs_tracking_locations tl
         JOIN cs_locations loc ON loc.id = tl.location_id
        WHERE tl.tracking_id = $1 AND tl.company_id = $2
        ORDER BY tl.sort_order, loc.code`,
      [trackingId, companyId],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      companyId: Number(row.company_id),
      trackingId: Number(row.tracking_id),
      locationId: Number(row.location_id),
      weightPct: Number(row.weight_pct),
      sortOrder: row.sort_order,
      locationPath: row.location_path,
      locationName: row.location_name,
    }));
  }

  async listItems(trackingId: number, companyId: number): Promise<ReadonlyArray<TrackingItemRow>> {
    const r = await this.pool.query<ItemQueryRow>(
      `${ITEM_SELECT}
        WHERE ti.tracking_id = $1 AND ti.company_id = $2
        ORDER BY tl.sort_order, tpg.sort_order, tpi.sort_order`,
      [trackingId, companyId],
    );
    return r.rows.map(toItemRow);
  }

  async findItem(trackingItemId: number, companyId: number): Promise<TrackingItemRow | null> {
    const r = await this.pool.query<ItemQueryRow>(
      `${ITEM_SELECT} WHERE ti.id = $1 AND ti.company_id = $2`,
      [trackingItemId, companyId],
    );
    const row = r.rows[0];
    return row ? toItemRow(row) : null;
  }

  async setItemState(input: SetItemStateInput): Promise<TrackingItemRow> {
    const rows = await this.setItemStates([input]);
    const row = rows[0];
    if (!row) throw new Error(`cs_tracking_items güncellenemedi: ${input.trackingItemId}`);
    return row;
  }

  async setItemStates(
    inputs: ReadonlyArray<SetItemStateInput>,
  ): Promise<ReadonlyArray<TrackingItemRow>> {
    if (inputs.length === 0) return [];
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const ids: number[] = [];
      for (const input of inputs) {
        // Geçmiş satırı için ESKİ durumu ve efektif yüzdeyi güncellemeden ÖNCE oku
        const before = await client.query<{ state: ItemState; effective_pct: string }>(
          `SELECT ti.state, v.effective_pct
             FROM cs_tracking_items ti
             JOIN cs_v_tracking_item_pct v ON v.tracking_item_id = ti.id
            WHERE ti.id = $1 AND ti.company_id = $2`,
          [input.trackingItemId, input.companyId],
        );
        const prev = before.rows[0];

        await client.query(
          `UPDATE cs_tracking_items
              SET state = $1, override_pct = $2, inspected_by = $3, inspected_at = $4,
                  note = $5, updated_by = $6, updated_at = NOW()
            WHERE id = $7 AND company_id = $8`,
          [
            input.state,
            input.overridePct,
            input.inspectedBy,
            input.inspectedAt,
            input.note,
            input.changedBy,
            input.trackingItemId,
            input.companyId,
          ],
        );

        const after = await client.query<{ effective_pct: string }>(
          `SELECT effective_pct FROM cs_v_tracking_item_pct WHERE tracking_item_id = $1`,
          [input.trackingItemId],
        );

        await client.query(
          `INSERT INTO cs_tracking_item_history
             (company_id, tracking_item_id, from_state, to_state, from_pct, to_pct, changed_by, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            input.companyId,
            input.trackingItemId,
            prev?.state ?? null,
            input.state,
            prev ? Number(prev.effective_pct) : null,
            Number(after.rows[0]?.effective_pct ?? 0),
            input.changedBy,
            input.note,
          ],
        );
        ids.push(input.trackingItemId);
      }
      await client.query('COMMIT');

      const r = await this.pool.query<ItemQueryRow>(
        `${ITEM_SELECT} WHERE ti.id = ANY($1::bigint[])`,
        [ids],
      );
      return r.rows.map(toItemRow);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async itemHistory(
    trackingItemId: number,
    companyId: number,
  ): Promise<ReadonlyArray<TrackingItemHistoryRow>> {
    const r = await this.pool.query<{
      id: string;
      tracking_item_id: string;
      from_state: ItemState | null;
      to_state: ItemState;
      from_pct: string | null;
      to_pct: string;
      changed_by: number | null;
      changed_at: Date;
      note: string | null;
    }>(
      `SELECT id, tracking_item_id, from_state, to_state, from_pct, to_pct,
              changed_by, changed_at, note
         FROM cs_tracking_item_history
        WHERE tracking_item_id = $1 AND company_id = $2
        ORDER BY changed_at DESC, id DESC`,
      [trackingItemId, companyId],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      trackingItemId: Number(row.tracking_item_id),
      fromState: row.from_state,
      toState: row.to_state,
      fromPct: row.from_pct === null ? null : Number(row.from_pct),
      toPct: Number(row.to_pct),
      changedBy: row.changed_by,
      changedAt: row.changed_at.toISOString(),
      note: row.note,
    }));
  }

  async locationProgress(
    trackingId: number,
    companyId: number,
  ): Promise<ReadonlyArray<TrackingLocationProgress>> {
    // LEFT JOIN: henüz durum satırı olmayan (şablonu boş) lokasyon da listede
    // görünmeli — yoksa kullanıcı eklediği bloğu ekranda bulamaz.
    const r = await this.pool.query<{
      tracking_location_id: string;
      location_id: string;
      location_path: string;
      location_name: string;
      weight_pct: string;
      progress_pct: string | null;
      item_count: string | null;
      completed_count: string | null;
      defect_count: string | null;
      in_progress_count: string | null;
    }>(
      `SELECT tl.id                 AS tracking_location_id,
              tl.location_id,
              loc.path              AS location_path,
              loc.name              AS location_name,
              tl.weight_pct,
              lp.progress_pct,
              lp.item_count,
              lp.completed_count,
              lp.defect_count,
              lp.in_progress_count
         FROM cs_tracking_locations tl
         JOIN cs_locations loc ON loc.id = tl.location_id
         LEFT JOIN cs_v_tracking_location_progress lp ON lp.tracking_location_id = tl.id
        WHERE tl.tracking_id = $1 AND tl.company_id = $2
        ORDER BY tl.sort_order, loc.code`,
      [trackingId, companyId],
    );
    return r.rows.map((row) => ({
      trackingLocationId: Number(row.tracking_location_id),
      locationId: Number(row.location_id),
      locationPath: row.location_path,
      locationName: row.location_name,
      weightPct: Number(row.weight_pct),
      progressPct: Number(row.progress_pct ?? 0),
      itemCount: Number(row.item_count ?? 0),
      completedCount: Number(row.completed_count ?? 0),
      defectCount: Number(row.defect_count ?? 0),
      inProgressCount: Number(row.in_progress_count ?? 0),
    }));
  }

  async trackingProgress(trackingId: number, companyId: number): Promise<TrackingProgress | null> {
    const r = await this.pool.query<{
      tracking_id: string;
      project_id: string;
      project_weight_pct: string;
      progress_pct: string;
      location_count: string;
    }>(
      `SELECT tracking_id, project_id, project_weight_pct, progress_pct, location_count
         FROM cs_v_tracking_progress WHERE tracking_id = $1 AND company_id = $2`,
      [trackingId, companyId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      trackingId: Number(row.tracking_id),
      projectId: Number(row.project_id),
      projectWeightPct: Number(row.project_weight_pct),
      progressPct: Number(row.progress_pct),
      locationCount: Number(row.location_count),
    };
  }

  async listTrackingProgress(
    companyId: number,
    filter: { projectId?: number; trackingIds?: ReadonlyArray<number> },
  ): Promise<ReadonlyArray<TrackingProgress>> {
    const where: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (filter.projectId !== undefined) {
      params.push(filter.projectId);
      where.push(`project_id = $${params.length}`);
    }
    if (filter.trackingIds !== undefined) {
      if (filter.trackingIds.length === 0) return [];
      params.push(filter.trackingIds);
      where.push(`tracking_id = ANY($${params.length}::bigint[])`);
    }
    const r = await this.pool.query<{
      tracking_id: string;
      project_id: string;
      project_weight_pct: string;
      progress_pct: string;
      location_count: string;
    }>(
      `SELECT tracking_id, project_id, project_weight_pct, progress_pct, location_count
         FROM cs_v_tracking_progress WHERE ${where.join(' AND ')}`,
      params,
    );
    return r.rows.map((row) => ({
      trackingId: Number(row.tracking_id),
      projectId: Number(row.project_id),
      projectWeightPct: Number(row.project_weight_pct),
      progressPct: Number(row.progress_pct),
      locationCount: Number(row.location_count),
    }));
  }

  async projectProgress(projectId: number, companyId: number): Promise<ProjectPhysicalProgress> {
    const r = await this.pool.query<{
      project_id: string;
      progress_pct: string;
      weight_sum: string;
      tracking_count: string;
    }>(
      `SELECT project_id, progress_pct, weight_sum, tracking_count
         FROM cs_v_project_physical_progress WHERE project_id = $1 AND company_id = $2`,
      [projectId, companyId],
    );
    const row = r.rows[0];
    if (!row) {
      return { projectId, progressPct: 0, weightSum: 0, trackingCount: 0 };
    }
    return {
      projectId: Number(row.project_id),
      progressPct: Number(row.progress_pct),
      weightSum: Number(row.weight_sum),
      trackingCount: Number(row.tracking_count),
    };
  }

  async syncItemsWithTemplate(trackingId: number, companyId: number): Promise<number> {
    // Eksik (lokasyon × iş) kombinasyonlarını tek INSERT..SELECT ile üretir.
    // ON CONFLICT DO NOTHING yerine NOT EXISTS: hangi satırın eklendiğini
    // rowCount ile doğru sayabilmek için.
    const r = await this.pool.query(
      `INSERT INTO cs_tracking_items (company_id, tracking_id, tracking_location_id, template_item_id)
       SELECT $2, t.id, tl.id, tpi.id
         FROM cs_trackings t
         JOIN cs_tracking_locations       tl  ON tl.tracking_id = t.id
         JOIN cs_progress_template_groups tpg ON tpg.template_id = t.template_id
         JOIN cs_progress_template_items  tpi ON tpi.group_id = tpg.id
        WHERE t.id = $1 AND t.company_id = $2
          AND NOT EXISTS (
                SELECT 1 FROM cs_tracking_items ex
                 WHERE ex.tracking_location_id = tl.id AND ex.template_item_id = tpi.id
              )`,
      [trackingId, companyId],
    );
    return r.rowCount ?? 0;
  }

  async addLocations(
    trackingId: number,
    companyId: number,
    locations: ReadonlyArray<{ locationId: number; weightPct: number; sortOrder: number }>,
  ): Promise<ReadonlyArray<TrackingLocationProps>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const t = await client.query<{ template_id: string }>(
        `SELECT template_id FROM cs_trackings WHERE id = $1 AND company_id = $2`,
        [trackingId, companyId],
      );
      const rawTemplateId = t.rows[0]?.template_id;
      if (rawTemplateId === undefined) throw new Error(`cs_trackings bulunamadı: ${trackingId}`);
      const templateId = Number(rawTemplateId);

      for (const loc of locations) {
        const tl = await client.query<{ id: string }>(
          `INSERT INTO cs_tracking_locations
             (company_id, tracking_id, location_id, weight_pct, sort_order)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [companyId, trackingId, loc.locationId, loc.weightPct, loc.sortOrder],
        );
        await materializeItems(client, companyId, trackingId, Number(tl.rows[0]!.id), templateId);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.listLocations(trackingId, companyId);
  }

  async removeLocation(
    trackingId: number,
    companyId: number,
    trackingLocationId: number,
  ): Promise<void> {
    // Durum satırları FK CASCADE ile birlikte gider.
    await this.pool.query(
      `DELETE FROM cs_tracking_locations
        WHERE id = $1 AND tracking_id = $2 AND company_id = $3`,
      [trackingLocationId, trackingId, companyId],
    );
  }
}

/** Şablonun tüm işlerini verilen kapsam lokasyonu için 'not_started' olarak üretir. */
async function materializeItems(
  client: { query: (sql: string, values?: readonly unknown[]) => Promise<unknown> },
  companyId: number,
  trackingId: number,
  trackingLocationId: number,
  templateId: number,
): Promise<void> {
  await client.query(
    `INSERT INTO cs_tracking_items (company_id, tracking_id, tracking_location_id, template_item_id)
     SELECT $1, $2, $3, tpi.id
       FROM cs_progress_template_items  tpi
       JOIN cs_progress_template_groups tpg ON tpg.id = tpi.group_id
      WHERE tpg.template_id = $4
     ON CONFLICT (tracking_location_id, template_item_id) DO NOTHING`,
    [companyId, trackingId, trackingLocationId, templateId],
  );
}
