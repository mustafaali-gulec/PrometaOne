/**
 * LinkedIn OAuth 2.0 use-case'leri — yetkilendirmeyi başlat / tamamla.
 *
 * Akış:
 *   1) StartLinkedInOAuth → imzalı `state` ile LinkedIn onay adresi üretilir,
 *      kullanıcı yeni pencerede oraya gider.
 *   2) LinkedIn `code` ile callback'e döner (bizim JWT'miz olmadan!) →
 *      CompleteLinkedInOAuth `state` imzasını doğrular, code'u token'a takas
 *      eder, token'ı ŞİFRELİ saklar ve yönetilebilen şirket sayfalarını çeker.
 *
 * Tek sayfa yönetiliyorsa otomatik seçilir — kullanıcı ekstra tıklamaz.
 */
import type { Clock } from '../../../application/ports/Clock.js';
import type { LinkedInCredentialConfig } from '../../domain/entities/LinkedInConnection.js';
import {
  LinkedInAuthError,
  LinkedInConnectionNotFoundError,
} from '../../domain/errors/LinkedInErrors.js';
import type { CredentialCipher } from '../ports/CredentialCipher.js';
import type { LinkedInOrganization, LinkedInProvider } from '../ports/LinkedInProvider.js';
import type { LinkedInConnectionRepository } from '../ports/LinkedInRepositories.js';
import type { OAuthStateCodec } from '../ports/OAuthStateCodec.js';

/** İlanı şirket sayfasına yazmak + yönetilen sayfaları listelemek için gereken izinler. */
export const DEFAULT_LINKEDIN_SCOPES = ['r_organization_admin', 'w_organization_social'] as const;

/** `state` imzasının geçerlilik süresi — kullanıcının onay ekranını tamamlaması için. */
const STATE_TTL_SECONDS = 15 * 60;

export class StartLinkedInOAuthUseCase {
  constructor(
    private readonly connections: LinkedInConnectionRepository,
    private readonly cipher: CredentialCipher,
    private readonly provider: LinkedInProvider,
    private readonly stateCodec: OAuthStateCodec,
    private readonly clock: Clock,
    private readonly scopes: readonly string[] = DEFAULT_LINKEDIN_SCOPES,
  ) {}

  async execute(input: {
    companyId: number;
    actorId: number | null;
    redirectUri: string;
  }): Promise<{ authorizeUrl: string }> {
    const row = await this.connections.findByCompanyWithSecret(input.companyId);
    if (row === null) throw new LinkedInConnectionNotFoundError(input.companyId);

    const config = this.cipher.decrypt(row.encrypted);
    if (config.clientId === '' || config.clientSecret === '') {
      throw new LinkedInAuthError(
        'Client ID / Client Secret kaydedilmemiş — önce LinkedIn uygulama bilgilerini kaydedin',
      );
    }

    const state = this.stateCodec.sign({
      companyId: input.companyId,
      actorId: input.actorId,
      exp: Math.floor(this.clock.now().getTime() / 1000) + STATE_TTL_SECONDS,
    });

    return {
      authorizeUrl: this.provider.buildAuthorizeUrl({
        clientId: config.clientId,
        redirectUri: input.redirectUri,
        state,
        scopes: this.scopes,
      }),
    };
  }
}

export interface CompleteLinkedInOAuthResult {
  companyId: number;
  organizations: LinkedInOrganization[];
  selectedOrganizationUrn: string | null;
}

export class CompleteLinkedInOAuthUseCase {
  constructor(
    private readonly connections: LinkedInConnectionRepository,
    private readonly cipher: CredentialCipher,
    private readonly provider: LinkedInProvider,
    private readonly stateCodec: OAuthStateCodec,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    code: string;
    state: string;
    redirectUri: string;
  }): Promise<CompleteLinkedInOAuthResult> {
    const payload = this.stateCodec.verify(input.state);
    const companyId = payload.companyId;

    const row = await this.connections.findByCompanyWithSecret(companyId);
    if (row === null) throw new LinkedInConnectionNotFoundError(companyId);

    const config = this.cipher.decrypt(row.encrypted);
    const tokens = await this.provider.exchangeCode({
      config,
      code: input.code,
      redirectUri: input.redirectUri,
    });

    const next: LinkedInCredentialConfig = {
      ...config,
      accessToken: tokens.accessToken,
      ...(tokens.refreshToken !== undefined ? { refreshToken: tokens.refreshToken } : {}),
    };
    const expiresAt = new Date(this.clock.now().getTime() + tokens.expiresInSeconds * 1000);
    await this.connections.updateSecret(companyId, this.cipher.encrypt(next), expiresAt);

    // Sayfa listesi alınamazsa yetkilendirme yine de başarılıdır — kullanıcı
    // sayfayı ayarlar ekranından elle seçebilir.
    let organizations: LinkedInOrganization[] = [];
    try {
      organizations = await this.provider.listOrganizations(next);
    } catch (err) {
      await this.connections.recordError(
        companyId,
        err instanceof Error ? err.message : String(err),
      );
    }

    // Tek sayfa varsa ve henüz seçim yapılmamışsa otomatik seç.
    let selected = row.connection.organizationUrn;
    const only = organizations.length === 1 ? organizations[0] : undefined;
    if (selected === null && only !== undefined) {
      await this.connections.upsert({
        companyId,
        encrypted: this.cipher.encrypt(next),
        organizationUrn: only.urn,
        organizationName: only.name,
        tokenExpiresAt: expiresAt,
        autoPublish: row.connection.autoPublish,
        channels: row.connection.channels,
        feedToken: row.connection.feedToken,
        careerSiteBaseUrl: row.connection.careerSiteBaseUrl,
        isActive: row.connection.isActive,
        createdBy: payload.actorId,
      });
      selected = only.urn;
    }

    if (organizations.length > 0) await this.connections.recordError(companyId, null);

    return { companyId, organizations, selectedOrganizationUrn: selected };
  }
}
