/**
 * LinkedInAccess — bağlantıyı yükleyip sırrını çözen ve gerekiyorsa access
 * token'ı yenileyen ortak erişim yardımcısı.
 *
 * Her use-case'in aynı 4 adımı (bul → çöz → süre kontrolü → yenile) tekrar
 * etmemesi için tek yerde toplandı. Yenileme başarılı olursa yeni token
 * ŞİFRELİ olarak geri yazılır — sonraki istek tekrar yenilemez.
 */
import type { Clock } from '../../../application/ports/Clock.js';
import type {
  LinkedInConnection,
  LinkedInCredentialConfig,
} from '../../domain/entities/LinkedInConnection.js';
import {
  LinkedInConnectionNotFoundError,
  LinkedInNotConnectedError,
  LinkedInTokenExpiredError,
} from '../../domain/errors/LinkedInErrors.js';
import type { CredentialCipher } from '../ports/CredentialCipher.js';
import type { LinkedInProvider } from '../ports/LinkedInProvider.js';
import type { LinkedInConnectionRepository } from '../ports/LinkedInRepositories.js';

export interface ResolvedConnection {
  connection: LinkedInConnection;
  config: LinkedInCredentialConfig;
}

export class LinkedInAccess {
  constructor(
    private readonly connections: LinkedInConnectionRepository,
    private readonly cipher: CredentialCipher,
    private readonly provider: LinkedInProvider,
    private readonly clock: Clock,
  ) {}

  /** Bağlantı + çözülmüş config; token yenilemesi YAPILMAZ. */
  async load(companyId: number): Promise<ResolvedConnection> {
    const row = await this.connections.findByCompanyWithSecret(companyId);
    if (row === null) throw new LinkedInConnectionNotFoundError(companyId);
    return { connection: row.connection, config: this.cipher.decrypt(row.encrypted) };
  }

  /** Bağlantı yoksa null döner (hata fırlatmaz) — public/feed yolları için. */
  async loadOrNull(companyId: number): Promise<ResolvedConnection | null> {
    const row = await this.connections.findByCompanyWithSecret(companyId);
    if (row === null) return null;
    return { connection: row.connection, config: this.cipher.decrypt(row.encrypted) };
  }

  /**
   * Şirket sayfasına yazacak çağrılar için: yetkilendirilmiş, süresi geçerli
   * bir access token garanti eder. Süresi dolmuşsa refresh token ile yeniler;
   * refresh yoksa kullanıcıyı yeniden yetkilendirmeye yönlendirir.
   */
  async loadAuthorized(companyId: number): Promise<ResolvedConnection> {
    const { connection, config } = await this.load(companyId);
    return this.ensureAuthorized(companyId, connection, config);
  }

  /**
   * `loadAuthorized`'ın zaten yüklenmiş bağlantı üzerinde çalışan hâli —
   * kanal listesi bağlantıdan türetildiği için ikinci bir DB okuması gerekmez.
   */
  async ensureAuthorized(
    companyId: number,
    connection: LinkedInConnection,
    config: LinkedInCredentialConfig,
  ): Promise<ResolvedConnection> {
    if (config.accessToken === undefined || config.accessToken === '') {
      throw new LinkedInNotConnectedError();
    }
    if (!connection.isTokenExpired(this.clock.now())) return { connection, config };

    if (config.refreshToken === undefined || config.refreshToken === '') {
      throw new LinkedInTokenExpiredError();
    }

    const tokens = await this.provider.refreshAccessToken({
      config,
      refreshToken: config.refreshToken,
    });
    const next: LinkedInCredentialConfig = {
      ...config,
      accessToken: tokens.accessToken,
      ...(tokens.refreshToken !== undefined ? { refreshToken: tokens.refreshToken } : {}),
    };
    const expiresAt = new Date(this.clock.now().getTime() + tokens.expiresInSeconds * 1000);
    await this.connections.updateSecret(companyId, this.cipher.encrypt(next), expiresAt);

    return { connection, config: next };
  }
}
