/**
 * EmailRecipientDirectory — port (interface).
 *
 * /v1/email/send'in açık-relay engeli için alıcı doğrulama kaynağı:
 *   - findUserEmailByUsername: users tablosundan çağıranın kendi e-postası
 *     (meta.kind='test' kuralı).
 *   - isKnownEmployeeEmail: app_state_entities aynasındaki hrEmployees
 *     e-postalarından biri mi (normal gönderim kuralı).
 *
 * Concrete implementation:
 * infrastructure/persistence/PgEmailRecipientDirectory.ts
 */

export interface EmailRecipientDirectory {
  findUserEmailByUsername(username: string): Promise<string | null>;
  isKnownEmployeeEmail(email: string): Promise<boolean>;
}
