/**
 * PgLinkedInConnectionRepository — hr_linkedin_connections (053).
 *
 * Şifreli config BYTEA (ciphertext/iv/tag) saklanır; çözme use-case'te
 * CredentialCipher ile yapılır — repo düz metin GÖRMEZ.
 *
 * id BIGSERIAL olduğu için node-pg string döner → Number() ile daraltılır
 * (katı karşılaştırmalar sessizce bozulmasın).
 */
import type { Queryable } from '../../../infrastructure/persistence/Queryable.js';
import type { EncryptedCredential } from '../../application/ports/CredentialCipher.js';
import type {
  LinkedInConnectionRepository,
  SaveConnectionInput,
} from '../../application/ports/LinkedInRepositories.js';
import { LinkedInConnection } from '../../domain/entities/LinkedInConnection.js';
import { normalizeChannels } from '../../domain/valueObjects/LinkedInChannel.js';

interface ConnectionRow {
  id: string | number;
  company_id: number;
  organization_urn: string | null;
  organization_name: string | null;
  token_expires_at: Date | null;
  auto_publish: boolean;
  channels: string[] | null;
  feed_token: string | null;
  career_site_base_url: string | null;
  is_active: boolean;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SecretRow extends ConnectionRow {
  config_encrypted: Buffer;
  config_iv: Buffer;
  config_tag: Buffer;
}

const META_COLS =
  'id, company_id, organization_urn, organization_name, token_expires_at, auto_publish, ' +
  'channels, feed_token, career_site_base_url, is_active, last_error, created_at, updated_at';

const SECRET_COLS = `${META_COLS}, config_encrypted, config_iv, config_tag`;

function rowToConnection(row: ConnectionRow): LinkedInConnection {
  return LinkedInConnection.create({
    id: Number(row.id),
    companyId: Number(row.company_id),
    organizationUrn: row.organization_urn,
    organizationName: row.organization_name,
    tokenExpiresAt: row.token_expires_at,
    autoPublish: row.auto_publish,
    channels: normalizeChannels(row.channels ?? []),
    feedToken: row.feed_token,
    careerSiteBaseUrl: row.career_site_base_url,
    isActive: row.is_active,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowToEncrypted(row: SecretRow): EncryptedCredential {
  return { ciphertext: row.config_encrypted, iv: row.config_iv, tag: row.config_tag };
}

export class PgLinkedInConnectionRepository implements LinkedInConnectionRepository {
  constructor(private readonly db: Queryable) {}

  async findByCompany(companyId: number): Promise<LinkedInConnection | null> {
    const r = await this.db.query<ConnectionRow>(
      `SELECT ${META_COLS} FROM hr_linkedin_connections WHERE company_id = $1 LIMIT 1`,
      [companyId],
    );
    const row = r.rows[0];
    return row ? rowToConnection(row) : null;
  }

  async findByCompanyWithSecret(
    companyId: number,
  ): Promise<{ connection: LinkedInConnection; encrypted: EncryptedCredential } | null> {
    const r = await this.db.query<SecretRow>(
      `SELECT ${SECRET_COLS} FROM hr_linkedin_connections WHERE company_id = $1 LIMIT 1`,
      [companyId],
    );
    const row = r.rows[0];
    if (!row) return null;
    return { connection: rowToConnection(row), encrypted: rowToEncrypted(row) };
  }

  async findByFeedToken(
    feedToken: string,
  ): Promise<{ connection: LinkedInConnection; companyId: number } | null> {
    const r = await this.db.query<ConnectionRow>(
      `SELECT ${META_COLS} FROM hr_linkedin_connections WHERE feed_token = $1 LIMIT 1`,
      [feedToken],
    );
    const row = r.rows[0];
    if (!row) return null;
    return { connection: rowToConnection(row), companyId: Number(row.company_id) };
  }

  async upsert(input: SaveConnectionInput): Promise<LinkedInConnection> {
    const r = await this.db.query<ConnectionRow>(
      `INSERT INTO hr_linkedin_connections
         (company_id, config_encrypted, config_iv, config_tag, organization_urn,
          organization_name, token_expires_at, auto_publish, channels, feed_token,
          career_site_base_url, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10,$11,$12,$13)
       ON CONFLICT (company_id) DO UPDATE SET
         config_encrypted     = EXCLUDED.config_encrypted,
         config_iv            = EXCLUDED.config_iv,
         config_tag           = EXCLUDED.config_tag,
         organization_urn     = EXCLUDED.organization_urn,
         organization_name    = EXCLUDED.organization_name,
         token_expires_at     = EXCLUDED.token_expires_at,
         auto_publish         = EXCLUDED.auto_publish,
         channels             = EXCLUDED.channels,
         feed_token           = COALESCE(hr_linkedin_connections.feed_token, EXCLUDED.feed_token),
         career_site_base_url = EXCLUDED.career_site_base_url,
         is_active            = EXCLUDED.is_active,
         updated_at           = NOW()
       RETURNING ${META_COLS}`,
      [
        input.companyId,
        input.encrypted.ciphertext,
        input.encrypted.iv,
        input.encrypted.tag,
        input.organizationUrn,
        input.organizationName,
        input.tokenExpiresAt,
        input.autoPublish,
        input.channels,
        input.feedToken,
        input.careerSiteBaseUrl,
        input.isActive,
        input.createdBy,
      ],
    );
    return rowToConnection(r.rows[0]!);
  }

  async updateSecret(
    companyId: number,
    encrypted: EncryptedCredential,
    tokenExpiresAt: Date | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE hr_linkedin_connections
          SET config_encrypted = $2, config_iv = $3, config_tag = $4,
              token_expires_at = $5, updated_at = NOW()
        WHERE company_id = $1`,
      [companyId, encrypted.ciphertext, encrypted.iv, encrypted.tag, tokenExpiresAt],
    );
  }

  async recordError(companyId: number, message: string | null): Promise<void> {
    await this.db.query(
      `UPDATE hr_linkedin_connections SET last_error = $2, updated_at = NOW()
        WHERE company_id = $1`,
      [companyId, message],
    );
  }

  async delete(companyId: number): Promise<void> {
    await this.db.query(`DELETE FROM hr_linkedin_connections WHERE company_id = $1`, [companyId]);
  }
}
