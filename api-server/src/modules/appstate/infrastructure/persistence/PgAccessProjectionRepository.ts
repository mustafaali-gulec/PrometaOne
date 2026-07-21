/**
 * PgAccessProjectionRepository — AccessProjectionMirror PG implementasyonu.
 * Tablolar: access_custom_roles / access_role_grants / access_permission_overrides
 * (021_access_rbac.sql + 046_access_projection.sql client_id kolonları).
 *
 * replaceAll TEK transaction'da (pool.connect() + BEGIN/COMMIT/ROLLBACK —
 * PgMirrorRepository kalıbı) ve YALNIZ projeksiyon-sahipli satırlara
 * (client_id IS NOT NULL) dokunur; access CRUD satırları (client_id IS NULL)
 * korunur. Akış:
 *
 *   0. companies lookup: var olmayan company_id'li satırlar FK ihlali yerine
 *      DÜŞÜRÜLÜR (console.error ile raporlanır) — projeksiyon asla PUT'u bozmaz.
 *   1. ROLLER — upsert + prune (id kararlılığı önemli: role serial id'sine
 *      CRUD grant'ları FK'yla bağlı olabilir, delete+reinsert onları süpürürdü):
 *        a) UPDATE ... WHERE client_id = $  (varsa güncelle, id sabit kalır)
 *        b) yoksa INSERT ... ON CONFLICT (company_id, name) DO UPDATE
 *           (aynı adlı CRUD rolü projeksiyon sahipliğine "devralınır")
 *        c) prune: client_id NOT IN (güncel küme) → sil (FK cascade grant'ları
 *           temizler). Boş projeksiyon → tüm projeksiyon rolleri gider.
 *   2. GRANT'LAR — doğal anahtarı yok → delete-all-then-insert (basit ve
 *      çakışmasız; serial id churn'ü ayna için kabul edilebilir). role_id,
 *      roleClientId → 1. adımda kurulan client→serial haritasından çözülür;
 *      çözülemeyen grant düşürülür.
 *   3. OVERRIDE'LAR — delete-all-then-insert + ON CONFLICT
 *      (company_id, username, resource, action) DO UPDATE (aynı doğal anahtarlı
 *      CRUD override'ı devralınır; deny/allow blob değerine çekilir).
 *
 * Bilinen sınır: rol UPDATE'i (1a) yeni adı aynı şirketteki BAŞKA bir satırın
 * adıyla çakıştırırsa unique ihlaliyle transaction geri alınır — hata üst
 * katmanda yutulur, ayna bir önceki tutarlı hâlinde kalır (kaynak-of-truth
 * blob olduğundan veri kaybı yoktur; bir sonraki PUT genelde düzeltir).
 */
import type { AccessProjectionMirror } from '../../application/ports/AccessProjectionMirror.js';
import type {
  AccessGrantProjection,
  AccessOverrideProjection,
  AccessProjection,
  AccessRoleProjection,
} from '../../domain/AccessProjection.js';

/** pg.PoolClient'ın burada kullanılan alt kümesi (testte mock'lanabilir). */
export interface AccessProjectionPoolClient {
  query(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<{ rows?: unknown[]; rowCount?: number | null }>;
  release(): void;
}

/** pg.Pool'un burada kullanılan alt kümesi. */
export interface AccessProjectionPool {
  connect(): Promise<AccessProjectionPoolClient>;
}

interface IdRow {
  id: number;
}

function firstIdOf(result: { rows?: unknown[] }): number | null {
  const row = result.rows?.[0] as IdRow | undefined;
  if (row === undefined) return null;
  const id = Number(row.id);
  return Number.isFinite(id) ? id : null;
}

export class PgAccessProjectionRepository implements AccessProjectionMirror {
  constructor(private readonly pool: AccessProjectionPool) {}

  async replaceAll(projection: AccessProjection): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 0) Var olan şirketler — FK ihlali yerine satır düşürme.
      const companiesRes = await client.query('SELECT id FROM companies');
      const knownCompanies = new Set((companiesRes.rows ?? []).map((r) => Number((r as IdRow).id)));
      const roles = projection.roles.filter((r) => knownCompanies.has(r.companyId));
      const grants = projection.grants.filter((g) => knownCompanies.has(g.companyId));
      const overrides = projection.overrides.filter((o) => knownCompanies.has(o.companyId));
      const dropped =
        projection.roles.length -
        roles.length +
        (projection.grants.length - grants.length) +
        (projection.overrides.length - overrides.length);
      if (dropped > 0) {
        console.error(
          `[appstate:access] ${dropped} satır düşürüldü (companies'te olmayan company_id) — blob şirket anahtarı sunucu şirketine haritalanamadı`,
        );
      }

      // 1) ROLLER — upsert (id kararlı) + prune.
      const roleIdByClient = await this.upsertRoles(client, roles);
      await client.query(
        `DELETE FROM access_custom_roles
          WHERE client_id IS NOT NULL AND NOT (client_id = ANY($1::text[]))`,
        [roles.map((r) => r.clientId)],
      );

      // 2) GRANT'LAR — delete-all-then-insert (client_id çakışması yapısal olarak yok).
      await client.query('DELETE FROM access_role_grants WHERE client_id IS NOT NULL');
      await this.insertGrants(client, grants, roleIdByClient);

      // 3) OVERRIDE'LAR — delete-all-then-insert + doğal-anahtar devralma.
      await client.query('DELETE FROM access_permission_overrides WHERE client_id IS NOT NULL');
      await this.insertOverrides(client, overrides);

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK hatası orijinal hatayı gölgelemesin
      }
      throw err;
    } finally {
      client.release();
    }
  }

  private async upsertRoles(
    client: AccessProjectionPoolClient,
    roles: readonly AccessRoleProjection[],
  ): Promise<Map<string, number>> {
    const roleIdByClient = new Map<string, number>();
    for (const role of roles) {
      const updated = await client.query(
        `UPDATE access_custom_roles
            SET company_id = $1, name = $2, description = $3, permissions = $4, updated_at = NOW()
          WHERE client_id = $5
          RETURNING id`,
        [role.companyId, role.name, role.description, role.permissions, role.clientId],
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        const inserted = await client.query(
          `INSERT INTO access_custom_roles (company_id, name, description, permissions, client_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (company_id, name)
           DO UPDATE SET description = EXCLUDED.description,
                         permissions = EXCLUDED.permissions,
                         client_id   = EXCLUDED.client_id,
                         updated_at  = NOW()
           RETURNING id`,
          [role.companyId, role.name, role.description, role.permissions, role.clientId],
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) roleIdByClient.set(role.clientId, id);
    }
    return roleIdByClient;
  }

  private async insertGrants(
    client: AccessProjectionPoolClient,
    grants: readonly AccessGrantProjection[],
    roleIdByClient: ReadonlyMap<string, number>,
  ): Promise<void> {
    let unresolved = 0;
    for (const grant of grants) {
      const roleId = roleIdByClient.get(grant.roleClientId);
      if (roleId === undefined) {
        unresolved += 1;
        continue; // rolü projeksiyonda olmayan grant — düşür
      }
      await client.query(
        `INSERT INTO access_role_grants
           (company_id, role_id, subject_type, subject_id, cascade, valid_from, valid_until, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          grant.companyId,
          roleId,
          grant.subjectType,
          grant.subjectId,
          grant.cascade,
          grant.validFrom,
          grant.validUntil,
          grant.clientId,
        ],
      );
    }
    if (unresolved > 0) {
      console.error(
        `[appstate:access] ${unresolved} grant düşürüldü (roleId projeksiyon rollerinde yok)`,
      );
    }
  }

  private async insertOverrides(
    client: AccessProjectionPoolClient,
    overrides: readonly AccessOverrideProjection[],
  ): Promise<void> {
    for (const o of overrides) {
      await client.query(
        `INSERT INTO access_permission_overrides
           (company_id, username, resource, action, allow, expires_at, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (company_id, username, resource, action)
         DO UPDATE SET allow      = EXCLUDED.allow,
                       expires_at = EXCLUDED.expires_at,
                       client_id  = EXCLUDED.client_id,
                       updated_at = NOW()`,
        [o.companyId, o.username, o.resource, o.action, o.allow, o.expiresAt, o.clientId],
      );
    }
  }
}
