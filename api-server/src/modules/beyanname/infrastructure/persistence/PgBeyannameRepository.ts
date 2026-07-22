/**
 * PgBeyannameRepository — beyannameler + beyanname_islem_log (049).
 * snake_case satır → camelCase BeyannameRecord dönüşümü; JSONB alanlar direkt.
 */
import type {
  BeyannamePayload,
  BeyannameRecord,
  CreateDeclarationInput,
  ListDeclarationsFilter,
} from '../../application/dto/BeyannameDtos.js';
import type {
  BeyannameLogEntry,
  BeyannamePatch,
  BeyannameRepository,
} from '../../application/ports/BeyannameRepositories.js';

import type { Queryable } from './Queryable.js';

interface BeyannameRow {
  id: number;
  company_id: number;
  tur: string;
  donem_yil: number;
  donem_ay: string;
  donem_tip: string;
  vergi_dairesi_kod: string | null;
  vergi_dairesi_ad: string | null;
  duzeltme_mi: boolean;
  durum: string;
  gib_beyanname_id: string | null;
  gib_durum: string | null;
  payload: BeyannamePayload | null;
  kontrol_sonucu: unknown;
  onay_sonucu: unknown;
  son_hata: unknown;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, tur, donem_yil, donem_ay, donem_tip, vergi_dairesi_kod, ' +
  'vergi_dairesi_ad, duzeltme_mi, durum, gib_beyanname_id, gib_durum, payload, ' +
  'kontrol_sonucu, onay_sonucu, son_hata, created_by, created_at, updated_at';

export class PgBeyannameRepository implements BeyannameRepository {
  constructor(private readonly db: Queryable) {}

  async list(companyId: number, filter: ListDeclarationsFilter): Promise<BeyannameRecord[]> {
    const params: unknown[] = [companyId];
    const clauses = ['company_id = $1'];
    if (filter.durum !== undefined) {
      params.push(filter.durum);
      clauses.push(`durum = $${params.length}`);
    }
    if (filter.yil !== undefined) {
      params.push(filter.yil);
      clauses.push(`donem_yil = $${params.length}`);
    }
    const r = await this.db.query<BeyannameRow>(
      `SELECT ${COLS} FROM beyannameler
        WHERE ${clauses.join(' AND ')}
        ORDER BY donem_yil DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToRecord);
  }

  async getById(companyId: number, id: number): Promise<BeyannameRecord | null> {
    const r = await this.db.query<BeyannameRow>(
      `SELECT ${COLS} FROM beyannameler WHERE company_id = $1 AND id = $2 LIMIT 1`,
      [companyId, id],
    );
    const row = r.rows[0];
    return row ? rowToRecord(row) : null;
  }

  async create(input: CreateDeclarationInput): Promise<BeyannameRecord> {
    const r = await this.db.query<BeyannameRow>(
      `INSERT INTO beyannameler
         (company_id, tur, donem_yil, donem_ay, donem_tip, vergi_dairesi_kod,
          vergi_dairesi_ad, duzeltme_mi, payload, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.tur ?? 'KDV1',
        input.donem.yil,
        input.donem.ay,
        input.donem.tip,
        input.vergiDairesiKod ?? null,
        input.vergiDairesiAd ?? null,
        input.duzeltmeMi ?? false,
        JSON.stringify(input.payload ?? {}),
        input.createdBy ?? null,
      ],
    );
    return rowToRecord(r.rows[0]!);
  }

  async update(companyId: number, id: number, patch: BeyannamePatch): Promise<BeyannameRecord> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (col: string, val: unknown): void => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (patch.donem !== undefined) {
      push('donem_yil', patch.donem.yil);
      push('donem_ay', patch.donem.ay);
      push('donem_tip', patch.donem.tip);
    }
    if (patch.vergiDairesiKod !== undefined) push('vergi_dairesi_kod', patch.vergiDairesiKod);
    if (patch.vergiDairesiAd !== undefined) push('vergi_dairesi_ad', patch.vergiDairesiAd);
    if (patch.duzeltmeMi !== undefined) push('duzeltme_mi', patch.duzeltmeMi);
    if (patch.durum !== undefined) push('durum', patch.durum);
    if (patch.gibBeyannameId !== undefined) push('gib_beyanname_id', patch.gibBeyannameId);
    if (patch.gibDurum !== undefined) push('gib_durum', patch.gibDurum);
    if (patch.payload !== undefined) push('payload', JSON.stringify(patch.payload));
    if (patch.kontrolSonucu !== undefined)
      push('kontrol_sonucu', JSON.stringify(patch.kontrolSonucu));
    if (patch.onaySonucu !== undefined) push('onay_sonucu', JSON.stringify(patch.onaySonucu));
    if (patch.sonHata !== undefined) push('son_hata', JSON.stringify(patch.sonHata));

    if (sets.length === 0) {
      const cur = await this.getById(companyId, id);
      if (cur === null) throw new Error(`beyanname ${id} bulunamadı`);
      return cur;
    }
    params.push(companyId, id);
    const r = await this.db.query<BeyannameRow>(
      `UPDATE beyannameler SET ${sets.join(', ')}, updated_at = NOW()
        WHERE company_id = $${params.length - 1} AND id = $${params.length}
        RETURNING ${COLS}`,
      params,
    );
    return rowToRecord(r.rows[0]!);
  }

  async remove(companyId: number, id: number): Promise<void> {
    await this.db.query(`DELETE FROM beyannameler WHERE company_id = $1 AND id = $2`, [
      companyId,
      id,
    ]);
  }

  async appendLog(entry: BeyannameLogEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO beyanname_islem_log
         (company_id, beyanname_id, islem, gib_endpoint, http_status, trace_id, mesajlar, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        entry.companyId,
        entry.beyannameId ?? null,
        entry.islem,
        entry.gibEndpoint ?? null,
        entry.httpStatus ?? null,
        entry.traceId ?? null,
        entry.mesajlar === undefined ? null : JSON.stringify(entry.mesajlar),
        entry.createdBy ?? null,
      ],
    );
  }
}

function rowToRecord(row: BeyannameRow): BeyannameRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    tur: row.tur,
    donem: {
      yil: row.donem_yil,
      ay: row.donem_ay,
      tip: row.donem_tip as 'AYLIK' | 'UC_AYLIK',
    },
    vergiDairesiKod: row.vergi_dairesi_kod,
    vergiDairesiAd: row.vergi_dairesi_ad,
    duzeltmeMi: row.duzeltme_mi,
    durum: row.durum as BeyannameRecord['durum'],
    gibBeyannameId: row.gib_beyanname_id,
    gibDurum: row.gib_durum,
    payload: row.payload ?? {},
    kontrolSonucu: row.kontrol_sonucu ?? null,
    onaySonucu: row.onay_sonucu ?? null,
    sonHata: row.son_hata ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
