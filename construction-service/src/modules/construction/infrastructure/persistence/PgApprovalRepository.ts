/**
 * PgApprovalRepository — jenerik onay akışı PG implementasyonu (FAZ 5).
 * Tablolar/view'lar: 009_approval_flow.sql
 *
 * BIGINT ↔ string: node-pg int8'i STRING döndürür; tüm id alanları Number()'a
 * çevrilir (bkz. 0793b9f).
 *
 * applyDecision TEK TRANSACTION'da yazar: adım kararı, atlanan adımlar, akış
 * durumu ve geçmiş satırı. Kısmi yazım denetim izini bozar — "onaylandı ama
 * geçmişte yok" ya da "akış kapandı ama adımlar bekliyor" durumları kabul edilemez.
 */
import type { Pool } from 'pg';

import type {
  ApprovalFlowSummary,
  ApprovalHistoryRow,
  ApprovalRepository,
  ListFlowsFilter,
  NewApprovalFlowInput,
  PendingApprovalRow,
} from '../../application/ports/ApprovalRepository.js';
import {
  ApprovalFlow,
  type ApprovalDecision,
  type ApprovalDocKind,
  type ApprovalMode,
  type ApprovalStatus,
  type ApprovalStepProps,
  type DecisionOutcome,
} from '../../domain/entities/ApprovalFlow.js';

interface FlowRow {
  id: string;
  company_id: number;
  doc_kind: ApprovalDocKind;
  doc_id: string;
  project_id: string | null;
  mode: ApprovalMode;
  status: ApprovalStatus;
  min_approvals: number | null;
  title: string | null;
  note: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

interface StepRow {
  id: string;
  company_id: number;
  flow_id: string;
  seq_no: number;
  approver_user_id: number;
  due_date: string | null;
  decision: ApprovalDecision;
  decided_at: Date | null;
  decided_by: number | null;
  comment: string | null;
}

const FLOW_COLS =
  'id, company_id, doc_kind, doc_id, project_id, mode, status, min_approvals, title, note, ' +
  'created_by, created_at, updated_at, completed_at';

const STEP_COLS =
  'id, company_id, flow_id, seq_no, approver_user_id, due_date::text AS due_date, decision, ' +
  'decided_at, decided_by, comment';

function toStep(r: StepRow): ApprovalStepProps {
  return {
    id: Number(r.id),
    companyId: Number(r.company_id),
    flowId: Number(r.flow_id),
    seqNo: Number(r.seq_no),
    approverUserId: Number(r.approver_user_id),
    dueDate: r.due_date,
    decision: r.decision,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by === null ? null : Number(r.decided_by),
    comment: r.comment,
  };
}

function toFlow(r: FlowRow, steps: ReadonlyArray<ApprovalStepProps>): ApprovalFlow {
  return ApprovalFlow.create({
    id: Number(r.id),
    companyId: Number(r.company_id),
    docKind: r.doc_kind,
    docId: Number(r.doc_id),
    projectId: r.project_id === null ? null : Number(r.project_id),
    mode: r.mode,
    status: r.status,
    minApprovals: r.min_approvals === null ? null : Number(r.min_approvals),
    title: r.title,
    note: r.note,
    createdBy: r.created_by === null ? null : Number(r.created_by),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
    steps,
  });
}

interface SummaryRow {
  flow_id: string;
  doc_kind: ApprovalDocKind;
  doc_id: string;
  project_id: string | null;
  mode: ApprovalMode;
  status: ApprovalStatus;
  min_approvals: number | null;
  title: string | null;
  created_at: Date;
  completed_at: Date | null;
  step_count: string;
  approved_count: string;
  rejected_count: string;
  pending_count: string;
  required_count: string;
  current_approver_user_id: number | null;
  next_due_date: string | null;
  days_overdue: number | null;
}

const SUMMARY_COLS =
  'flow_id, doc_kind, doc_id, project_id, mode, status, min_approvals, title, created_at, ' +
  'completed_at, step_count, approved_count, rejected_count, pending_count, required_count, ' +
  'current_approver_user_id, next_due_date::text AS next_due_date, days_overdue';

function toSummary(r: SummaryRow): ApprovalFlowSummary {
  return {
    flowId: Number(r.flow_id),
    docKind: r.doc_kind,
    docId: Number(r.doc_id),
    projectId: r.project_id === null ? null : Number(r.project_id),
    mode: r.mode,
    status: r.status,
    minApprovals: r.min_approvals === null ? null : Number(r.min_approvals),
    title: r.title,
    createdAt: r.created_at.toISOString(),
    completedAt: r.completed_at === null ? null : r.completed_at.toISOString(),
    stepCount: Number(r.step_count),
    approvedCount: Number(r.approved_count),
    rejectedCount: Number(r.rejected_count),
    pendingCount: Number(r.pending_count),
    requiredCount: Number(r.required_count),
    currentApproverUserId:
      r.current_approver_user_id === null ? null : Number(r.current_approver_user_id),
    nextDueDate: r.next_due_date,
    daysOverdue: r.days_overdue === null ? null : Number(r.days_overdue),
  };
}

export class PgApprovalRepository implements ApprovalRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewApprovalFlowInput): Promise<ApprovalFlow> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const f = await client.query<FlowRow>(
        `INSERT INTO cs_approval_flows
           (company_id, doc_kind, doc_id, project_id, mode, min_approvals, title, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING ${FLOW_COLS}`,
        [
          input.companyId,
          input.docKind,
          input.docId,
          input.projectId,
          input.mode,
          input.minApprovals,
          input.title,
          input.note,
          input.createdBy,
        ],
      );
      const flowRow = f.rows[0]!;
      const flowId = Number(flowRow.id);

      const steps: ApprovalStepProps[] = [];
      let seq = 1;
      for (const a of input.approvers) {
        const s = await client.query<StepRow>(
          `INSERT INTO cs_approval_steps
             (company_id, flow_id, seq_no, approver_user_id, due_date)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING ${STEP_COLS}`,
          [input.companyId, flowId, seq, a.approverUserId, a.dueDate],
        );
        steps.push(toStep(s.rows[0]!));
        seq += 1;
      }

      await client.query(
        `INSERT INTO cs_approval_history (company_id, flow_id, action, actor, note)
         VALUES ($1,$2,'created',$3,$4)`,
        [input.companyId, flowId, input.createdBy, input.title],
      );

      await client.query('COMMIT');
      return toFlow(flowRow, steps);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async loadSteps(
    flowId: number,
    companyId: number,
  ): Promise<ReadonlyArray<ApprovalStepProps>> {
    const r = await this.pool.query<StepRow>(
      `SELECT ${STEP_COLS} FROM cs_approval_steps
        WHERE flow_id = $1 AND company_id = $2 ORDER BY seq_no`,
      [flowId, companyId],
    );
    return r.rows.map(toStep);
  }

  async findById(id: number, companyId: number): Promise<ApprovalFlow | null> {
    const r = await this.pool.query<FlowRow>(
      `SELECT ${FLOW_COLS} FROM cs_approval_flows WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return toFlow(row, await this.loadSteps(Number(row.id), companyId));
  }

  async findActiveByDoc(
    companyId: number,
    docKind: ApprovalDocKind,
    docId: number,
  ): Promise<ApprovalFlow | null> {
    const r = await this.pool.query<FlowRow>(
      `SELECT ${FLOW_COLS} FROM cs_approval_flows
        WHERE company_id = $1 AND doc_kind = $2 AND doc_id = $3 AND status = 'pending'`,
      [companyId, docKind, docId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return toFlow(row, await this.loadSteps(Number(row.id), companyId));
  }

  async applyDecision(outcome: DecisionOutcome, actor: number | null): Promise<void> {
    const flow = outcome.flow;
    const j = flow.toJSON();
    const decided = j.steps.find((s) => s.id === outcome.decidedStepId);
    if (!decided)
      throw new Error(`karar verilen adım bulunamadı: ${String(outcome.decidedStepId)}`);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE cs_approval_steps
            SET decision = $1, decided_at = $2, decided_by = $3, comment = $4, updated_at = NOW()
          WHERE id = $5 AND company_id = $6`,
        [
          decided.decision,
          decided.decidedAt,
          decided.decidedBy,
          decided.comment,
          decided.id,
          j.companyId,
        ],
      );

      if (outcome.skippedStepIds.length > 0) {
        await client.query(
          `UPDATE cs_approval_steps
              SET decision = 'skipped', decided_at = $1, updated_at = NOW()
            WHERE id = ANY($2::bigint[]) AND company_id = $3`,
          [decided.decidedAt, outcome.skippedStepIds as number[], j.companyId],
        );
      }

      if (outcome.completed) {
        await client.query(
          `UPDATE cs_approval_flows
              SET status = $1, completed_at = $2, updated_at = NOW()
            WHERE id = $3 AND company_id = $4`,
          [j.status, j.completedAt, j.id, j.companyId],
        );
      }

      await client.query(
        `INSERT INTO cs_approval_history (company_id, flow_id, step_id, action, actor, note)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          j.companyId,
          j.id,
          decided.id,
          decided.decision === 'rejected' ? 'rejected' : 'approved',
          actor,
          decided.comment,
        ],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async cancel(flow: ApprovalFlow, actor: number | null): Promise<void> {
    const j = flow.toJSON();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE cs_approval_steps
            SET decision = 'skipped', decided_at = $1, updated_at = NOW()
          WHERE flow_id = $2 AND company_id = $3 AND decision = 'pending'`,
        [j.completedAt, j.id, j.companyId],
      );
      await client.query(
        `UPDATE cs_approval_flows
            SET status = 'cancelled', completed_at = $1, updated_at = NOW()
          WHERE id = $2 AND company_id = $3`,
        [j.completedAt, j.id, j.companyId],
      );
      await client.query(
        `INSERT INTO cs_approval_history (company_id, flow_id, action, actor)
         VALUES ($1,$2,'cancelled',$3)`,
        [j.companyId, j.id, actor],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listSummaries(
    companyId: number,
    filter: ListFlowsFilter = {},
  ): Promise<ReadonlyArray<ApprovalFlowSummary>> {
    const where: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (filter.docKind !== undefined) {
      params.push(filter.docKind);
      where.push(`doc_kind = $${params.length}`);
    }
    if (filter.docId !== undefined) {
      params.push(filter.docId);
      where.push(`doc_id = $${params.length}`);
    }
    if (filter.projectId !== undefined) {
      params.push(filter.projectId);
      where.push(`project_id = $${params.length}`);
    }
    if (filter.status !== undefined) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter.overdueOnly === true) where.push('days_overdue > 0');

    const r = await this.pool.query<SummaryRow>(
      `SELECT ${SUMMARY_COLS} FROM cs_v_approval_flow_summary
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC`,
      params,
    );
    return r.rows.map(toSummary);
  }

  async summaryFor(flowId: number, companyId: number): Promise<ApprovalFlowSummary | null> {
    const r = await this.pool.query<SummaryRow>(
      `SELECT ${SUMMARY_COLS} FROM cs_v_approval_flow_summary
        WHERE flow_id = $1 AND company_id = $2`,
      [flowId, companyId],
    );
    const row = r.rows[0];
    return row ? toSummary(row) : null;
  }

  async summariesForDocs(
    companyId: number,
    docKind: ApprovalDocKind,
    docIds: ReadonlyArray<number>,
  ): Promise<ReadonlyArray<ApprovalFlowSummary>> {
    if (docIds.length === 0) return [];
    const r = await this.pool.query<SummaryRow>(
      `SELECT ${SUMMARY_COLS} FROM cs_v_approval_flow_summary
        WHERE company_id = $1 AND doc_kind = $2 AND doc_id = ANY($3::bigint[])
        ORDER BY doc_id, created_at DESC`,
      [companyId, docKind, docIds as number[]],
    );
    return r.rows.map(toSummary);
  }

  async listPendingForUser(
    companyId: number,
    userId: number,
  ): Promise<ReadonlyArray<PendingApprovalRow>> {
    const r = await this.pool.query<{
      step_id: string;
      approver_user_id: number;
      seq_no: number;
      due_date: string | null;
      flow_id: string;
      doc_kind: ApprovalDocKind;
      doc_id: string;
      project_id: string | null;
      mode: ApprovalMode;
      title: string | null;
      flow_created_at: Date;
      actionable: boolean;
      days_overdue: number | null;
    }>(
      `SELECT step_id, approver_user_id, seq_no, due_date::text AS due_date, flow_id, doc_kind,
              doc_id, project_id, mode, title, flow_created_at, actionable, days_overdue
         FROM cs_v_my_pending_approvals
        WHERE company_id = $1 AND approver_user_id = $2
        ORDER BY actionable DESC, due_date NULLS LAST, flow_created_at`,
      [companyId, userId],
    );
    return r.rows.map((row) => ({
      stepId: Number(row.step_id),
      approverUserId: Number(row.approver_user_id),
      seqNo: Number(row.seq_no),
      dueDate: row.due_date,
      flowId: Number(row.flow_id),
      docKind: row.doc_kind,
      docId: Number(row.doc_id),
      projectId: row.project_id === null ? null : Number(row.project_id),
      mode: row.mode,
      title: row.title,
      flowCreatedAt: row.flow_created_at.toISOString(),
      actionable: row.actionable,
      daysOverdue: row.days_overdue === null ? null : Number(row.days_overdue),
    }));
  }

  async history(flowId: number, companyId: number): Promise<ReadonlyArray<ApprovalHistoryRow>> {
    const r = await this.pool.query<{
      id: string;
      flow_id: string;
      step_id: string | null;
      action: string;
      actor: number | null;
      note: string | null;
      created_at: Date;
    }>(
      `SELECT id, flow_id, step_id, action, actor, note, created_at
         FROM cs_approval_history
        WHERE flow_id = $1 AND company_id = $2
        ORDER BY created_at DESC, id DESC`,
      [flowId, companyId],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      flowId: Number(row.flow_id),
      stepId: row.step_id === null ? null : Number(row.step_id),
      action: row.action,
      actor: row.actor === null ? null : Number(row.actor),
      note: row.note,
      createdAt: row.created_at.toISOString(),
    }));
  }
}
