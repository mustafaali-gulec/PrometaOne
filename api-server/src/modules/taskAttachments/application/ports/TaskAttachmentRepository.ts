/**
 * TaskAttachmentRepository — görev eki deposu portu.
 *
 * Ekler company_id + task_ref (blob görev id'si, SOFT ref) ile scope'lanır.
 * İçerik BYTEA olarak saklanır; listeleme İÇERİK DÖNMEZ (yalnız metadata) —
 * indirme ayrı çağrıyla akıtılır.
 */

/** Listeleme/oluşturma dönüşünde kullanılan metadata (içerik hariç). */
export interface TaskAttachmentMeta {
  id: number;
  companyId: number;
  taskRef: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  note: string | null;
  uploadedBy: number | null;
  createdAt: string; // ISO
}

/** İçerik + metadata (indirme için). */
export interface TaskAttachmentContent extends TaskAttachmentMeta {
  content: Buffer;
}

export interface NewTaskAttachmentInput {
  companyId: number;
  taskRef: string;
  fileName: string;
  mimeType: string | null;
  note: string | null;
  content: Buffer;
  uploadedBy: number | null;
}

export interface TaskAttachmentRepository {
  /** Ek oluştur → metadata döner. */
  create(input: NewTaskAttachmentInput): Promise<TaskAttachmentMeta>;

  /** Bir görevin eklerini listeler (metadata). */
  listByTask(companyId: number, taskRef: string): Promise<TaskAttachmentMeta[]>;

  /** Tek eki içerikle getirir (indirme). company_id ile scope'lu. */
  getContent(companyId: number, id: number): Promise<TaskAttachmentContent | null>;

  /** Eki siler → silindiyse true. company_id ile scope'lu. */
  delete(companyId: number, id: number): Promise<boolean>;
}
