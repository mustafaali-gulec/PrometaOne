/**
 * LinkedIn bağlantı use-case'leri — kaydet / oku / test et / sil.
 *
 * Client secret ASLA istemciye dönmez; `toView()` yalnızca "tanımlı mı"
 * bayrağı verir. Secret gövdede boş bırakılırsa mevcut değer korunur (kısmi
 * güncelleme) — böylece kullanıcı yalnızca kanal ayarını değiştirebilir.
 */
import type { Clock } from '../../../application/ports/Clock.js';
import type {
  LinkedInConnectionView,
  LinkedInCredentialConfig,
} from '../../domain/entities/LinkedInConnection.js';
import { LinkedInConnectionNotFoundError } from '../../domain/errors/LinkedInErrors.js';
import type { LinkedInChannel } from '../../domain/valueObjects/LinkedInChannel.js';
import type { CredentialCipher } from '../ports/CredentialCipher.js';
import type { LinkedInProvider, LinkedInTestResult } from '../ports/LinkedInProvider.js';
import type { LinkedInConnectionRepository } from '../ports/LinkedInRepositories.js';
import type { TokenGenerator } from '../ports/TokenGenerator.js';
import type { LinkedInAccess } from '../services/LinkedInAccess.js';

export interface SaveLinkedInConnectionInput {
  companyId: number;
  /** Boş/verilmemişse mevcut değer korunur. */
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  organizationUrn?: string | null | undefined;
  organizationName?: string | null | undefined;
  autoPublish?: boolean | undefined;
  channels?: LinkedInChannel[] | undefined;
  careerSiteBaseUrl?: string | null | undefined;
  isActive?: boolean | undefined;
  actorId: number | null;
}

export class SaveLinkedInConnectionUseCase {
  constructor(
    private readonly connections: LinkedInConnectionRepository,
    private readonly cipher: CredentialCipher,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: SaveLinkedInConnectionInput): Promise<LinkedInConnectionView> {
    const existing = await this.connections.findByCompanyWithSecret(input.companyId);
    const prevConfig: LinkedInCredentialConfig =
      existing !== null
        ? this.cipher.decrypt(existing.encrypted)
        : { clientId: '', clientSecret: '' };

    // Boş gelen sır alanları mevcut değeri korur (kısmi güncelleme).
    const config: LinkedInCredentialConfig = {
      ...prevConfig,
      clientId:
        input.clientId !== undefined && input.clientId !== ''
          ? input.clientId
          : prevConfig.clientId,
      clientSecret:
        input.clientSecret !== undefined && input.clientSecret !== ''
          ? input.clientSecret
          : prevConfig.clientSecret,
    };

    // Client ID değiştiyse eski token artık geçersizdir — yeniden yetkilendirme gerekir.
    const clientChanged = config.clientId !== prevConfig.clientId;
    if (clientChanged) {
      delete config.accessToken;
      delete config.refreshToken;
    }

    const prev = existing?.connection ?? null;
    const saved = await this.connections.upsert({
      companyId: input.companyId,
      encrypted: this.cipher.encrypt(config),
      organizationUrn:
        input.organizationUrn !== undefined
          ? input.organizationUrn
          : (prev?.organizationUrn ?? null),
      organizationName:
        input.organizationName !== undefined
          ? input.organizationName
          : (prev?.organizationName ?? null),
      tokenExpiresAt: clientChanged ? null : (prev?.tokenExpiresAt ?? null),
      autoPublish: input.autoPublish ?? prev?.autoPublish ?? true,
      channels: input.channels ?? prev?.channels ?? ['share'],
      // Feed jetonu bir kez üretilir ve korunur — değişirse LinkedIn'deki kayıtlı
      // besleme URL'i kırılır.
      feedToken: prev?.feedToken ?? this.tokens.generate(24),
      careerSiteBaseUrl:
        input.careerSiteBaseUrl !== undefined
          ? input.careerSiteBaseUrl
          : (prev?.careerSiteBaseUrl ?? null),
      isActive: input.isActive ?? prev?.isActive ?? true,
      createdBy: input.actorId,
    });

    return saved.toView(config, this.clock.now());
  }
}

export interface GetLinkedInConnectionResult {
  connection: LinkedInConnectionView | null;
  /** Public XML besleme adresi — LinkedIn'e bu URL kaydettirilir. */
  feedUrl: string | null;
}

export class GetLinkedInConnectionUseCase {
  constructor(
    private readonly connections: LinkedInConnectionRepository,
    private readonly cipher: CredentialCipher,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    publicBaseUrl: string;
  }): Promise<GetLinkedInConnectionResult> {
    const row = await this.connections.findByCompanyWithSecret(input.companyId);
    if (row === null) return { connection: null, feedUrl: null };

    const config = this.cipher.decrypt(row.encrypted);
    const feedToken = row.connection.feedToken;
    return {
      connection: row.connection.toView(config, this.clock.now()),
      feedUrl:
        feedToken === null
          ? null
          : `${input.publicBaseUrl.replace(/\/+$/, '')}/v1/hr-jobs/feed.xml?token=${encodeURIComponent(feedToken)}`,
    };
  }
}

export class TestLinkedInConnectionUseCase {
  constructor(
    private readonly access: LinkedInAccess,
    private readonly provider: LinkedInProvider,
  ) {}

  async execute(input: { companyId: number }): Promise<LinkedInTestResult> {
    const { config } = await this.access.loadAuthorized(input.companyId);
    return this.provider.testConnection(config);
  }
}

export class DeleteLinkedInConnectionUseCase {
  constructor(private readonly connections: LinkedInConnectionRepository) {}

  async execute(input: { companyId: number }): Promise<void> {
    const existing = await this.connections.findByCompany(input.companyId);
    if (existing === null) throw new LinkedInConnectionNotFoundError(input.companyId);
    await this.connections.delete(input.companyId);
  }
}
