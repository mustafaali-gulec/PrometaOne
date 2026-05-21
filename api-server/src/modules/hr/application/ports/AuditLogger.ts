/**
 * AuditLogger — HR aksiyonlarını audit_logs tablosuna yazmak için port.
 *
 * Concrete implementasyon `infrastructure/audit/PgAuditLogger.ts`'de
 * (PR 4'te) — şu an sadece interface. İleri fazlarda paylaşılabilir hâle
 * gelirse `shared/` altına taşınır.
 */
export interface AuditEntry {
  /** İşlemi yapan kullanıcının id'si (system aksiyonu için null). */
  actorUserId: number | null;
  /** İşlemi yapan kullanıcının username'i (silinme sonrası iz için denormalize). */
  actorUsername: string | null;
  /** Bağlamdaki şirket. */
  companyId: number;
  /**
   * Aksiyon kodu. Örn: 'hr.org_unit.created', 'hr.department.archived',
   * 'hr.employee.terminated'. Tutarlılık için dot-separated namespacing.
   */
  action: string;
  /** Aksiyonla ilgili structured detaylar (entity id'leri, before/after, vb.) */
  details: Record<string, unknown>;
  /** İsteğe bağlı IP / user-agent. */
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Aksiyonun gerçekleştiği zaman. Use-case clock.now() ile doldurur. */
  at?: Date;
}

export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
}
