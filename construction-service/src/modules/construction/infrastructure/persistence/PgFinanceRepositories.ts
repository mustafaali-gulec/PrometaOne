/**
 * PgExpenseRepository / PgAdvanceRepository / PgCashMovementRepository.
 * Tablolar: cs_expenses, cs_advances, cs_cash_movements (026_cs_finance.sql).
 * BIGINT id/FK alanları satır eşleyicide Number()'a çevrilir (JSON'da sayısal id).
 */
import type {
  ManualPaymentDto,
  PaymentListItemDto,
  PaymentStatus,
} from '../../application/dto/FinanceDtos.js';
import type {
  AdvanceRepository,
  CashMovementRepository,
  CategoryTotal,
  ExpenseRepository,
  ManualPaymentPatch,
  NewAdvanceInput,
  NewCashMovementInput,
  NewExpenseInput,
  NewManualPaymentInput,
  PaymentRepository,
} from '../../application/ports/FinanceRepositories.js';
import { Advance } from '../../domain/entities/Advance.js';
import { CashMovement } from '../../domain/entities/CashMovement.js';
import { Expense } from '../../domain/entities/Expense.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';

import type { Queryable } from './Queryable.js';

// ===== EXPENSE ==============================================================
interface ExpenseRow {
  id: string;
  company_id: number;
  project_id: string;
  boq_line_id: string | null;
  vendor_id: string | null;
  invoice_id: string | null;
  category: string;
  description: string | null;
  amount: string;
  currency: CurrencyCode;
  spent_at: string;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const E_COLS =
  'id, company_id, project_id, boq_line_id, vendor_id, invoice_id, category, description, ' +
  'amount, currency, spent_at::text AS spent_at, created_by, created_at, updated_at';

export class PgExpenseRepository implements ExpenseRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewExpenseInput): Promise<Expense> {
    const r = await this.db.query<ExpenseRow>(
      `INSERT INTO cs_expenses
         (company_id, project_id, boq_line_id, vendor_id, invoice_id, category, description,
          amount, currency, spent_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${E_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.boqLineId,
        input.vendorId,
        input.invoiceId,
        input.category,
        input.description,
        input.amount,
        input.currency,
        input.spentAt,
        input.createdBy,
      ],
    );
    return rowToExpense(r.rows[0]!);
  }

  async update(e: Expense): Promise<void> {
    await this.db.query(
      `UPDATE cs_expenses
         SET boq_line_id = $1, vendor_id = $2, invoice_id = $3, category = $4, description = $5,
             amount = $6, currency = $7, spent_at = $8, updated_at = NOW()
       WHERE id = $9 AND company_id = $10`,
      [
        e.boqLineId,
        e.vendorId,
        e.invoiceId,
        e.category,
        e.description,
        e.amount,
        e.currency,
        e.spentAt,
        e.id,
        e.companyId,
      ],
    );
  }

  async delete(id: number, companyId: number): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM cs_expenses WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
    return (r.rowCount ?? 0) > 0;
  }

  async findById(id: number, companyId: number): Promise<Expense | null> {
    const r = await this.db.query<ExpenseRow>(
      `SELECT ${E_COLS} FROM cs_expenses WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToExpense(row) : null;
  }

  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Expense>> {
    const r = await this.db.query<ExpenseRow>(
      `SELECT ${E_COLS} FROM cs_expenses
        WHERE project_id = $1 AND company_id = $2
        ORDER BY spent_at DESC, id DESC`,
      [projectId, companyId],
    );
    return r.rows.map(rowToExpense);
  }

  async sumByCategory(projectId: number, companyId: number): Promise<ReadonlyArray<CategoryTotal>> {
    const r = await this.db.query<{ category: string; amount: string }>(
      `SELECT category, SUM(amount)::text AS amount FROM cs_expenses
        WHERE project_id = $1 AND company_id = $2
        GROUP BY category ORDER BY category`,
      [projectId, companyId],
    );
    return r.rows.map((row) => ({ category: row.category, amount: Number(row.amount) }));
  }
}

function rowToExpense(row: ExpenseRow): Expense {
  return Expense.create({
    id: Number(row.id),
    companyId: row.company_id,
    projectId: Number(row.project_id),
    boqLineId: row.boq_line_id !== null ? Number(row.boq_line_id) : null,
    vendorId: row.vendor_id !== null ? Number(row.vendor_id) : null,
    invoiceId: row.invoice_id !== null ? Number(row.invoice_id) : null,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    spentAt: row.spent_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ===== ADVANCE ==============================================================
interface AdvanceRow {
  id: string;
  company_id: number;
  project_id: string;
  vendor_id: string | null;
  description: string | null;
  amount: string;
  offset_amount: string;
  currency: CurrencyCode;
  given_at: string;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const A_COLS =
  'id, company_id, project_id, vendor_id, description, amount, offset_amount, currency, ' +
  'given_at::text AS given_at, created_by, created_at, updated_at';

export class PgAdvanceRepository implements AdvanceRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewAdvanceInput): Promise<Advance> {
    const r = await this.db.query<AdvanceRow>(
      `INSERT INTO cs_advances
         (company_id, project_id, vendor_id, description, amount, offset_amount, currency, given_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${A_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.vendorId,
        input.description,
        input.amount,
        input.offsetAmount,
        input.currency,
        input.givenAt,
        input.createdBy,
      ],
    );
    return rowToAdvance(r.rows[0]!);
  }

  async update(a: Advance): Promise<void> {
    await this.db.query(
      `UPDATE cs_advances
         SET vendor_id = $1, description = $2, amount = $3, offset_amount = $4, currency = $5,
             given_at = $6, updated_at = NOW()
       WHERE id = $7 AND company_id = $8`,
      [
        a.vendorId,
        a.description,
        a.amount,
        a.offsetAmount,
        a.currency,
        a.givenAt,
        a.id,
        a.companyId,
      ],
    );
  }

  async delete(id: number, companyId: number): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM cs_advances WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
    return (r.rowCount ?? 0) > 0;
  }

  async findById(id: number, companyId: number): Promise<Advance | null> {
    const r = await this.db.query<AdvanceRow>(
      `SELECT ${A_COLS} FROM cs_advances WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToAdvance(row) : null;
  }

  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Advance>> {
    const r = await this.db.query<AdvanceRow>(
      `SELECT ${A_COLS} FROM cs_advances
        WHERE project_id = $1 AND company_id = $2 ORDER BY given_at DESC, id DESC`,
      [projectId, companyId],
    );
    return r.rows.map(rowToAdvance);
  }
}

function rowToAdvance(row: AdvanceRow): Advance {
  return Advance.create({
    id: Number(row.id),
    companyId: row.company_id,
    projectId: Number(row.project_id),
    vendorId: row.vendor_id !== null ? Number(row.vendor_id) : null,
    description: row.description,
    amount: Number(row.amount),
    offsetAmount: Number(row.offset_amount),
    currency: row.currency,
    givenAt: row.given_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ===== CASH MOVEMENT ========================================================
interface CashRow {
  id: string;
  company_id: number;
  project_id: string;
  direction: number;
  account_ref: string | null;
  description: string | null;
  amount: string;
  currency: CurrencyCode;
  moved_at: string;
  related_progress_id: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const C_COLS =
  'id, company_id, project_id, direction, account_ref, description, amount, currency, ' +
  'moved_at::text AS moved_at, related_progress_id, created_by, created_at, updated_at';

export class PgCashMovementRepository implements CashMovementRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewCashMovementInput): Promise<CashMovement> {
    const r = await this.db.query<CashRow>(
      `INSERT INTO cs_cash_movements
         (company_id, project_id, direction, account_ref, description, amount, currency, moved_at,
          related_progress_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING ${C_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.direction,
        input.accountRef,
        input.description,
        input.amount,
        input.currency,
        input.movedAt,
        input.relatedProgressId,
        input.createdBy,
      ],
    );
    return rowToCash(r.rows[0]!);
  }

  async update(m: CashMovement): Promise<void> {
    await this.db.query(
      `UPDATE cs_cash_movements
         SET direction = $1, account_ref = $2, description = $3, amount = $4, currency = $5,
             moved_at = $6, related_progress_id = $7, updated_at = NOW()
       WHERE id = $8 AND company_id = $9`,
      [
        m.direction,
        m.accountRef,
        m.description,
        m.amount,
        m.currency,
        m.movedAt,
        m.relatedProgressId,
        m.id,
        m.companyId,
      ],
    );
  }

  async delete(id: number, companyId: number): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM cs_cash_movements WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async findById(id: number, companyId: number): Promise<CashMovement | null> {
    const r = await this.db.query<CashRow>(
      `SELECT ${C_COLS} FROM cs_cash_movements WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToCash(row) : null;
  }

  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<CashMovement>> {
    const r = await this.db.query<CashRow>(
      `SELECT ${C_COLS} FROM cs_cash_movements
        WHERE project_id = $1 AND company_id = $2 ORDER BY moved_at DESC, id DESC`,
      [projectId, companyId],
    );
    return r.rows.map(rowToCash);
  }
}

function rowToCash(row: CashRow): CashMovement {
  return CashMovement.create({
    id: Number(row.id),
    companyId: row.company_id,
    projectId: Number(row.project_id),
    direction: row.direction,
    accountRef: row.account_ref,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    movedAt: row.moved_at,
    relatedProgressId: row.related_progress_id !== null ? Number(row.related_progress_id) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ===== PAYMENT (Ödeme Listesi) ==============================================
interface PaymentListRow {
  source: string;
  source_id: string;
  payment_id: string | null;
  project_id: string | null;
  payee: string | null;
  description: string | null;
  amount: string;
  currency: string;
  status: string;
  txn_date: string | null;
  due_date: string | null;
  method: string | null;
}

interface ManualPaymentRow {
  id: string;
  company_id: number;
  project_id: string | null;
  payee: string | null;
  description: string | null;
  amount: string;
  currency: CurrencyCode;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  method: string | null;
  created_at: Date;
  updated_at: Date;
}

const P_COLS =
  'id, company_id, project_id, payee, description, amount, currency, ' +
  'due_date::text AS due_date, status, paid_at::text AS paid_at, method, created_at, updated_at';

export class PgPaymentRepository implements PaymentRepository {
  constructor(private readonly db: Queryable) {}

  async listUnified(companyId: number, projectId: number | null): Promise<PaymentListItemDto[]> {
    const r = await this.db.query<PaymentListRow>(
      `SELECT u.source, u.source_id, u.payment_id, u.project_id, u.payee, u.description,
              u.amount, u.currency, u.status, u.txn_date, u.due_date, u.method
       FROM (
         SELECT 'manual'::text AS source, p.id AS source_id, p.id AS payment_id, p.project_id,
                p.payee, p.description, p.amount, p.currency::text AS currency, p.status::text AS status,
                COALESCE(p.paid_at, p.due_date, p.created_at::date)::text AS txn_date,
                p.due_date::text AS due_date, p.method
           FROM cs_payments p WHERE p.company_id = $1
         UNION ALL
         SELECT 'hakedis', pp.id, NULL::bigint, c.project_id, v.name, pp.hakedis_no,
                pp.net_payable, pp.currency::text, (CASE WHEN pp.status = 'paid' THEN 'paid' ELSE 'planned' END),
                COALESCE(pp.approved_at::date, pp.created_at::date)::text, NULL::text, NULL::text
           FROM cs_progress_payments pp
           JOIN cs_contracts c ON c.id = pp.contract_id
           LEFT JOIN cs_ref_vendors v ON v.id = c.vendor_id
          WHERE pp.company_id = $1 AND pp.kind = 'subcontractor' AND pp.status IN ('approved','paid')
         UNION ALL
         SELECT 'expense', e.id, NULL::bigint, e.project_id, v.name,
                COALESCE(NULLIF(e.description, ''), e.category), e.amount, e.currency::text, 'paid',
                e.spent_at::text, NULL::text, NULL::text
           FROM cs_expenses e LEFT JOIN cs_ref_vendors v ON v.id = e.vendor_id WHERE e.company_id = $1
         UNION ALL
         SELECT 'advance', a.id, NULL::bigint, a.project_id, v.name,
                COALESCE(NULLIF(a.description, ''), 'Avans'), a.amount, a.currency::text, 'paid',
                a.given_at::text, NULL::text, NULL::text
           FROM cs_advances a LEFT JOIN cs_ref_vendors v ON v.id = a.vendor_id WHERE a.company_id = $1
       ) u
       WHERE ($2::bigint IS NULL OR u.project_id = $2)
       ORDER BY u.txn_date DESC NULLS LAST, u.source`,
      [companyId, projectId],
    );
    return r.rows.map((row) => ({
      source: row.source as PaymentListItemDto['source'],
      sourceId: Number(row.source_id),
      paymentId: row.payment_id == null ? null : Number(row.payment_id),
      projectId: row.project_id == null ? null : Number(row.project_id),
      payee: row.payee,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency as CurrencyCode,
      status: row.status as PaymentStatus,
      date: row.txn_date,
      dueDate: row.due_date,
      method: row.method,
    }));
  }

  async insertManual(input: NewManualPaymentInput): Promise<ManualPaymentDto> {
    const r = await this.db.query<ManualPaymentRow>(
      `INSERT INTO cs_payments
         (company_id, project_id, payee, description, amount, currency, due_date, status, paid_at, method, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${P_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.payee,
        input.description,
        input.amount,
        input.currency,
        input.dueDate,
        input.status,
        input.paidAt,
        input.method,
        input.createdBy,
      ],
    );
    return rowToManualPayment(r.rows[0]!);
  }

  async findManualById(id: number, companyId: number): Promise<ManualPaymentDto | null> {
    const r = await this.db.query<ManualPaymentRow>(
      `SELECT ${P_COLS} FROM cs_payments WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToManualPayment(row) : null;
  }

  async updateManual(
    id: number,
    companyId: number,
    patch: ManualPaymentPatch,
  ): Promise<ManualPaymentDto | null> {
    const r = await this.db.query<ManualPaymentRow>(
      `UPDATE cs_payments
         SET payee = $1, description = $2, amount = $3, currency = $4, due_date = $5,
             status = $6, paid_at = $7, method = $8, updated_at = NOW()
       WHERE id = $9 AND company_id = $10
       RETURNING ${P_COLS}`,
      [
        patch.payee,
        patch.description,
        patch.amount,
        patch.currency,
        patch.dueDate,
        patch.status,
        patch.paidAt,
        patch.method,
        id,
        companyId,
      ],
    );
    const row = r.rows[0];
    return row ? rowToManualPayment(row) : null;
  }

  async deleteManual(id: number, companyId: number): Promise<boolean> {
    const r = await this.db.query<{ id: string }>(
      `DELETE FROM cs_payments WHERE id = $1 AND company_id = $2 RETURNING id`,
      [id, companyId],
    );
    return r.rows.length > 0;
  }
}

function rowToManualPayment(row: ManualPaymentRow): ManualPaymentDto {
  return {
    id: Number(row.id),
    companyId: row.company_id,
    projectId: row.project_id == null ? null : Number(row.project_id),
    payee: row.payee,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    dueDate: row.due_date,
    status: row.status as PaymentStatus,
    paidAt: row.paid_at,
    method: row.method,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
