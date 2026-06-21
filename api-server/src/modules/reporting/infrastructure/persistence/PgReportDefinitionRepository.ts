/**
 * PgReportDefinitionRepository — ReportDefinitionRepository PG implementasyonu.
 * Tablo: report_definitions. JSONB kolonlar (query_spec, params, viz_config,
 * layout_config) ::jsonb cast ile yazılır; okumada pg parse eder.
 * Tüm sorgular company_id ile izole. ANA RW pool kullanır (yürütme değil).
 */
import type { Pool } from 'pg';

import type {
  NewReportDefinition,
  ReportDefinitionRepository,
  UpdateReportDefinitionFields,
} from '../../application/ports/ReportDefinitionRepository.js';
import type { ReportDefinition } from '../../domain/entities/ReportDefinition.js';
import type { ParamDef } from '../../domain/params/ParamBinder.js';
import type { ReportMode, ReportVisibility } from '../../domain/valueObjects/ReportEnums.js';

interface DefRow {
  id: number;
  company_id: number;
  folder_id: number | null;
  name: string;
  description: string | null;
  group_label: string | null;
  mode: ReportMode;
  sql_text: string | null;
  query_spec: unknown;
  params: ParamDef[] | null;
  viz_config: Record<string, unknown> | null;
  layout_config: Record<string, unknown> | null;
  visibility: ReportVisibility;
  owner_user_id: number | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, folder_id, name, description, group_label, mode, sql_text, query_spec, params, viz_config, layout_config, visibility, owner_user_id, created_by, created_at, updated_at';

const jsonbOrNull = (v: unknown): string | null =>
  v === null || v === undefined ? null : JSON.stringify(v);

export class PgReportDefinitionRepository implements ReportDefinitionRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewReportDefinition): Promise<ReportDefinition> {
    const r = await this.pool.query<DefRow>(
      `INSERT INTO report_definitions
         (company_id, folder_id, name, description, group_label, mode, sql_text,
          query_spec, params, viz_config, layout_config, visibility, owner_user_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.folderId,
        input.name,
        input.description,
        input.groupLabel,
        input.mode,
        input.sqlText,
        jsonbOrNull(input.querySpec),
        JSON.stringify(input.params ?? []),
        JSON.stringify(input.vizConfig ?? {}),
        JSON.stringify(input.layoutConfig ?? {}),
        input.visibility,
        input.ownerUserId,
        input.createdBy,
      ],
    );
    return rowToDef(r.rows[0]!);
  }

  async update(
    id: number,
    companyId: number,
    fields: UpdateReportDefinitionFields,
  ): Promise<ReportDefinition | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    const push = (col: string, val: unknown, cast = ''): void => {
      values.push(val);
      sets.push(`${col} = $${values.length}${cast}`);
    };

    if (fields.folderId !== undefined) push('folder_id', fields.folderId);
    if (fields.name !== undefined) push('name', fields.name);
    if (fields.description !== undefined) push('description', fields.description);
    if (fields.groupLabel !== undefined) push('group_label', fields.groupLabel);
    if (fields.mode !== undefined) push('mode', fields.mode);
    if (fields.sqlText !== undefined) push('sql_text', fields.sqlText);
    if (fields.querySpec !== undefined)
      push('query_spec', jsonbOrNull(fields.querySpec), '::jsonb');
    if (fields.params !== undefined) push('params', JSON.stringify(fields.params), '::jsonb');
    if (fields.vizConfig !== undefined)
      push('viz_config', JSON.stringify(fields.vizConfig), '::jsonb');
    if (fields.layoutConfig !== undefined)
      push('layout_config', JSON.stringify(fields.layoutConfig), '::jsonb');
    if (fields.visibility !== undefined) push('visibility', fields.visibility);
    if (fields.ownerUserId !== undefined) push('owner_user_id', fields.ownerUserId);

    if (sets.length === 0) {
      return this.findById(id, companyId);
    }

    values.push(id, companyId);
    const r = await this.pool.query<DefRow>(
      `UPDATE report_definitions SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length - 1} AND company_id = $${values.length}
        RETURNING ${COLS}`,
      values,
    );
    const row = r.rows[0];
    return row ? rowToDef(row) : null;
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.pool.query('DELETE FROM report_definitions WHERE id = $1 AND company_id = $2', [
      id,
      companyId,
    ]);
  }

  async findById(id: number, companyId: number): Promise<ReportDefinition | null> {
    const r = await this.pool.query<DefRow>(
      `SELECT ${COLS} FROM report_definitions WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToDef(row) : null;
  }

  async listByCompany(companyId: number): Promise<ReadonlyArray<ReportDefinition>> {
    const r = await this.pool.query<DefRow>(
      `SELECT ${COLS} FROM report_definitions WHERE company_id = $1 ORDER BY name ASC, id ASC`,
      [companyId],
    );
    return r.rows.map(rowToDef);
  }

  async existsByName(companyId: number, name: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, name];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM report_definitions
        WHERE company_id = $1 AND lower(name) = lower($2)`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.pool.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }
}

function rowToDef(row: DefRow): ReportDefinition {
  return {
    id: row.id,
    companyId: row.company_id,
    folderId: row.folder_id,
    name: row.name,
    description: row.description,
    groupLabel: row.group_label,
    mode: row.mode,
    sqlText: row.sql_text,
    querySpec: row.query_spec,
    params: row.params ?? [],
    vizConfig: row.viz_config ?? {},
    layoutConfig: row.layout_config ?? {},
    visibility: row.visibility,
    ownerUserId: row.owner_user_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
