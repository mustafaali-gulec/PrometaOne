/**
 * Hakediş event'inden yevmiye fişi üretimi (çift taraflı, idempotent).
 *
 * construction.hakedis/status_changed (approved|paid) → construction_journal_*.
 * Net tutar üzerinden (v1; KDV ayrıştırması follow-up). Tekrar gelen event 2.
 * fiş üretmez (UNIQUE company_id+progress_id+event_status + ON CONFLICT).
 *
 * Varsayılan Türk THP hesapları (gerektiğinde firma hesap planına göre revize):
 *   İşveren hakedişi  approved: B 120 Alıcılar        / A 600 Yurtiçi Satışlar
 *   İşveren hakedişi  paid    : B 102 Bankalar         / A 120 Alıcılar
 *   Taşeron hakedişi  approved: B 740 Hizmet Ür.Mal.   / A 320 Satıcılar
 *   Taşeron hakedişi  paid    : B 320 Satıcılar         / A 102 Bankalar
 */
import { transaction } from '../db.js';

export interface HakedisEventPayload {
  progressId?: unknown;
  companyId?: unknown;
  hakedisNo?: unknown;
  kind?: unknown;
  toStatus?: unknown;
  netPayable?: unknown;
  currency?: unknown;
}

interface Account {
  code: string;
  name: string;
}

function accountsFor(
  kind: string,
  status: string,
): { debit: Account; credit: Account; desc: string } | null {
  if (kind === 'employer' && status === 'approved') {
    return {
      debit: { code: '120', name: 'Alıcılar' },
      credit: { code: '600', name: 'Yurtiçi Satışlar' },
      desc: 'İşveren hakedişi tahakkuku',
    };
  }
  if (kind === 'employer' && status === 'paid') {
    return {
      debit: { code: '102', name: 'Bankalar' },
      credit: { code: '120', name: 'Alıcılar' },
      desc: 'İşveren hakedişi tahsilatı',
    };
  }
  if (kind === 'subcontractor' && status === 'approved') {
    return {
      debit: { code: '740', name: 'Hizmet Üretim Maliyeti' },
      credit: { code: '320', name: 'Satıcılar' },
      desc: 'Taşeron hakedişi tahakkuku',
    };
  }
  if (kind === 'subcontractor' && status === 'paid') {
    return {
      debit: { code: '320', name: 'Satıcılar' },
      credit: { code: '102', name: 'Bankalar' },
      desc: 'Taşeron hakedişi ödemesi',
    };
  }
  return null;
}

/** Hakediş event'inden idempotent yevmiye fişi. İlgili değilse sessizce çıkar. */
export async function createHakedisJournalEntry(p: HakedisEventPayload): Promise<boolean> {
  const progressId = Number(p.progressId);
  const companyId = Number(p.companyId);
  const status = typeof p.toStatus === 'string' ? p.toStatus : '';
  const kind = typeof p.kind === 'string' ? p.kind : '';
  const net = Number(p.netPayable);
  const currency = typeof p.currency === 'string' ? p.currency : 'TRY';
  const hakedisNo = typeof p.hakedisNo === 'string' ? p.hakedisNo : null;

  if (!Number.isFinite(progressId) || progressId <= 0) return false;
  if (!Number.isFinite(companyId) || companyId <= 0) return false;
  if (status !== 'approved' && status !== 'paid') return false;
  if (!Number.isFinite(net) || net <= 0) return false;

  const acc = accountsFor(kind, status);
  if (!acc) return false;

  return transaction(async (client) => {
    const ins = await client.query<{ id: number }>(
      `INSERT INTO construction_journal_entries
         (company_id, progress_id, hakedis_no, kind, event_status, description, total, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (company_id, progress_id, event_status) DO NOTHING
       RETURNING id`,
      [
        companyId,
        progressId,
        hakedisNo,
        kind,
        status,
        `${acc.desc} (${hakedisNo ?? progressId})`,
        net,
        currency,
      ],
    );
    const entryId = ins.rows[0]?.id;
    if (entryId === undefined) return false; // zaten var (idempotent)

    await client.query(
      `INSERT INTO construction_journal_lines (entry_id, account_code, account_name, debit, credit)
       VALUES ($1,$2,$3,$4,0), ($1,$5,$6,0,$4)`,
      [entryId, acc.debit.code, acc.debit.name, net, acc.credit.code, acc.credit.name],
    );
    return true;
  });
}
