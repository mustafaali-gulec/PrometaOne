/**
 * PgEInvoiceCredentialRepository — einvoice_credentials (016).
 * Şifreli config BYTEA (ciphertext/iv/tag) saklanır; decrypt use-case'te
 * CredentialCipher ile yapılır (repo plaintext görmez).
 */
import type { Queryable } from '../../../infrastructure/persistence/Queryable.js';
import type { EncryptedCredential } from '../../application/ports/CredentialCipher.js';
import type {
  EInvoiceCredentialRepository,
  SaveCredentialInput,
} from '../../application/ports/EInvoiceRepositories.js';
import { EInvoiceCredential } from '../../domain/entities/EInvoiceCredential.js';
import { toProviderType, type ProviderType } from '../../domain/valueObjects/ProviderType.js';

interface CredentialRow {
  id: number;
  company_id: number;
  provider: string;
  is_active: boolean;
  auto_sync_enabled: boolean;
  auto_sync_cron: string;
  last_sync_at: Date | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  last_sync_incoming: number;
  last_sync_outgoing: number;
  created_at: Date;
  updated_at: Date;
}

const META_COLS =
  'id, company_id, provider, is_active, auto_sync_enabled, auto_sync_cron, ' +
  'last_sync_at, last_sync_status, last_sync_message, last_sync_incoming, ' +
  'last_sync_outgoing, created_at, updated_at';

export class PgEInvoiceCredentialRepository implements EInvoiceCredentialRepository {
  constructor(private readonly db: Queryable) {}

  async save(input: SaveCredentialInput): Promise<EInvoiceCredential> {
    const r = await this.db.query<CredentialRow>(
      `INSERT INTO einvoice_credentials
         (company_id, provider, config_encrypted, config_iv, config_tag,
          auto_sync_enabled, auto_sync_cron, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'0 6 * * *'),$8)
       ON CONFLICT (company_id, provider) DO UPDATE SET
         config_encrypted = EXCLUDED.config_encrypted,
         config_iv = EXCLUDED.config_iv,
         config_tag = EXCLUDED.config_tag,
         auto_sync_enabled = EXCLUDED.auto_sync_enabled,
         auto_sync_cron = EXCLUDED.auto_sync_cron,
         is_active = TRUE,
         updated_at = NOW()
       RETURNING ${META_COLS}`,
      [
        input.companyId,
        input.provider,
        input.encrypted.ciphertext,
        input.encrypted.iv,
        input.encrypted.tag,
        input.autoSyncEnabled ?? false,
        input.autoSyncCron ?? null,
        input.createdBy ?? null,
      ],
    );
    return rowToCredential(r.rows[0]!);
  }

  async findByProvider(
    companyId: number,
    provider: ProviderType,
  ): Promise<EInvoiceCredential | null> {
    const r = await this.db.query<CredentialRow>(
      `SELECT ${META_COLS} FROM einvoice_credentials
        WHERE company_id = $1 AND provider = $2 LIMIT 1`,
      [companyId, provider],
    );
    const row = r.rows[0];
    return row ? rowToCredential(row) : null;
  }

  async getEncrypted(
    companyId: number,
    provider: ProviderType,
  ): Promise<EncryptedCredential | null> {
    const r = await this.db.query<{
      config_encrypted: Buffer;
      config_iv: Buffer;
      config_tag: Buffer;
    }>(
      `SELECT config_encrypted, config_iv, config_tag FROM einvoice_credentials
        WHERE company_id = $1 AND provider = $2 LIMIT 1`,
      [companyId, provider],
    );
    const row = r.rows[0];
    return row
      ? { ciphertext: row.config_encrypted, iv: row.config_iv, tag: row.config_tag }
      : null;
  }

  async update(credential: EInvoiceCredential): Promise<void> {
    const j = credential.toJSON();
    await this.db.query(
      `UPDATE einvoice_credentials SET
         is_active = $1, auto_sync_enabled = $2, auto_sync_cron = $3,
         last_sync_at = $4, last_sync_status = $5, last_sync_message = $6,
         last_sync_incoming = $7, last_sync_outgoing = $8, updated_at = NOW()
       WHERE company_id = $9 AND provider = $10`,
      [
        j.isActive,
        j.autoSyncEnabled,
        j.autoSyncCron,
        j.lastSyncAt,
        j.lastSyncStatus,
        j.lastSyncMessage,
        j.lastSyncIncoming,
        j.lastSyncOutgoing,
        credential.companyId,
        credential.provider,
      ],
    );
  }

  async remove(companyId: number, provider: ProviderType): Promise<void> {
    await this.db.query(
      `DELETE FROM einvoice_credentials WHERE company_id = $1 AND provider = $2`,
      [companyId, provider],
    );
  }
}

function rowToCredential(row: CredentialRow): EInvoiceCredential {
  return EInvoiceCredential.create({
    id: row.id,
    companyId: row.company_id,
    provider: toProviderType(row.provider),
    isActive: row.is_active,
    autoSyncEnabled: row.auto_sync_enabled,
    autoSyncCron: row.auto_sync_cron,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status,
    lastSyncMessage: row.last_sync_message,
    lastSyncIncoming: row.last_sync_incoming,
    lastSyncOutgoing: row.last_sync_outgoing,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
