/**
 * EmployeeDocumentRepository — özlük belge deposu portu.
 *
 * Belgeler company_id + employee_ref (blob çalışan id'si, SOFT ref) + category
 * ile scope'lanır. İçerik BYTEA olarak saklanır; listeleme İÇERİK DÖNMEZ
 * (yalnız metadata) — indirme ayrı çağrıyla akıtılır.
 */

/** Listeleme/oluşturma dönüşünde kullanılan metadata (içerik hariç). */
export interface EmployeeDocumentMeta {
  id: number;
  companyId: number;
  employeeRef: string;
  category: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  note: string | null;
  uploadedBy: number | null;
  createdAt: string; // ISO
}

/** İçerik + metadata (indirme için). */
export interface EmployeeDocumentContent extends EmployeeDocumentMeta {
  content: Buffer;
}

export interface NewEmployeeDocumentInput {
  companyId: number;
  employeeRef: string;
  category: string;
  fileName: string;
  mimeType: string | null;
  note: string | null;
  content: Buffer;
  uploadedBy: number | null;
}

export interface EmployeeDocumentRepository {
  /** Belge oluştur → metadata döner. */
  create(input: NewEmployeeDocumentInput): Promise<EmployeeDocumentMeta>;

  /** Bir çalışanın belgelerini listeler (metadata; category verilirse filtreler). */
  listByEmployee(
    companyId: number,
    employeeRef: string,
    category?: string,
  ): Promise<EmployeeDocumentMeta[]>;

  /** Tek belgeyi içerikle getirir (indirme). company_id ile scope'lu. */
  getContent(companyId: number, id: number): Promise<EmployeeDocumentContent | null>;

  /** Belgeyi siler → silindiyse true. company_id ile scope'lu. */
  delete(companyId: number, id: number): Promise<boolean>;
}
