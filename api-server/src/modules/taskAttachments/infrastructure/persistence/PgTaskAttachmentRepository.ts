/**
 * PgTaskAttachmentRepository — TaskAttachmentRepository PG implementasyonu.
 *
 * Tablo: task_attachments (050_task_attachments.sql).
 * İçerik BYTEA. Tüm sorgular company_id ile scope'lanır (multi-tenant izolasyon).
 * Listeleme content SÜTUNUNU SEÇMEZ (bellek/bant korunur).
 */
import type { Pool } from 'pg';

import type {
  NewTaskAttachmentInput,
  TaskAttachmentContent,
  TaskAttachmentMeta,
  TaskAttachmentRepository,
} from '../../application/ports/TaskAttachmentRepository.js';

interface MetaRow {
  id: number | string;
  company_id: number;
  task_ref: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | string;
  note: string | null;
  uploaded_by: number | null;
  created_at: Date;
}

const META_COLS =
  'id, company_id, task_ref, file_name, mime_type, size_bytes, note, uploaded_by, created_at';

function toMeta(row: MetaRow): TaskAttachmentMeta {
  return {
    id: Number(row.id),
    companyId: row.company_id,
    taskRef: row.task_ref,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    note: row.note,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at.toISOString(),
  };
}

export class PgTaskAttachmentRepository implements TaskAttachmentRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewTaskAttachmentInput): Promise<TaskAttachmentMeta> {
    const res = await this.pool.query<MetaRow>(
      `INSERT INTO task_attachments
         (company_id, task_ref, file_name, mime_type, size_bytes, note, content, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${META_COLS}`,
      [
        input.companyId,
        input.taskRef,
        input.fileName,
        input.mimeType,
        input.content.length,
        input.note,
        input.content,
        input.uploadedBy,
      ],
    );
    const row = res.rows[0];
    if (!row) throw new Error('task_attachments INSERT satır döndürmedi');
    return toMeta(row);
  }

  async listByTask(companyId: number, taskRef: string): Promise<TaskAttachmentMeta[]> {
    const res = await this.pool.query<MetaRow>(
      `SELECT ${META_COLS} FROM task_attachments
       WHERE company_id = $1 AND task_ref = $2
       ORDER BY created_at DESC, id DESC`,
      [companyId, taskRef],
    );
    return res.rows.map(toMeta);
  }

  async getContent(companyId: number, id: number): Promise<TaskAttachmentContent | null> {
    const res = await this.pool.query<MetaRow & { content: Buffer }>(
      `SELECT ${META_COLS}, content FROM task_attachments
       WHERE company_id = $1 AND id = $2`,
      [companyId, id],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { ...toMeta(row), content: row.content };
  }

  async delete(companyId: number, id: number): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM task_attachments WHERE company_id = $1 AND id = $2`,
      [companyId, id],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
