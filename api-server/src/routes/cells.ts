/**
 * Cells & Categories route'ları.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { pool, queryMany, queryOne, transaction } from '../db.js';
import { logAudit } from '../middleware/audit.js';
import { authMiddleware, requireCompanyAccess } from '../middleware/auth.js';

const router = new Hono();
router.use('*', authMiddleware);

// ============== CATEGORIES ==============
router.get('/:cid/categories', requireCompanyAccess('viewer'), async (c) => {
  const cid = Number(c.req.param('cid'));
  const section = c.req.query('section');
  let sql = `SELECT id, company_id AS "companyId", section, name, sort_order AS "sortOrder"
               FROM categories WHERE company_id = $1`;
  const params: any[] = [cid];
  if (section) {
    sql += ` AND section = $2`;
    params.push(section);
  }
  sql += ` ORDER BY section, sort_order`;
  return c.json(await queryMany(sql, params));
});

router.post(
  '/:cid/categories',
  requireCompanyAccess('cfo'),
  zValidator(
    'json',
    z.object({
      section: z.enum(['inflows', 'outflows', 'nonPnlOutflows', 'kasaCategories']),
      name: z.string().min(1),
    }),
  ),
  async (c) => {
    const cid = Number(c.req.param('cid'));
    const data = c.req.valid('json');

    // Sıralama: section'da maks sort_order + 1
    const max = await queryOne<{ max: number | null }>(
      `SELECT MAX(sort_order) AS max FROM categories WHERE company_id = $1 AND section = $2`,
      [cid, data.section],
    );
    const sortOrder = (max?.max ?? 0) + 1;

    const result = await queryOne(
      `INSERT INTO categories (company_id, section, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, company_id AS "companyId", section, name, sort_order AS "sortOrder"`,
      [cid, data.section, data.name, sortOrder],
    );
    await logAudit(c, 'category_create', { section: data.section, name: data.name }, cid);
    return c.json(result, 201);
  },
);

router.patch(
  '/:cid/categories/:id',
  requireCompanyAccess('cfo'),
  zValidator('json', z.object({ name: z.string().min(1).optional() })),
  async (c) => {
    const cid = Number(c.req.param('cid'));
    const id = Number(c.req.param('id'));
    const data = c.req.valid('json');

    const result = await queryOne(
      `UPDATE categories SET name = COALESCE($1, name)
       WHERE id = $2 AND company_id = $3
       RETURNING id, company_id AS "companyId", section, name, sort_order AS "sortOrder"`,
      [data.name, id, cid],
    );
    if (!result) throw new HTTPException(404, { message: 'Kategori bulunamadı' });
    await logAudit(c, 'category_update', { id, changes: data }, cid);
    return c.json(result);
  },
);

router.delete('/:cid/categories/:id', requireCompanyAccess('cfo'), async (c) => {
  const cid = Number(c.req.param('cid'));
  const id = Number(c.req.param('id'));
  const result = await pool.query(`DELETE FROM categories WHERE id = $1 AND company_id = $2`, [
    id,
    cid,
  ]);
  if (result.rowCount === 0) {
    throw new HTTPException(404, { message: 'Kategori bulunamadı' });
  }
  await logAudit(c, 'category_delete', { id }, cid);
  return new Response(null, { status: 204 });
});

// ============== CELLS ==============

/** GET tüm hücreler */
router.get('/:cid/cells', requireCompanyAccess('viewer'), async (c) => {
  const cid = Number(c.req.param('cid'));
  const fy =
    Number(c.req.query('fiscalYear')) ||
    (await queryOne<{ fy: number }>(`SELECT fiscal_year AS fy FROM companies WHERE id = $1`, [cid]))
      ?.fy;
  if (!fy) throw new HTTPException(400, { message: 'fiscalYear belirlenemedi' });

  const rows = await queryMany<{ category_id: number; month_idx: number; value: number }>(
    `SELECT category_id, month_idx, value::float AS value
       FROM cells WHERE company_id = $1 AND fiscal_year = $2`,
    [cid, fy],
  );
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[`${row.category_id}:${row.month_idx}`] = row.value;
  }
  return c.json(map);
});

/** Bulk PUT */
router.put(
  '/:cid/cells',
  requireCompanyAccess('editor'),
  zValidator(
    'json',
    z.object({
      cells: z.record(z.string(), z.number()),
      fiscalYear: z.number().int().optional(),
    }),
  ),
  async (c) => {
    const authCtx = c.get('auth');
    const cid = Number(c.req.param('cid'));
    const { cells: cellsData, fiscalYear } = c.req.valid('json');
    const fy =
      fiscalYear ??
      (
        await queryOne<{ fy: number }>(`SELECT fiscal_year AS fy FROM companies WHERE id = $1`, [
          cid,
        ])
      )?.fy;
    if (!fy) throw new HTTPException(400, { message: 'fiscalYear belirlenemedi' });

    let updated = 0;
    await transaction(async (client) => {
      for (const [key, value] of Object.entries(cellsData)) {
        const [catIdStr, monthIdxStr] = key.split(':');
        const categoryId = Number(catIdStr);
        const monthIdx = Number(monthIdxStr);
        if (!categoryId || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) continue;

        if (value === 0 || value === null || value === undefined) {
          await client.query(
            `DELETE FROM cells WHERE company_id = $1 AND category_id = $2
             AND fiscal_year = $3 AND month_idx = $4`,
            [cid, categoryId, fy, monthIdx],
          );
        } else {
          await client.query(
            `INSERT INTO cells (company_id, category_id, fiscal_year, month_idx, value, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (company_id, category_id, fiscal_year, month_idx)
             DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
            [cid, categoryId, fy, monthIdx, value, authCtx.userId],
          );
        }
        updated++;
      }
    });

    await logAudit(c, 'cells_bulk_update', { count: updated, fiscalYear: fy }, cid);
    return new Response(null, { status: 204 });
  },
);

/** Tek hücre PUT */
router.put(
  '/:cid/cells/:categoryId/:monthIdx',
  requireCompanyAccess('editor'),
  zValidator('json', z.object({ value: z.number() })),
  async (c) => {
    const authCtx = c.get('auth');
    const cid = Number(c.req.param('cid'));
    const categoryId = Number(c.req.param('categoryId'));
    const monthIdx = Number(c.req.param('monthIdx'));
    const { value } = c.req.valid('json');

    const fy = (
      await queryOne<{ fy: number }>(`SELECT fiscal_year AS fy FROM companies WHERE id = $1`, [cid])
    )?.fy;
    if (!fy) throw new HTTPException(400, { message: 'fiscalYear belirlenemedi' });

    if (value === 0) {
      await pool.query(
        `DELETE FROM cells WHERE company_id = $1 AND category_id = $2
         AND fiscal_year = $3 AND month_idx = $4`,
        [cid, categoryId, fy, monthIdx],
      );
    } else {
      await pool.query(
        `INSERT INTO cells (company_id, category_id, fiscal_year, month_idx, value, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (company_id, category_id, fiscal_year, month_idx)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [cid, categoryId, fy, monthIdx, value, authCtx.userId],
      );
    }

    await logAudit(c, 'cell_update', { categoryId, monthIdx, value, fiscalYear: fy }, cid);
    return new Response(null, { status: 204 });
  },
);

export default router;
