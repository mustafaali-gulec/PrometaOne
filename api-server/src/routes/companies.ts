/**
 * Companies route'ları.
 * /state endpoint'i frontend bootstrap için kritik — tüm şirket verisini tek seferde döner.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { pool, queryOne, queryMany, transaction } from '../db.js';
import { publishCore } from '../events/kafka.js';
import { logAudit } from '../middleware/audit.js';
import { authMiddleware, requireRole, requireCompanyAccess } from '../middleware/auth.js';

const companies = new Hono();
companies.use('*', authMiddleware);

// =========== LIST ===========
companies.get('/', async (c) => {
  const authCtx = c.get('auth');
  let sql: string;
  let params: any[];

  if (authCtx.role === 'admin') {
    sql = `SELECT id, name, tax_no AS "taxNo", color, fiscal_year AS "fiscalYear",
           fiscal_start_month AS "fiscalStartMonth", opening_cash::float AS "openingCash",
           created_at AS "createdAt"
           FROM companies WHERE active = TRUE
           ORDER BY name`;
    params = [];
  } else {
    sql = `SELECT c.id, c.name, c.tax_no AS "taxNo", c.color, c.fiscal_year AS "fiscalYear",
           c.fiscal_start_month AS "fiscalStartMonth", c.opening_cash::float AS "openingCash",
           c.created_at AS "createdAt"
           FROM companies c
           JOIN user_company_access uca ON uca.company_id = c.id
           WHERE c.active = TRUE AND uca.user_id = $1
           ORDER BY c.name`;
    params = [authCtx.userId];
  }

  const result = await queryMany(sql, params);
  return c.json(result);
});

// =========== CREATE (admin) ===========
companies.post(
  '/',
  requireRole('admin'),
  zValidator(
    'json',
    z.object({
      name: z.string().min(1),
      taxNo: z.string().optional(),
      color: z.string().default('#dc2626'),
      fiscalYear: z.number().int().default(new Date().getFullYear()),
      fiscalStartMonth: z.number().int().min(0).max(11).default(0),
      openingCash: z.number().default(0),
      copyCategoriesFrom: z.number().int().optional(),
    }),
  ),
  async (c) => {
    const authCtx = c.get('auth');
    const data = c.req.valid('json');

    const newCompany = await transaction(async (client) => {
      const ins = await client.query<any>(
        `INSERT INTO companies (name, tax_no, color, fiscal_year, fiscal_start_month, opening_cash, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, tax_no AS "taxNo", color, fiscal_year AS "fiscalYear",
                   fiscal_start_month AS "fiscalStartMonth", opening_cash::float AS "openingCash",
                   created_at AS "createdAt"`,
        [
          data.name,
          data.taxNo,
          data.color,
          data.fiscalYear,
          data.fiscalStartMonth,
          data.openingCash,
          authCtx.userId,
        ],
      );
      const company = ins.rows[0];

      // Yaratıcıya admin erişimi ver
      await client.query(
        `INSERT INTO user_company_access (user_id, company_id, role, granted_by)
         VALUES ($1, $2, 'admin', $1)`,
        [authCtx.userId, company.id],
      );

      // Default bildirim ayarları
      await client.query(
        `INSERT INTO notification_settings (company_id, enabled) VALUES ($1, FALSE)`,
        [company.id],
      );

      // Kategori kopyalama
      if (data.copyCategoriesFrom) {
        await client.query(
          `INSERT INTO categories (company_id, section, name, sort_order)
           SELECT $1, section, name, sort_order
           FROM categories WHERE company_id = $2
           ORDER BY sort_order`,
          [company.id, data.copyCategoriesFrom],
        );
      }
      return company;
    });

    await logAudit(c, 'company_create', { name: data.name }, newCompany.id);
    // Referans event → construction-service cs_ref_companies (no-op if no Kafka)
    await publishCore('core.company', String(newCompany.id), {
      id: newCompany.id,
      name: newCompany.name,
      taxNo: newCompany.taxNo,
    });
    return c.json(newCompany, 201);
  },
);

// =========== GET single ===========
companies.get('/:cid', requireCompanyAccess('viewer'), async (c) => {
  const cid = Number(c.req.param('cid'));
  const company = await queryOne(
    `SELECT id, name, tax_no AS "taxNo", color, fiscal_year AS "fiscalYear",
              fiscal_start_month AS "fiscalStartMonth", opening_cash::float AS "openingCash",
              created_at AS "createdAt"
       FROM companies WHERE id = $1 AND active = TRUE`,
    [cid],
  );
  if (!company) throw new HTTPException(404, { message: 'Şirket bulunamadı' });
  return c.json(company);
});

// =========== UPDATE ===========
companies.patch(
  '/:cid',
  requireCompanyAccess('cfo'),
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).optional(),
      taxNo: z.string().optional(),
      color: z.string().optional(),
      fiscalYear: z.number().int().optional(),
      fiscalStartMonth: z.number().int().min(0).max(11).optional(),
      openingCash: z.number().optional(),
    }),
  ),
  async (c) => {
    const cid = Number(c.req.param('cid'));
    const data = c.req.valid('json');

    const fields: string[] = [];
    const params: any[] = [];
    let pi = 1;
    const map: Record<string, string> = {
      name: 'name',
      taxNo: 'tax_no',
      color: 'color',
      fiscalYear: 'fiscal_year',
      fiscalStartMonth: 'fiscal_start_month',
      openingCash: 'opening_cash',
    };
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && map[k]) {
        fields.push(`${map[k]} = $${pi++}`);
        params.push(v);
      }
    }
    if (fields.length === 0) {
      throw new HTTPException(400, { message: 'Güncellenecek alan yok' });
    }
    params.push(cid);

    const result = await queryOne(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${pi}
       RETURNING id, name, tax_no AS "taxNo", color, fiscal_year AS "fiscalYear",
                 fiscal_start_month AS "fiscalStartMonth", opening_cash::float AS "openingCash",
                 created_at AS "createdAt"`,
      params,
    );

    await logAudit(c, 'company_update', { changes: data }, cid);
    if (result) {
      const r = result as { id: number; name: string; taxNo: string | null };
      await publishCore('core.company', String(r.id), { id: r.id, name: r.name, taxNo: r.taxNo });
    }
    return c.json(result);
  },
);

// =========== DELETE ===========
companies.delete('/:cid', requireRole('admin'), async (c) => {
  const cid = Number(c.req.param('cid'));
  // Soft delete
  await pool.query(`UPDATE companies SET active = FALSE WHERE id = $1`, [cid]);
  await logAudit(c, 'company_delete', {}, cid);
  await publishCore('core.company', String(cid), { id: cid }, 'deleted');
  return new Response(null, { status: 204 });
});

// =========== /state — bootstrap endpoint ===========
companies.get('/:cid/state', requireCompanyAccess('viewer'), async (c) => {
  const cid = Number(c.req.param('cid'));

  // Paralel sorgular
  const [
    company,
    categories,
    cells,
    banks,
    kasas,
    kasaEntries,
    transfers,
    invoices,
    revaluations,
    settings,
    archives,
  ] = await Promise.all([
    queryOne(
      `SELECT id, name, tax_no AS "taxNo", color, fiscal_year AS "fiscalYear",
                fiscal_start_month AS "fiscalStartMonth", opening_cash::float AS "openingCash",
                created_at AS "createdAt"
                FROM companies WHERE id = $1`,
      [cid],
    ),

    queryMany(
      `SELECT id, company_id AS "companyId", section, name, sort_order AS "sortOrder"
                 FROM categories WHERE company_id = $1 ORDER BY section, sort_order`,
      [cid],
    ),

    pool.query<{ category_id: number; month_idx: number; value: string }>(
      `SELECT category_id, month_idx, value::float AS value FROM cells
         WHERE company_id = $1 AND fiscal_year = (SELECT fiscal_year FROM companies WHERE id = $1)`,
      [cid],
    ),

    queryMany(
      `SELECT ba.id, ba.company_id AS "companyId", ba.bank_id AS "bankId",
                 ba.name, ba.iban, ba.account_no AS "accountNo", ba.currency,
                 ba.opening_balance::float AS "openingBalance",
                 ba.cashflow_cat_id AS "cashflowCatId",
                 v.balance::float AS balance
                 FROM bank_accounts ba
                 LEFT JOIN v_bank_balances v ON v.id = ba.id
                 WHERE ba.company_id = $1 AND ba.active = TRUE ORDER BY ba.id`,
      [cid],
    ),

    queryMany(
      `SELECT ka.id, ka.company_id AS "companyId", ka.name, ka.currency,
                 ka.opening_balance::float AS "openingBalance",
                 v.balance::float AS balance
                 FROM kasa_accounts ka
                 LEFT JOIN v_kasa_balances v ON v.id = ka.id
                 WHERE ka.company_id = $1 AND ka.active = TRUE ORDER BY ka.id`,
      [cid],
    ),

    queryMany(
      `SELECT ke.id, ke.kasa_account_id AS "kasaAccountId",
                 ke.date::text AS date, ke.type, ke.amount::float AS amount,
                 ke.description, ke.category, ke.cashflow_cat_id AS "cashflowCatId",
                 ke.committed_to_cells AS "committedToCells", ke.committed_at AS "committedAt",
                 ke.created_at AS "createdAt", ke.created_by AS "createdBy"
                 FROM kasa_entries ke
                 JOIN kasa_accounts ka ON ka.id = ke.kasa_account_id
                 WHERE ka.company_id = $1 ORDER BY ke.date DESC, ke.id DESC`,
      [cid],
    ),

    queryMany(
      `SELECT id, date::text AS date, from_type AS "fromType", from_id AS "fromId",
                 to_type AS "toType", to_id AS "toId",
                 from_amount::float AS "fromAmount", to_amount::float AS "toAmount",
                 from_currency AS "fromCurrency", to_currency AS "toCurrency",
                 description, cashflow_cat_id AS "cashflowCatId",
                 committed_to_cells AS "committedToCells",
                 created_at AS "createdAt", created_by AS "createdBy"
                 FROM transfers WHERE company_id = $1 ORDER BY date DESC, id DESC`,
      [cid],
    ),

    queryMany(
      `SELECT i.id, i.company_id AS "companyId", i.type, i.invoice_no AS "invoiceNo",
                 i.counterparty, i.issue_date::text AS "issueDate", i.due_date::text AS "dueDate",
                 i.currency, i.subtotal::float AS subtotal, i.kdv_rate::float AS "kdvRate",
                 i.kdv::float AS kdv, i.total::float AS total,
                 i.paid_amount::float AS "paidAmount",
                 CASE
                   WHEN i.paid_amount >= i.total - 0.01 THEN 'paid'
                   WHEN i.paid_amount > 0 THEN 'partial'
                   WHEN i.due_date < CURRENT_DATE THEN 'overdue'
                   ELSE 'open'
                 END AS status,
                 i.cashflow_cat_id AS "cashflowCatId",
                 i.committed_to_cells AS "committedToCells",
                 i.committed_at AS "committedAt",
                 i.note, i.created_at AS "createdAt", i.created_by AS "createdBy",
                 COALESCE((
                   SELECT json_agg(json_build_object(
                     'id', p.id,
                     'invoiceId', p.invoice_id,
                     'amount', p.amount::float,
                     'date', p.date::text,
                     'currency', p.currency,
                     'bankAccountId', p.bank_account_id,
                     'kasaAccountId', p.kasa_account_id,
                     'note', p.note,
                     'createdAt', p.created_at
                   ) ORDER BY p.date)
                   FROM invoice_payments p WHERE p.invoice_id = i.id
                 ), '[]'::json) AS payments
                 FROM invoices i
                 WHERE i.company_id = $1
                 ORDER BY i.due_date DESC, i.id DESC`,
      [cid],
    ),

    queryMany(
      `SELECT id, company_id AS "companyId",
                 reference_date::text AS "referenceDate",
                 valuation_date::text AS "valuationDate",
                 usd_rate_1::float AS "usdRate1", usd_rate_2::float AS "usdRate2",
                 eur_rate_1::float AS "eurRate1", eur_rate_2::float AS "eurRate2",
                 gain_total::float AS "gainTotal", loss_total::float AS "lossTotal",
                 net::float AS net, details, posted,
                 posted_at AS "postedAt", created_at AS "createdAt",
                 created_by AS "createdBy"
                 FROM revaluations WHERE company_id = $1 ORDER BY valuation_date DESC`,
      [cid],
    ),

    queryOne(
      `SELECT enabled, recipients, alert_threshold_days AS "alertThresholdDays",
                include_overdue AS "includeOverdue",
                include_due_soon AS "includeDueSoon",
                include_upcoming_30 AS "includeUpcoming30",
                include_cash_position AS "includeCashPosition",
                include_fx_positions AS "includeFxPositions",
                last_generated_at AS "lastGeneratedAt",
                last_sent_at AS "lastSentAt",
                cron_schedule AS "cronSchedule"
                FROM notification_settings WHERE company_id = $1`,
      [cid],
    ),

    queryMany(
      `SELECT id, company_id AS "companyId", fiscal_year AS "fiscalYear",
                 fiscal_start_month AS "fiscalStartMonth",
                 opening_cash::float AS "openingCash",
                 closing_cash::float AS "closingCash",
                 total_inflow::float AS "totalInflow",
                 total_outflow::float AS "totalOutflow",
                 archived_at AS "archivedAt", archived_by AS "archivedBy"
                 FROM year_archives WHERE company_id = $1 ORDER BY fiscal_year DESC`,
      [cid],
    ),
  ]);

  if (!company) {
    throw new HTTPException(404, { message: 'Şirket bulunamadı' });
  }

  // Cells dictionary'ye dönüştür: "catId:monthIdx" → value
  const cellsMap: Record<string, number> = {};
  for (const row of cells.rows) {
    cellsMap[`${row.category_id}:${row.month_idx}`] = parseFloat(row.value);
  }

  // Categories'i section'lara böl
  const cats = categories;
  const inflows = cats.filter((c) => c.section === 'inflows');
  const outflows = cats.filter((c) => c.section === 'outflows');
  const nonPnlOutflows = cats.filter((c) => c.section === 'nonPnlOutflows');
  const kasaCategories = cats.filter((c) => c.section === 'kasaCategories');

  return c.json({
    company,
    inflows,
    outflows,
    nonPnlOutflows,
    kasaCategories,
    cells: cellsMap,
    bankAccounts: banks,
    kasaAccounts: kasas,
    kasaEntries,
    transfers,
    invoices,
    revaluations,
    notificationSettings: settings ?? {
      enabled: false,
      recipients: [],
      alertThresholdDays: 7,
      includeOverdue: true,
      includeDueSoon: true,
      includeUpcoming30: true,
      includeCashPosition: true,
      includeFxPositions: true,
      lastGeneratedAt: null,
      lastSentAt: null,
      cronSchedule: '0 9 * * 1-5',
    },
    archives,
  });
});

export default companies;
