/**
 * PgEmployeeDocumentRepository — EmployeeDocumentRepository PG implementasyonu.
 *
 * Tablo: hr_employee_documents (041_hr_employee_documents.sql).
 * İçerik BYTEA. Tüm sorgular company_id ile scope'lanır (multi-tenant izolasyon).
 * Listeleme content SÜTUNUNU SEÇMEZ (bellek/bant korunur).
 */
import type {
  EmployeeDocumentContent,
  EmployeeDocumentMeta,
  EmployeeDocumentRepository,
  NewEmployeeDocumentInput,
} from '../../application/ports/EmployeeDocumentRepository.js';

import type { Queryable } from './Queryable.js';

interface MetaRow {
  id: number | string;
  company_id: number;
  employee_ref: string;
  category: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | string;
  note: string | null;
  uploaded_by: number | null;
  created_at: Date;
}

const META_COLS =
  'id, company_id, employee_ref, category, file_name, mime_type, ' +
  'size_bytes, note, uploaded_by, created_at';

function toMeta(row: MetaRow): EmployeeDocumentMeta {
  return {
    id: Number(row.id),
    companyId: row.company_id,
    employeeRef: row.employee_ref,
    category: row.category,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    note: row.note,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at.toISOString(),
  };
}

export class PgEmployeeDocumentRepository implements EmployeeDocumentRepository {
  constructor(private readonly pool: Queryable) {}

  async create(input: NewEmployeeDocumentInput): Promise<EmployeeDocumentMeta> {
    const res = await this.pool.query<MetaRow>(
      `INSERT INTO hr_employee_documents
         (company_id, employee_ref, category, file_name, mime_type, size_bytes, note, content, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${META_COLS}`,
      [
        input.companyId,
        input.employeeRef,
        input.category,
        input.fileName,
        input.mimeType,
        input.content.length,
        input.note,
        input.content,
        input.uploadedBy,
      ],
    );
    const row = res.rows[0];
    if (!row) throw new Error('hr_employee_documents INSERT satır döndürmedi');
    return toMeta(row);
  }

  async listByEmployee(
    companyId: number,
    employeeRef: string,
    category?: string,
  ): Promise<EmployeeDocumentMeta[]> {
    const params: unknown[] = [companyId, employeeRef];
    let where = 'company_id = $1 AND employee_ref = $2';
    if (category) {
      params.push(category);
      where += ` AND category = $3`;
    }
    const res = await this.pool.query<MetaRow>(
      `SELECT ${META_COLS} FROM hr_employee_documents
       WHERE ${where}
       ORDER BY created_at DESC, id DESC`,
      params,
    );
    return res.rows.map(toMeta);
  }

  async getContent(companyId: number, id: number): Promise<EmployeeDocumentContent | null> {
    const res = await this.pool.query<MetaRow & { content: Buffer }>(
      `SELECT ${META_COLS}, content FROM hr_employee_documents
       WHERE company_id = $1 AND id = $2`,
      [companyId, id],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { ...toMeta(row), content: row.content };
  }

  async delete(companyId: number, id: number): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM hr_employee_documents WHERE company_id = $1 AND id = $2`,
      [companyId, id],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
