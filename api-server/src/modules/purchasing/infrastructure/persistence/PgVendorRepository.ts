/**
 * PgVendorRepository — VendorRepository PG implementasyonu.
 * Tablo: vendors (022_purchasing.sql).
 */
import type {
  ListVendorsOptions,
  NewVendorInput,
  VendorRepository,
} from '../../application/ports/VendorRepository.js';
import { Vendor, type CariClass, type PersonType } from '../../domain/entities/Vendor.js';

import type { Queryable } from './Queryable.js';

interface VendorRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  tax_id: string | null;
  tax_office: string | null;
  address: string | null;
  person_type: PersonType;
  cari_class: CariClass;
  account_code: string | null;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, code, name, tax_id, tax_office, address, person_type, cari_class, account_code, active, created_by, created_at, updated_at';

export class PgVendorRepository implements VendorRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewVendorInput): Promise<Vendor> {
    const r = await this.db.query<VendorRow>(
      `INSERT INTO vendors
         (company_id, code, name, tax_id, tax_office, address, person_type, cari_class, account_code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.code,
        input.name,
        input.taxId,
        input.taxOffice,
        input.address,
        input.personType,
        input.cariClass,
        input.accountCode,
        input.createdBy,
      ],
    );
    return rowToVendor(r.rows[0]!);
  }

  async update(vendor: Vendor): Promise<void> {
    await this.db.query(
      `UPDATE vendors
         SET name = $1, tax_id = $2, tax_office = $3, address = $4, person_type = $5,
             cari_class = $6, account_code = $7, active = $8, updated_at = NOW()
       WHERE id = $9 AND company_id = $10`,
      [
        vendor.name,
        vendor.taxId,
        vendor.taxOffice,
        vendor.address,
        vendor.personType,
        vendor.cariClass,
        vendor.accountCode,
        vendor.active,
        vendor.id,
        vendor.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Vendor | null> {
    const r = await this.db.query<VendorRow>(
      `SELECT ${COLS} FROM vendors WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToVendor(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: ListVendorsOptions,
  ): Promise<ReadonlyArray<Vendor>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.includeInactive !== true) {
      conditions.push('active = TRUE');
    }
    if (options?.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }
    const r = await this.db.query<VendorRow>(
      `SELECT ${COLS} FROM vendors
        WHERE ${conditions.join(' AND ')}
        ORDER BY name ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToVendor);
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM vendors WHERE company_id = $1 AND code = $2`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.db.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }
}

function rowToVendor(row: VendorRow): Vendor {
  return Vendor.create({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    taxId: row.tax_id,
    taxOffice: row.tax_office,
    address: row.address,
    personType: row.person_type,
    cariClass: row.cari_class,
    accountCode: row.account_code,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
