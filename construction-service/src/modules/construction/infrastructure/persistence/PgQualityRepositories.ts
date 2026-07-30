/**
 * Kalite & Güvenlik PG repository'leri (FAZ 6).
 * Tablolar: cs_defects, cs_defect_history, cs_inspection_templates,
 *   cs_inspection_template_items, cs_inspections, cs_inspection_answers,
 *   cs_rfis, cs_assignments, cs_quality_files (011_quality_safety.sql)
 *
 * BIGINT kolonları node-pg'de STRING döner — her mapper Number() çevirir
 * (bkz. PgLocationRepository başlığındaki uyarı).
 *
 * KOD ÜRETİMİ (`nextCode`): mevcut en büyük sayısal sonek + 1. UNIQUE kısıt
 * yarışta ikinci isteği 409'a düşürür (mapPostgresError) — kilit almaya değmez,
 * hasar-eksiklik girişi saniyede bir olmaz.
 */
import type { Pool } from 'pg';

import type {
  AssignmentFilter,
  AssignmentRepository,
  AssignmentSummaryRow,
  DefectFilter,
  DefectHistoryRow,
  DefectRepository,
  DefectSummaryRow,
  InspectionFilter,
  InspectionRepository,
  NewAssignmentInput,
  NewDefectInput,
  NewInspectionInput,
  NewInspectionTemplateInput,
  NewQualityFileInput,
  NewRfiInput,
  QualityFileRepository,
  QualityFileRow,
  RfiFilter,
  RfiRepository,
  RfiSummaryRow,
  VendorScorecardRow,
} from '../../application/ports/QualityRepositories.js';
import { Assignment, type AssignmentProps } from '../../domain/entities/Assignment.js';
import { Defect, type DefectProps } from '../../domain/entities/Defect.js';
import {
  Inspection,
  InspectionTemplate,
  type InspectionAnswerProps,
  type InspectionProps,
  type InspectionTemplateItemProps,
  type InspectionTemplateProps,
} from '../../domain/entities/Inspection.js';
import { Rfi, type RfiProps } from '../../domain/entities/Rfi.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type {
  AssignmentSource,
  AssignmentStatus,
  DefectKind,
  DefectSeverity,
  DefectSource,
  DefectStatus,
  FileStage,
  InspectionScoring,
  InspectionStatus,
  InspectionTemplateKind,
  Priority,
  QualityDocKind,
  RfiDiscipline,
  RfiStatus,
} from '../../domain/valueObjects/QualitySafety.js';

const n = (v: string | number | null): number | null =>
  v === null ? null : typeof v === 'number' ? v : Number(v);
const nn = (v: string | number): number => (typeof v === 'number' ? v : Number(v));

/** "DEF-0007" → 7; sayısal sonek yoksa 0. */
function codeSeq(code: string): number {
  const m = /(\d+)\s*$/.exec(code);
  return m === null ? 0 : Number(m[1]);
}

// ============================================================================
// HASAR-EKSİKLİK
// ============================================================================

interface DefectRow {
  id: string;
  company_id: number;
  project_id: string;
  location_id: string | null;
  code: string;
  title: string;
  description: string | null;
  defect_kind: DefectKind;
  severity: DefectSeverity;
  status: DefectStatus;
  vendor_id: string | null;
  responsible_user_id: number | null;
  reporter_user_id: number | null;
  source: DefectSource;
  boq_line_id: string | null;
  due_date: string | null;
  fixed_at: Date | null;
  fixed_by: number | null;
  verified_at: Date | null;
  verified_by: number | null;
  closed_at: Date | null;
  cost_estimate: string;
  cost_actual: string;
  currency: CurrencyCode;
  reopen_count: number;
  created_at: Date;
  updated_at: Date;
}

const DEFECT_COLS =
  'id, company_id, project_id, location_id, code, title, description, defect_kind, severity, ' +
  'status, vendor_id, responsible_user_id, reporter_user_id, source, boq_line_id, ' +
  'due_date::text AS due_date, fixed_at, fixed_by, verified_at, verified_by, closed_at, ' +
  'cost_estimate, cost_actual, currency, reopen_count, created_at, updated_at';

function toDefect(r: DefectRow): Defect {
  const props: DefectProps = {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    locationId: n(r.location_id),
    code: r.code,
    title: r.title,
    description: r.description,
    defectKind: r.defect_kind,
    severity: r.severity,
    status: r.status,
    vendorId: n(r.vendor_id),
    responsibleUserId: r.responsible_user_id,
    reporterUserId: r.reporter_user_id,
    source: r.source,
    boqLineId: n(r.boq_line_id),
    dueDate: r.due_date,
    fixedAt: r.fixed_at,
    fixedBy: r.fixed_by,
    verifiedAt: r.verified_at,
    verifiedBy: r.verified_by,
    closedAt: r.closed_at,
    costEstimate: Number(r.cost_estimate),
    costActual: Number(r.cost_actual),
    currency: r.currency,
    reopenCount: r.reopen_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return Defect.create(props);
}

export class PgDefectRepository implements DefectRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewDefectInput): Promise<Defect> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<DefectRow>(
        `INSERT INTO cs_defects
           (company_id, project_id, location_id, code, title, description, defect_kind,
            severity, vendor_id, responsible_user_id, reporter_user_id, source, boq_line_id,
            due_date, cost_estimate, currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING ${DEFECT_COLS}`,
        [
          input.companyId,
          input.projectId,
          input.locationId,
          input.code,
          input.title,
          input.description,
          input.defectKind,
          input.severity,
          input.vendorId,
          input.responsibleUserId,
          input.reporterUserId,
          input.source,
          input.boqLineId,
          input.dueDate,
          input.costEstimate,
          input.currency,
        ],
      );
      const row = res.rows[0]!;
      // Açılış izi de geçmişe düşer: "ne zaman kim açtı" sorusu ilk satırdır.
      await client.query(
        `INSERT INTO cs_defect_history (company_id, defect_id, from_status, to_status, actor)
         VALUES ($1,$2,NULL,'open',$3)`,
        [input.companyId, row.id, input.reporterUserId],
      );
      await client.query('COMMIT');
      return toDefect(row);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: number, companyId: number): Promise<Defect | null> {
    const res = await this.pool.query<DefectRow>(
      `SELECT ${DEFECT_COLS} FROM cs_defects WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toDefect(res.rows[0]);
  }

  async list(companyId: number, filter: DefectFilter = {}): Promise<ReadonlyArray<Defect>> {
    const where: string[] = ['d.company_id = $1'];
    const params: unknown[] = [companyId];
    const p = (v: unknown): string => {
      params.push(v);
      return `$${String(params.length)}`;
    };

    if (filter.projectId !== undefined) where.push(`d.project_id = ${p(filter.projectId)}`);
    if (filter.locationId !== undefined) {
      if (filter.locationSubtree === true) {
        // Alt ağaç: lokasyonun kendisi VE altındakiler (materialized path).
        where.push(
          `d.location_id IN (SELECT l2.id FROM cs_locations l2
             WHERE l2.company_id = $1 AND (l2.id = ${p(filter.locationId)}
               OR l2.path LIKE (SELECT l3.path || '/%' FROM cs_locations l3 WHERE l3.id = ${p(filter.locationId)})))`,
        );
      } else {
        where.push(`d.location_id = ${p(filter.locationId)}`);
      }
    }
    if (filter.status !== undefined) where.push(`d.status = ${p(filter.status)}`);
    if (filter.openOnly === true) where.push(`d.status IN ('open','in_progress','fixed')`);
    if (filter.severity !== undefined) where.push(`d.severity = ${p(filter.severity)}`);
    if (filter.defectKind !== undefined) where.push(`d.defect_kind = ${p(filter.defectKind)}`);
    if (filter.vendorId !== undefined) where.push(`d.vendor_id = ${p(filter.vendorId)}`);
    if (filter.responsibleUserId !== undefined)
      where.push(`d.responsible_user_id = ${p(filter.responsibleUserId)}`);
    if (filter.overdueOnly === true)
      where.push(
        `d.status NOT IN ('verified','closed','rejected') AND d.due_date IS NOT NULL AND d.due_date < CURRENT_DATE`,
      );
    if (filter.search !== undefined && filter.search.trim() !== '') {
      const term = p(`%${filter.search.trim()}%`);
      where.push(`(d.title ILIKE ${term} OR d.code ILIKE ${term} OR d.description ILIKE ${term})`);
    }

    const res = await this.pool.query<DefectRow>(
      `SELECT ${DEFECT_COLS.replaceAll(/(^|, )/g, '$1d.')} FROM cs_defects d
        WHERE ${where.join(' AND ')}
        ORDER BY d.status IN ('open','in_progress') DESC, d.severity DESC, d.due_date NULLS LAST, d.id DESC`,
      params,
    );
    return res.rows.map(toDefect);
  }

  async update(defect: Defect): Promise<Defect> {
    const j = defect.toJSON();
    const res = await this.pool.query<DefectRow>(
      `UPDATE cs_defects SET
         location_id = $1, title = $2, description = $3, defect_kind = $4, severity = $5,
         vendor_id = $6, responsible_user_id = $7, boq_line_id = $8, due_date = $9,
         cost_estimate = $10, cost_actual = $11, currency = $12, updated_at = NOW()
       WHERE id = $13 AND company_id = $14
       RETURNING ${DEFECT_COLS}`,
      [
        j.locationId,
        j.title,
        j.description,
        j.defectKind,
        j.severity,
        j.vendorId,
        j.responsibleUserId,
        j.boqLineId,
        j.dueDate,
        j.costEstimate,
        j.costActual,
        j.currency,
        j.id,
        j.companyId,
      ],
    );
    return toDefect(res.rows[0]!);
  }

  async changeStatus(
    defect: Defect,
    fromStatus: string,
    note: string | null,
    actor: number | null,
  ): Promise<void> {
    const j = defect.toJSON();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE cs_defects SET
           status = $1, fixed_at = $2, fixed_by = $3, verified_at = $4, verified_by = $5,
           closed_at = $6, reopen_count = $7, updated_at = NOW()
         WHERE id = $8 AND company_id = $9`,
        [
          j.status,
          j.fixedAt,
          j.fixedBy,
          j.verifiedAt,
          j.verifiedBy,
          j.closedAt,
          j.reopenCount,
          j.id,
          j.companyId,
        ],
      );
      await client.query(
        `INSERT INTO cs_defect_history (company_id, defect_id, from_status, to_status, note, actor)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [j.companyId, j.id, fromStatus, j.status, note, actor],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async history(defectId: number, companyId: number): Promise<ReadonlyArray<DefectHistoryRow>> {
    const res = await this.pool.query<{
      id: string;
      defect_id: string;
      from_status: string | null;
      to_status: string;
      note: string | null;
      actor: number | null;
      created_at: Date;
    }>(
      `SELECT id, defect_id, from_status, to_status, note, actor, created_at
         FROM cs_defect_history WHERE defect_id = $1 AND company_id = $2
        ORDER BY created_at, id`,
      [defectId, companyId],
    );
    return res.rows.map((r) => ({
      id: nn(r.id),
      defectId: nn(r.defect_id),
      fromStatus: r.from_status,
      toStatus: r.to_status,
      note: r.note,
      actor: r.actor,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async summary(
    companyId: number,
    projectId: number,
    options: { byLocation?: boolean } = {},
  ): Promise<ReadonlyArray<DefectSummaryRow>> {
    // byLocation=false: view lokasyon bazında gruplar, burada proje toplamına
    // katlanır. View'i iki kez yazmamak için toplama SQL'de.
    const res = await this.pool.query<{
      project_id: string;
      location_id: string | null;
      total: string;
      open_count: string;
      awaiting_verify: string;
      closed_count: string;
      rejected_count: string;
      critical_count: string;
      high_count: string;
      overdue_count: string;
      reopened_count: string;
      cost_estimate_total: string;
      cost_actual_total: string;
      avg_fix_days: string | null;
    }>(
      options.byLocation === true
        ? `SELECT * FROM cs_v_defect_summary WHERE company_id = $1 AND project_id = $2`
        : `SELECT project_id, NULL::bigint AS location_id,
                  SUM(total) AS total, SUM(open_count) AS open_count,
                  SUM(awaiting_verify) AS awaiting_verify, SUM(closed_count) AS closed_count,
                  SUM(rejected_count) AS rejected_count, SUM(critical_count) AS critical_count,
                  SUM(high_count) AS high_count, SUM(overdue_count) AS overdue_count,
                  SUM(reopened_count) AS reopened_count,
                  SUM(cost_estimate_total) AS cost_estimate_total,
                  SUM(cost_actual_total) AS cost_actual_total,
                  AVG(avg_fix_days) AS avg_fix_days
             FROM cs_v_defect_summary WHERE company_id = $1 AND project_id = $2
            GROUP BY project_id`,
      [companyId, projectId],
    );
    return res.rows.map((r) => ({
      projectId: nn(r.project_id),
      locationId: n(r.location_id),
      total: Number(r.total),
      openCount: Number(r.open_count),
      awaitingVerify: Number(r.awaiting_verify),
      closedCount: Number(r.closed_count),
      rejectedCount: Number(r.rejected_count),
      criticalCount: Number(r.critical_count),
      highCount: Number(r.high_count),
      overdueCount: Number(r.overdue_count),
      reopenedCount: Number(r.reopened_count),
      costEstimateTotal: Number(r.cost_estimate_total),
      costActualTotal: Number(r.cost_actual_total),
      avgFixDays: r.avg_fix_days === null ? null : Number(r.avg_fix_days),
    }));
  }

  async nextCode(companyId: number, projectId: number): Promise<string> {
    const res = await this.pool.query<{ code: string }>(
      `SELECT code FROM cs_defects WHERE company_id = $1 AND project_id = $2`,
      [companyId, projectId],
    );
    const max = res.rows.reduce((m, r) => Math.max(m, codeSeq(r.code)), 0);
    return `DEF-${String(max + 1).padStart(4, '0')}`;
  }
}

// ============================================================================
// DENETLEME
// ============================================================================

interface TemplateRow {
  id: string;
  company_id: number;
  code: string;
  name: string;
  kind: InspectionTemplateKind;
  description: string | null;
  scoring: InspectionScoring;
  pass_pct: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface TemplateItemRow {
  id: string;
  company_id: number;
  template_id: string;
  category: string | null;
  code: string;
  text: string;
  weight: string;
  max_score: string;
  is_critical: boolean;
  sort_order: number;
}

const TPL_COLS =
  'id, company_id, code, name, kind, description, scoring, pass_pct, is_active, created_at, updated_at';
const TPL_ITEM_COLS =
  'id, company_id, template_id, category, code, text, weight, max_score, is_critical, sort_order';

function toTemplateItem(r: TemplateItemRow): InspectionTemplateItemProps {
  return {
    id: nn(r.id),
    companyId: r.company_id,
    templateId: nn(r.template_id),
    category: r.category,
    code: r.code,
    text: r.text,
    weight: Number(r.weight),
    maxScore: Number(r.max_score),
    isCritical: r.is_critical,
    sortOrder: r.sort_order,
  };
}

function toTemplate(r: TemplateRow, items: ReadonlyArray<TemplateItemRow>): InspectionTemplate {
  const props: InspectionTemplateProps = {
    id: nn(r.id),
    companyId: r.company_id,
    code: r.code,
    name: r.name,
    kind: r.kind,
    description: r.description,
    scoring: r.scoring,
    passPct: Number(r.pass_pct),
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: items.map(toTemplateItem),
  };
  return InspectionTemplate.create(props);
}

interface InspectionRow {
  id: string;
  company_id: number;
  project_id: string;
  template_id: string;
  location_id: string | null;
  code: string;
  vendor_id: string | null;
  contract_id: string | null;
  inspector_user_id: number | null;
  inspection_date: string;
  period_label: string | null;
  status: InspectionStatus;
  note: string | null;
  total_score: string;
  max_score: string;
  score_pct: string | null;
  grade: string | null;
  passed: boolean | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  pass_pct: string;
}

interface AnswerRow {
  id: string;
  company_id: number;
  inspection_id: string;
  item_id: string;
  item_text: string;
  weight: string;
  max_score: string;
  score: string | null;
  is_na: boolean;
  note: string | null;
  defect_id: string | null;
  is_critical: boolean | null;
}

const INSP_COLS =
  'i.id, i.company_id, i.project_id, i.template_id, i.location_id, i.code, i.vendor_id, ' +
  'i.contract_id, i.inspector_user_id, i.inspection_date::text AS inspection_date, ' +
  'i.period_label, i.status, i.note, i.total_score, i.max_score, i.score_pct, i.grade, ' +
  'i.passed, i.completed_at, i.created_at, i.updated_at, t.pass_pct';

// Kritik bayrağı şablon maddesinden JOIN ile gelir: cevap tablosuna kopyalanmaz
// çünkü "kritiklik" şablonun politikasıdır, denetimin gözlemi değil.
const ANSWER_SQL = `
  SELECT a.id, a.company_id, a.inspection_id, a.item_id, a.item_text, a.weight, a.max_score,
         a.score, a.is_na, a.note, a.defect_id, ti.is_critical
    FROM cs_inspection_answers a
    LEFT JOIN cs_inspection_template_items ti ON ti.id = a.item_id
   WHERE a.inspection_id = ANY($1)
   ORDER BY ti.sort_order NULLS LAST, a.id`;

function toAnswer(r: AnswerRow): InspectionAnswerProps {
  return {
    id: nn(r.id),
    companyId: r.company_id,
    inspectionId: nn(r.inspection_id),
    itemId: nn(r.item_id),
    itemText: r.item_text,
    weight: Number(r.weight),
    maxScore: Number(r.max_score),
    score: r.score === null ? null : Number(r.score),
    isNa: r.is_na,
    note: r.note,
    defectId: n(r.defect_id),
    isCritical: r.is_critical ?? false,
  };
}

function toInspection(r: InspectionRow, answers: ReadonlyArray<AnswerRow>): Inspection {
  const props: InspectionProps = {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    templateId: nn(r.template_id),
    locationId: n(r.location_id),
    code: r.code,
    vendorId: n(r.vendor_id),
    contractId: n(r.contract_id),
    inspectorUserId: r.inspector_user_id,
    inspectionDate: r.inspection_date,
    periodLabel: r.period_label,
    status: r.status,
    note: r.note,
    totalScore: Number(r.total_score),
    maxScore: Number(r.max_score),
    scorePct: r.score_pct === null ? null : Number(r.score_pct),
    grade: r.grade,
    passed: r.passed,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    answers: answers.map(toAnswer),
    passPct: Number(r.pass_pct),
  };
  return Inspection.create(props);
}

export class PgInspectionRepository implements InspectionRepository {
  constructor(private readonly pool: Pool) {}

  async insertTemplate(input: NewInspectionTemplateInput): Promise<InspectionTemplate> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<TemplateRow>(
        `INSERT INTO cs_inspection_templates
           (company_id, code, name, kind, description, scoring, pass_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING ${TPL_COLS}`,
        [
          input.companyId,
          input.code,
          input.name,
          input.kind,
          input.description,
          input.scoring,
          input.passPct,
        ],
      );
      const tpl = res.rows[0]!;
      const items: TemplateItemRow[] = [];
      for (const it of input.items) {
        const ir = await client.query<TemplateItemRow>(
          `INSERT INTO cs_inspection_template_items
             (company_id, template_id, category, code, text, weight, max_score, is_critical, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING ${TPL_ITEM_COLS}`,
          [
            input.companyId,
            tpl.id,
            it.category,
            it.code,
            it.text,
            it.weight,
            it.maxScore,
            it.isCritical,
            it.sortOrder,
          ],
        );
        items.push(ir.rows[0]!);
      }
      await client.query('COMMIT');
      return toTemplate(tpl, items);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findTemplate(id: number, companyId: number): Promise<InspectionTemplate | null> {
    const res = await this.pool.query<TemplateRow>(
      `SELECT ${TPL_COLS} FROM cs_inspection_templates WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    if (res.rows[0] === undefined) return null;
    const items = await this.pool.query<TemplateItemRow>(
      `SELECT ${TPL_ITEM_COLS} FROM cs_inspection_template_items
        WHERE template_id = $1 ORDER BY sort_order, id`,
      [id],
    );
    return toTemplate(res.rows[0], items.rows);
  }

  async listTemplates(
    companyId: number,
    options: { kind?: InspectionTemplateKind; includeInactive?: boolean } = {},
  ): Promise<ReadonlyArray<InspectionTemplate>> {
    const where = ['t.company_id = $1'];
    const params: unknown[] = [companyId];
    if (options.kind !== undefined) {
      params.push(options.kind);
      where.push(`t.kind = $${String(params.length)}`);
    }
    if (options.includeInactive !== true) where.push('t.is_active');

    const res = await this.pool.query<TemplateRow>(
      `SELECT ${TPL_COLS.replaceAll(/(^|, )/g, '$1t.')} FROM cs_inspection_templates t
        WHERE ${where.join(' AND ')} ORDER BY t.name`,
      params,
    );
    if (res.rows.length === 0) return [];
    const ids = res.rows.map((r) => r.id);
    const items = await this.pool.query<TemplateItemRow>(
      `SELECT ${TPL_ITEM_COLS} FROM cs_inspection_template_items
        WHERE template_id = ANY($1) ORDER BY sort_order, id`,
      [ids],
    );
    const byTpl = new Map<string, TemplateItemRow[]>();
    for (const it of items.rows) {
      const arr = byTpl.get(it.template_id);
      if (arr) arr.push(it);
      else byTpl.set(it.template_id, [it]);
    }
    return res.rows.map((r) => toTemplate(r, byTpl.get(r.id) ?? []));
  }

  async replaceTemplateItems(
    templateId: number,
    companyId: number,
    items: NewInspectionTemplateInput['items'],
  ): Promise<InspectionTemplate> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Eski maddeler SİLİNMEZ, cevaplar onlara FK ile bağlı. Yeni sürüm ekleme
      // + eskiyi devre dışı bırakma da denenmedi: madde tablosunda aktiflik yok,
      // silme yalnız hiç cevaplanmamış maddede güvenli. Cevaplanmış madde varsa
      // FK ihlali 409'a düşer ve istemci "şablonu kopyala" yolunu kullanır.
      await client.query(
        `DELETE FROM cs_inspection_template_items WHERE template_id = $1 AND company_id = $2`,
        [templateId, companyId],
      );
      for (const it of items) {
        await client.query(
          `INSERT INTO cs_inspection_template_items
             (company_id, template_id, category, code, text, weight, max_score, is_critical, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            companyId,
            templateId,
            it.category,
            it.code,
            it.text,
            it.weight,
            it.maxScore,
            it.isCritical,
            it.sortOrder,
          ],
        );
      }
      await client.query(
        `UPDATE cs_inspection_templates SET updated_at = NOW() WHERE id = $1 AND company_id = $2`,
        [templateId, companyId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    const tpl = await this.findTemplate(templateId, companyId);
    return tpl!;
  }

  async deactivateTemplate(id: number, companyId: number): Promise<InspectionTemplate> {
    await this.pool.query(
      `UPDATE cs_inspection_templates SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    const tpl = await this.findTemplate(id, companyId);
    return tpl!;
  }

  async insertInspection(input: NewInspectionInput): Promise<Inspection> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<{ id: string }>(
        `INSERT INTO cs_inspections
           (company_id, project_id, template_id, location_id, code, vendor_id, contract_id,
            inspector_user_id, inspection_date, period_label, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          input.companyId,
          input.projectId,
          input.templateId,
          input.locationId,
          input.code,
          input.vendorId,
          input.contractId,
          input.inspectorUserId,
          input.inspectionDate,
          input.periodLabel,
          input.note,
        ],
      );
      const inspectionId = res.rows[0]!.id;
      // Cevap iskeleti şablondan kurulur — madde metni/ağırlığı KOPYALANIR.
      await client.query(
        `INSERT INTO cs_inspection_answers
           (company_id, inspection_id, item_id, item_text, weight, max_score)
         SELECT $1, $2, ti.id, ti.text, ti.weight, ti.max_score
           FROM cs_inspection_template_items ti
          WHERE ti.template_id = $3
          ORDER BY ti.sort_order, ti.id`,
        [input.companyId, inspectionId, input.templateId],
      );
      await client.query('COMMIT');
      const ins = await this.findInspection(Number(inspectionId), input.companyId);
      return ins!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findInspection(id: number, companyId: number): Promise<Inspection | null> {
    const res = await this.pool.query<InspectionRow>(
      `SELECT ${INSP_COLS} FROM cs_inspections i
         JOIN cs_inspection_templates t ON t.id = i.template_id
        WHERE i.id = $1 AND i.company_id = $2`,
      [id, companyId],
    );
    if (res.rows[0] === undefined) return null;
    const answers = await this.pool.query<AnswerRow>(ANSWER_SQL, [[id]]);
    return toInspection(res.rows[0], answers.rows);
  }

  async listInspections(
    companyId: number,
    filter: InspectionFilter = {},
  ): Promise<ReadonlyArray<Inspection>> {
    const where = ['i.company_id = $1'];
    const params: unknown[] = [companyId];
    const p = (v: unknown): string => {
      params.push(v);
      return `$${String(params.length)}`;
    };
    if (filter.projectId !== undefined) where.push(`i.project_id = ${p(filter.projectId)}`);
    if (filter.templateId !== undefined) where.push(`i.template_id = ${p(filter.templateId)}`);
    if (filter.vendorId !== undefined) where.push(`i.vendor_id = ${p(filter.vendorId)}`);
    if (filter.locationId !== undefined) where.push(`i.location_id = ${p(filter.locationId)}`);
    if (filter.status !== undefined) where.push(`i.status = ${p(filter.status)}`);
    if (filter.fromDate !== undefined) where.push(`i.inspection_date >= ${p(filter.fromDate)}`);
    if (filter.toDate !== undefined) where.push(`i.inspection_date <= ${p(filter.toDate)}`);

    const res = await this.pool.query<InspectionRow>(
      `SELECT ${INSP_COLS} FROM cs_inspections i
         JOIN cs_inspection_templates t ON t.id = i.template_id
        WHERE ${where.join(' AND ')}
        ORDER BY i.inspection_date DESC, i.id DESC`,
      params,
    );
    if (res.rows.length === 0) return [];
    const answers = await this.pool.query<AnswerRow>(ANSWER_SQL, [res.rows.map((r) => r.id)]);
    const byInsp = new Map<string, AnswerRow[]>();
    for (const a of answers.rows) {
      const arr = byInsp.get(a.inspection_id);
      if (arr) arr.push(a);
      else byInsp.set(a.inspection_id, [a]);
    }
    return res.rows.map((r) => toInspection(r, byInsp.get(r.id) ?? []));
  }

  async saveAnswers(inspection: Inspection): Promise<void> {
    const j = inspection.toJSON();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const a of j.answers) {
        await client.query(
          `UPDATE cs_inspection_answers
              SET score = $1, is_na = $2, note = $3, updated_at = NOW()
            WHERE id = $4 AND company_id = $5`,
          [a.score, a.isNa, a.note, a.id, a.companyId],
        );
      }
      // Puan HER YAZIMDA tazelenir — liste ekranı gerçeği göstersin.
      await client.query(
        `UPDATE cs_inspections
            SET total_score = $1, max_score = $2, score_pct = $3, grade = $4, passed = $5,
                updated_at = NOW()
          WHERE id = $6 AND company_id = $7`,
        [j.totalScore, j.maxScore, j.scorePct, j.grade, j.passed, j.id, j.companyId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async changeInspectionStatus(inspection: Inspection): Promise<void> {
    const j = inspection.toJSON();
    await this.pool.query(
      `UPDATE cs_inspections
          SET status = $1, total_score = $2, max_score = $3, score_pct = $4, grade = $5,
              passed = $6, completed_at = $7, updated_at = NOW()
        WHERE id = $8 AND company_id = $9`,
      [
        j.status,
        j.totalScore,
        j.maxScore,
        j.scorePct,
        j.grade,
        j.passed,
        j.completedAt,
        j.id,
        j.companyId,
      ],
    );
  }

  async linkAnswerDefect(answerId: number, companyId: number, defectId: number): Promise<void> {
    await this.pool.query(
      `UPDATE cs_inspection_answers SET defect_id = $1, updated_at = NOW()
        WHERE id = $2 AND company_id = $3`,
      [defectId, answerId, companyId],
    );
  }

  async scorecard(
    companyId: number,
    options: { projectId?: number; vendorId?: number } = {},
  ): Promise<ReadonlyArray<VendorScorecardRow>> {
    const where = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options.projectId !== undefined) {
      params.push(options.projectId);
      where.push(`project_id = $${String(params.length)}`);
    }
    if (options.vendorId !== undefined) {
      params.push(options.vendorId);
      where.push(`vendor_id = $${String(params.length)}`);
    }
    const res = await this.pool.query<{
      vendor_id: string;
      project_id: string;
      vendor_name: string | null;
      inspection_count: string;
      avg_score_pct: string | null;
      min_score_pct: string | null;
      last_inspection_date: string | null;
      failed_inspection_count: string;
      defect_count: string;
      defect_open: string;
      defect_overdue: string;
      defect_severe: string;
      reopen_total: string;
      avg_fix_days: string | null;
    }>(
      `SELECT vendor_id, project_id, vendor_name, inspection_count, avg_score_pct, min_score_pct,
              last_inspection_date::text AS last_inspection_date, failed_inspection_count,
              defect_count, defect_open, defect_overdue, defect_severe, reopen_total, avg_fix_days
         FROM cs_v_vendor_scorecard WHERE ${where.join(' AND ')}
        ORDER BY avg_score_pct DESC NULLS LAST`,
      params,
    );
    return res.rows.map((r) => ({
      vendorId: nn(r.vendor_id),
      projectId: nn(r.project_id),
      vendorName: r.vendor_name,
      inspectionCount: Number(r.inspection_count),
      avgScorePct: r.avg_score_pct === null ? null : Number(r.avg_score_pct),
      minScorePct: r.min_score_pct === null ? null : Number(r.min_score_pct),
      lastInspectionDate: r.last_inspection_date,
      failedInspectionCount: Number(r.failed_inspection_count),
      defectCount: Number(r.defect_count),
      defectOpen: Number(r.defect_open),
      defectOverdue: Number(r.defect_overdue),
      defectSevere: Number(r.defect_severe),
      reopenTotal: Number(r.reopen_total),
      avgFixDays: r.avg_fix_days === null ? null : Number(r.avg_fix_days),
    }));
  }

  async nextInspectionCode(companyId: number): Promise<string> {
    const res = await this.pool.query<{ code: string }>(
      `SELECT code FROM cs_inspections WHERE company_id = $1`,
      [companyId],
    );
    const max = res.rows.reduce((m, r) => Math.max(m, codeSeq(r.code)), 0);
    return `DEN-${String(max + 1).padStart(4, '0')}`;
  }
}

// ============================================================================
// RFI
// ============================================================================

interface RfiRow {
  id: string;
  company_id: number;
  project_id: string;
  location_id: string | null;
  code: string;
  subject: string;
  question: string;
  discipline: RfiDiscipline;
  priority: Priority;
  status: RfiStatus;
  asked_by: number | null;
  asked_to_user_id: number | null;
  vendor_id: string | null;
  boq_line_id: string | null;
  due_date: string | null;
  answer: string | null;
  answered_by: number | null;
  answered_at: Date | null;
  closed_at: Date | null;
  impact_days: number;
  impact_cost: string;
  currency: CurrencyCode;
  created_at: Date;
  updated_at: Date;
}

const RFI_COLS =
  'id, company_id, project_id, location_id, code, subject, question, discipline, priority, ' +
  'status, asked_by, asked_to_user_id, vendor_id, boq_line_id, due_date::text AS due_date, ' +
  'answer, answered_by, answered_at, closed_at, impact_days, impact_cost, currency, ' +
  'created_at, updated_at';

function toRfi(r: RfiRow): Rfi {
  const props: RfiProps = {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    locationId: n(r.location_id),
    code: r.code,
    subject: r.subject,
    question: r.question,
    discipline: r.discipline,
    priority: r.priority,
    status: r.status,
    askedBy: r.asked_by,
    askedToUserId: r.asked_to_user_id,
    vendorId: n(r.vendor_id),
    boqLineId: n(r.boq_line_id),
    dueDate: r.due_date,
    answer: r.answer,
    answeredBy: r.answered_by,
    answeredAt: r.answered_at,
    closedAt: r.closed_at,
    impactDays: r.impact_days,
    impactCost: Number(r.impact_cost),
    currency: r.currency,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return Rfi.create(props);
}

export class PgRfiRepository implements RfiRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewRfiInput): Promise<Rfi> {
    const res = await this.pool.query<RfiRow>(
      `INSERT INTO cs_rfis
         (company_id, project_id, location_id, code, subject, question, discipline, priority,
          asked_by, asked_to_user_id, vendor_id, boq_line_id, due_date, impact_days,
          impact_cost, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING ${RFI_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.locationId,
        input.code,
        input.subject,
        input.question,
        input.discipline,
        input.priority,
        input.askedBy,
        input.askedToUserId,
        input.vendorId,
        input.boqLineId,
        input.dueDate,
        input.impactDays,
        input.impactCost,
        input.currency,
      ],
    );
    return toRfi(res.rows[0]!);
  }

  async findById(id: number, companyId: number): Promise<Rfi | null> {
    const res = await this.pool.query<RfiRow>(
      `SELECT ${RFI_COLS} FROM cs_rfis WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toRfi(res.rows[0]);
  }

  async list(companyId: number, filter: RfiFilter = {}): Promise<ReadonlyArray<Rfi>> {
    const where = ['company_id = $1'];
    const params: unknown[] = [companyId];
    const p = (v: unknown): string => {
      params.push(v);
      return `$${String(params.length)}`;
    };
    if (filter.projectId !== undefined) where.push(`project_id = ${p(filter.projectId)}`);
    if (filter.locationId !== undefined) where.push(`location_id = ${p(filter.locationId)}`);
    if (filter.status !== undefined) where.push(`status = ${p(filter.status)}`);
    if (filter.discipline !== undefined) where.push(`discipline = ${p(filter.discipline)}`);
    if (filter.priority !== undefined) where.push(`priority = ${p(filter.priority)}`);
    if (filter.askedToUserId !== undefined)
      where.push(`asked_to_user_id = ${p(filter.askedToUserId)}`);
    if (filter.overdueOnly === true)
      where.push(`status = 'open' AND due_date IS NOT NULL AND due_date < CURRENT_DATE`);
    if (filter.search !== undefined && filter.search.trim() !== '') {
      const term = p(`%${filter.search.trim()}%`);
      where.push(`(subject ILIKE ${term} OR code ILIKE ${term} OR question ILIKE ${term})`);
    }

    const res = await this.pool.query<RfiRow>(
      `SELECT ${RFI_COLS} FROM cs_rfis
        WHERE ${where.join(' AND ')}
        ORDER BY status = 'open' DESC, due_date NULLS LAST, id DESC`,
      params,
    );
    return res.rows.map(toRfi);
  }

  async update(rfi: Rfi): Promise<Rfi> {
    const j = rfi.toJSON();
    const res = await this.pool.query<RfiRow>(
      `UPDATE cs_rfis SET
         location_id = $1, subject = $2, question = $3, discipline = $4, priority = $5,
         status = $6, asked_to_user_id = $7, vendor_id = $8, boq_line_id = $9, due_date = $10,
         answer = $11, answered_by = $12, answered_at = $13, closed_at = $14,
         impact_days = $15, impact_cost = $16, currency = $17, updated_at = NOW()
       WHERE id = $18 AND company_id = $19
       RETURNING ${RFI_COLS}`,
      [
        j.locationId,
        j.subject,
        j.question,
        j.discipline,
        j.priority,
        j.status,
        j.askedToUserId,
        j.vendorId,
        j.boqLineId,
        j.dueDate,
        j.answer,
        j.answeredBy,
        j.answeredAt,
        j.closedAt,
        j.impactDays,
        j.impactCost,
        j.currency,
        j.id,
        j.companyId,
      ],
    );
    return toRfi(res.rows[0]!);
  }

  async summary(companyId: number, projectId: number): Promise<RfiSummaryRow | null> {
    const res = await this.pool.query<{
      project_id: string;
      total: string;
      open_count: string;
      answered_count: string;
      closed_count: string;
      overdue_count: string;
      avg_answer_days: string | null;
      oldest_open_days: number | null;
      impact_days_total: string;
      impact_cost_total: string;
    }>(`SELECT * FROM cs_v_rfi_summary WHERE company_id = $1 AND project_id = $2`, [
      companyId,
      projectId,
    ]);
    const r = res.rows[0];
    if (r === undefined) return null;
    return {
      projectId: nn(r.project_id),
      total: Number(r.total),
      openCount: Number(r.open_count),
      answeredCount: Number(r.answered_count),
      closedCount: Number(r.closed_count),
      overdueCount: Number(r.overdue_count),
      avgAnswerDays: r.avg_answer_days === null ? null : Number(r.avg_answer_days),
      oldestOpenDays: r.oldest_open_days,
      impactDaysTotal: Number(r.impact_days_total),
      impactCostTotal: Number(r.impact_cost_total),
    };
  }

  async nextCode(companyId: number, projectId: number): Promise<string> {
    const res = await this.pool.query<{ code: string }>(
      `SELECT code FROM cs_rfis WHERE company_id = $1 AND project_id = $2`,
      [companyId, projectId],
    );
    const max = res.rows.reduce((m, r) => Math.max(m, codeSeq(r.code)), 0);
    return `RFI-${String(max + 1).padStart(4, '0')}`;
  }
}

// ============================================================================
// GÖREVLENDİRME
// ============================================================================

interface AssignmentRow {
  id: string;
  company_id: number;
  project_id: string;
  location_id: string | null;
  code: string;
  title: string;
  description: string | null;
  assigned_to_user_id: number | null;
  vendor_id: string | null;
  assigned_by: number | null;
  priority: Priority;
  status: AssignmentStatus;
  start_date: string | null;
  due_date: string | null;
  done_at: Date | null;
  progress_pct: string;
  source_kind: AssignmentSource | null;
  source_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const ASG_COLS =
  'id, company_id, project_id, location_id, code, title, description, assigned_to_user_id, ' +
  'vendor_id, assigned_by, priority, status, start_date::text AS start_date, ' +
  'due_date::text AS due_date, done_at, progress_pct, source_kind, source_id, created_at, updated_at';

function toAssignment(r: AssignmentRow): Assignment {
  const props: AssignmentProps = {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    locationId: n(r.location_id),
    code: r.code,
    title: r.title,
    description: r.description,
    assignedToUserId: r.assigned_to_user_id,
    vendorId: n(r.vendor_id),
    assignedBy: r.assigned_by,
    priority: r.priority,
    status: r.status,
    startDate: r.start_date,
    dueDate: r.due_date,
    doneAt: r.done_at,
    progressPct: Number(r.progress_pct),
    sourceKind: r.source_kind,
    sourceId: n(r.source_id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return Assignment.create(props);
}

export class PgAssignmentRepository implements AssignmentRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewAssignmentInput): Promise<Assignment> {
    const res = await this.pool.query<AssignmentRow>(
      `INSERT INTO cs_assignments
         (company_id, project_id, location_id, code, title, description, assigned_to_user_id,
          vendor_id, assigned_by, priority, start_date, due_date, source_kind, source_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING ${ASG_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.locationId,
        input.code,
        input.title,
        input.description,
        input.assignedToUserId,
        input.vendorId,
        input.assignedBy,
        input.priority,
        input.startDate,
        input.dueDate,
        input.sourceKind,
        input.sourceId,
      ],
    );
    return toAssignment(res.rows[0]!);
  }

  async findById(id: number, companyId: number): Promise<Assignment | null> {
    const res = await this.pool.query<AssignmentRow>(
      `SELECT ${ASG_COLS} FROM cs_assignments WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toAssignment(res.rows[0]);
  }

  async list(companyId: number, filter: AssignmentFilter = {}): Promise<ReadonlyArray<Assignment>> {
    const where = ['company_id = $1'];
    const params: unknown[] = [companyId];
    const p = (v: unknown): string => {
      params.push(v);
      return `$${String(params.length)}`;
    };
    if (filter.projectId !== undefined) where.push(`project_id = ${p(filter.projectId)}`);
    if (filter.locationId !== undefined) where.push(`location_id = ${p(filter.locationId)}`);
    if (filter.assignedToUserId !== undefined)
      where.push(`assigned_to_user_id = ${p(filter.assignedToUserId)}`);
    if (filter.vendorId !== undefined) where.push(`vendor_id = ${p(filter.vendorId)}`);
    if (filter.status !== undefined) where.push(`status = ${p(filter.status)}`);
    if (filter.openOnly === true) where.push(`status IN ('open','in_progress')`);
    if (filter.priority !== undefined) where.push(`priority = ${p(filter.priority)}`);
    if (filter.sourceKind !== undefined) where.push(`source_kind = ${p(filter.sourceKind)}`);
    if (filter.sourceId !== undefined) where.push(`source_id = ${p(filter.sourceId)}`);
    if (filter.overdueOnly === true)
      where.push(
        `status IN ('open','in_progress') AND due_date IS NOT NULL AND due_date < CURRENT_DATE`,
      );

    const res = await this.pool.query<AssignmentRow>(
      `SELECT ${ASG_COLS} FROM cs_assignments
        WHERE ${where.join(' AND ')}
        ORDER BY status IN ('open','in_progress') DESC, due_date NULLS LAST, id DESC`,
      params,
    );
    return res.rows.map(toAssignment);
  }

  async update(assignment: Assignment): Promise<Assignment> {
    const j = assignment.toJSON();
    const res = await this.pool.query<AssignmentRow>(
      `UPDATE cs_assignments SET
         location_id = $1, title = $2, description = $3, assigned_to_user_id = $4,
         vendor_id = $5, priority = $6, status = $7, start_date = $8, due_date = $9,
         done_at = $10, progress_pct = $11, updated_at = NOW()
       WHERE id = $12 AND company_id = $13
       RETURNING ${ASG_COLS}`,
      [
        j.locationId,
        j.title,
        j.description,
        j.assignedToUserId,
        j.vendorId,
        j.priority,
        j.status,
        j.startDate,
        j.dueDate,
        j.doneAt,
        j.progressPct,
        j.id,
        j.companyId,
      ],
    );
    return toAssignment(res.rows[0]!);
  }

  async summary(
    companyId: number,
    projectId: number,
    options: { byUser?: boolean } = {},
  ): Promise<ReadonlyArray<AssignmentSummaryRow>> {
    const res = await this.pool.query<{
      project_id: string;
      assigned_to_user_id: number | null;
      total: string;
      open_count: string;
      in_progress_count: string;
      done_count: string;
      overdue_count: string;
      avg_progress_pct: string | null;
    }>(
      options.byUser === true
        ? `SELECT * FROM cs_v_assignment_summary WHERE company_id = $1 AND project_id = $2`
        : `SELECT project_id, NULL::int AS assigned_to_user_id,
                  SUM(total) AS total, SUM(open_count) AS open_count,
                  SUM(in_progress_count) AS in_progress_count, SUM(done_count) AS done_count,
                  SUM(overdue_count) AS overdue_count, AVG(avg_progress_pct) AS avg_progress_pct
             FROM cs_v_assignment_summary WHERE company_id = $1 AND project_id = $2
            GROUP BY project_id`,
      [companyId, projectId],
    );
    return res.rows.map((r) => ({
      projectId: nn(r.project_id),
      assignedToUserId: r.assigned_to_user_id,
      total: Number(r.total),
      openCount: Number(r.open_count),
      inProgressCount: Number(r.in_progress_count),
      doneCount: Number(r.done_count),
      overdueCount: Number(r.overdue_count),
      avgProgressPct: r.avg_progress_pct === null ? null : Number(r.avg_progress_pct),
    }));
  }

  async nextCode(companyId: number, projectId: number): Promise<string> {
    const res = await this.pool.query<{ code: string }>(
      `SELECT code FROM cs_assignments WHERE company_id = $1 AND project_id = $2`,
      [companyId, projectId],
    );
    const max = res.rows.reduce((m, r) => Math.max(m, codeSeq(r.code)), 0);
    return `GRV-${String(max + 1).padStart(4, '0')}`;
  }
}

// ============================================================================
// ORTAK EK DOSYASI
// ============================================================================

interface FileRow {
  id: string;
  company_id: number;
  doc_kind: QualityDocKind;
  doc_id: string;
  file_kind: string;
  stage: FileStage;
  title: string | null;
  file_url: string | null;
  has_content: boolean;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: number | null;
  created_at: Date;
}

const FILE_COLS =
  'id, company_id, doc_kind, doc_id, file_kind, stage, title, file_url, ' +
  '(content IS NOT NULL) AS has_content, mime_type, size_bytes, created_by, created_at';

function toFileRow(r: FileRow): QualityFileRow {
  return {
    id: nn(r.id),
    docKind: r.doc_kind,
    docId: nn(r.doc_id),
    fileKind: r.file_kind,
    stage: r.stage,
    title: r.title,
    fileUrl: r.file_url,
    hasContent: r.has_content,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
  };
}

export class PgQualityFileRepository implements QualityFileRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewQualityFileInput): Promise<QualityFileRow> {
    const res = await this.pool.query<FileRow>(
      `INSERT INTO cs_quality_files
         (company_id, doc_kind, doc_id, file_kind, stage, title, file_url, content,
          mime_type, size_bytes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${FILE_COLS}`,
      [
        input.companyId,
        input.docKind,
        input.docId,
        input.fileKind,
        input.stage,
        input.title,
        input.fileUrl,
        input.content,
        input.mimeType,
        input.sizeBytes,
        input.createdBy,
      ],
    );
    return toFileRow(res.rows[0]!);
  }

  async list(
    companyId: number,
    docKind: QualityDocKind,
    docId: number,
  ): Promise<ReadonlyArray<QualityFileRow>> {
    const res = await this.pool.query<FileRow>(
      `SELECT ${FILE_COLS} FROM cs_quality_files
        WHERE company_id = $1 AND doc_kind = $2 AND doc_id = $3
        ORDER BY created_at, id`,
      [companyId, docKind, docId],
    );
    return res.rows.map(toFileRow);
  }

  async delete(id: number, companyId: number): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM cs_quality_files WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
