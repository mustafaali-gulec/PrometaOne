/**
 * PgBeyannameCredentialRepository — beyanname_credentials (049).
 * Şifreli config BYTEA (ciphertext/iv/tag) saklanır; decrypt use-case'te
 * CredentialCipher ile yapılır (repo plaintext görmez).
 */
import type {
  BeyannameCredentialRepository,
  SaveCredentialInput,
} from '../../application/ports/BeyannameRepositories.js';
import type { EncryptedCredential } from '../../application/ports/CredentialCipher.js';

import type { Queryable } from './Queryable.js';

export class PgBeyannameCredentialRepository implements BeyannameCredentialRepository {
  constructor(private readonly db: Queryable) {}

  async save(input: SaveCredentialInput): Promise<void> {
    await this.db.query(
      `INSERT INTO beyanname_credentials
         (company_id, config_encrypted, config_iv, config_tag, is_active, created_by)
       VALUES ($1,$2,$3,$4,TRUE,$5)
       ON CONFLICT (company_id) DO UPDATE SET
         config_encrypted = EXCLUDED.config_encrypted,
         config_iv = EXCLUDED.config_iv,
         config_tag = EXCLUDED.config_tag,
         is_active = TRUE,
         updated_at = NOW()`,
      [
        input.companyId,
        input.encrypted.ciphertext,
        input.encrypted.iv,
        input.encrypted.tag,
        input.createdBy ?? null,
      ],
    );
  }

  async getEncrypted(companyId: number): Promise<EncryptedCredential | null> {
    const r = await this.db.query<{
      config_encrypted: Buffer;
      config_iv: Buffer;
      config_tag: Buffer;
    }>(
      `SELECT config_encrypted, config_iv, config_tag FROM beyanname_credentials
        WHERE company_id = $1 AND is_active = TRUE LIMIT 1`,
      [companyId],
    );
    const row = r.rows[0];
    return row
      ? { ciphertext: row.config_encrypted, iv: row.config_iv, tag: row.config_tag }
      : null;
  }

  async getMeta(companyId: number): Promise<{ isActive: boolean; updatedAt: Date } | null> {
    const r = await this.db.query<{ is_active: boolean; updated_at: Date }>(
      `SELECT is_active, updated_at FROM beyanname_credentials WHERE company_id = $1 LIMIT 1`,
      [companyId],
    );
    const row = r.rows[0];
    return row ? { isActive: row.is_active, updatedAt: row.updated_at } : null;
  }

  async remove(companyId: number): Promise<void> {
    await this.db.query(`DELETE FROM beyanname_credentials WHERE company_id = $1`, [companyId]);
  }
}
