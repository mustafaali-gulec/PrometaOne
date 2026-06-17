/**
 * PgPartyRepository — finance_parties (032).
 *
 * upsertMany / replaceAll kendi transaction'larını açar (pool.connect).
 * data kolonu JSONB; obje JSON.stringify ile yazılır, okunurken pg parse eder.
 */
import type { Pool, PoolClient } from 'pg';

import type { PartyRepository } from '../../application/ports/PartyRepository.js';
import { Party } from '../../domain/entities/Party.js';

interface PartyRow {
  id: string;
  company_id: number;
  code: string;
  name: string;
  type: string;
  person_type: string | null;
  tax_id: string | null;
  status: string;
  data: Record<string, unknown> | null;
}

const COLS = 'id, company_id, code, name, type, person_type, tax_id, status, data';

export class PgPartyRepository implements PartyRepository {
  constructor(private readonly pool: Pool) {}

  async listByCompany(companyId: number): Promise<Party[]> {
    const r = await this.pool.query<PartyRow>(
      `SELECT ${COLS} FROM finance_parties WHERE company_id = $1 ORDER BY code ASC`,
      [companyId],
    );
    return r.rows.map(rowToParty);
  }

  async upsertMany(records: ReadonlyArray<Party>): Promise<void> {
    if (records.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const p of records) await upsertOne(client, p);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async replaceAll(companyId: number, records: ReadonlyArray<Party>): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const del = await client.query('DELETE FROM finance_parties WHERE company_id = $1', [
        companyId,
      ]);
      for (const p of records) await upsertOne(client, p);
      await client.query('COMMIT');
      return del.rowCount ?? 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

function upsertOne(client: PoolClient, party: Party): Promise<unknown> {
  const j = party.toJSON();
  return client.query(
    `INSERT INTO finance_parties
       (id, company_id, code, name, type, person_type, tax_id, status, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (company_id, code) DO UPDATE SET
       name = EXCLUDED.name, type = EXCLUDED.type, person_type = EXCLUDED.person_type,
       tax_id = EXCLUDED.tax_id, status = EXCLUDED.status, data = EXCLUDED.data,
       updated_at = NOW()`,
    [
      j.id,
      j.companyId,
      j.code,
      j.name,
      j.type,
      j.personType,
      j.taxId,
      j.status,
      JSON.stringify(j.data ?? {}),
    ],
  );
}

function rowToParty(row: PartyRow): Party {
  return Party.create({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    type: row.type,
    personType: row.person_type,
    taxId: row.tax_id,
    status: row.status,
    data: row.data ?? {},
  });
}
