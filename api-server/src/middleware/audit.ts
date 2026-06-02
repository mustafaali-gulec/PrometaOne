/**
 * Audit log yardımcısı.
 * Önemli işlemlerden sonra çağrılır (login, fatura ekleme, vb.).
 */
import type { Context } from 'hono';

import { pool } from '../db.js';

export function logAudit(
  c: Context,
  action: string,
  details: Record<string, unknown> = {},
  companyId?: number | null,
): Promise<void> {
  const auth = c.get('auth');
  const userId = auth?.userId ?? null;
  const username = auth?.username ?? 'unknown';
  const cid = companyId ?? auth?.companyId ?? null;
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'unknown';
  const ua = c.req.header('user-agent') ?? null;

  // Fire-and-forget — audit hatası API'yi durdurmasın
  pool
    .query(
      `INSERT INTO audit_logs (user_id, username, company_id, action, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, username, cid, action, details, ip, ua],
    )
    .catch((err) => {
      console.error('Audit log yazılamadı:', err);
    });

  return Promise.resolve();
}
