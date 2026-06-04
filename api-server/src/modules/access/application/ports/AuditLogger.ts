/**
 * AuditLogger — access aksiyonlarını audit_logs tablosuna yazmak için port.
 *
 * HR modülündeki AuditLogger ile AYNI sözleşme; concrete implementasyon aynı
 * `audit_logs` tablosuna yazar (PgAuditLogger). Aksiyon kodları
 * 'access.role.created', 'access.grant.created', 'access.override.created' gibi.
 */
export interface AuditEntry {
  /** İşlemi yapan kullanıcının id'si (system aksiyonu için null). */
  actorUserId: number | null;
  /** İşlemi yapan kullanıcının username'i (silinme sonrası iz için denormalize). */
  actorUsername: string | null;
  /** Bağlamdaki şirket. */
  companyId: number;
  /** Aksiyon kodu. Örn: 'access.role.created'. Dot-separated namespacing. */
  action: string;
  /** Aksiyonla ilgili structured detaylar. */
  details: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Aksiyonun gerçekleştiği zaman. Use-case clock.now() ile doldurur. */
  at?: Date;
}

export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
}
