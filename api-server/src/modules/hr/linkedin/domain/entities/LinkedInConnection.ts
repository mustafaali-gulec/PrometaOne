/**
 * LinkedInConnection — bir şirketin LinkedIn işe alım entegrasyonu ayarları.
 *
 * Hassas alanlar (`LinkedInCredentialConfig`) DB'ye AES-256-GCM ile şifreli
 * yazılır (CredentialCipher port'u). Entity yalnızca metadata taşır; şifreli
 * blob'u persistence yönetir. `toJSON()` HİÇBİR sırrı dışarı vermez — yalnızca
 * "tanımlı mı" bayrakları döner.
 */
import type { LinkedInChannel } from '../valueObjects/LinkedInChannel.js';

/** LinkedIn'e gönderilen düz (şifresiz) erişim konfigürasyonu. */
export interface LinkedInCredentialConfig {
  /** LinkedIn Developer uygulamasının Client ID'si. */
  clientId: string;
  /** Client Secret — yalnızca token takası için sunucuda kullanılır. */
  clientSecret: string;
  /** OAuth 2.0 access token (yetkilendirme tamamlandıysa). */
  accessToken?: string;
  /** Refresh token — LinkedIn yalnızca bazı ürünlerde verir. */
  refreshToken?: string;
}

export interface LinkedInConnectionProps {
  id: number | null;
  companyId: number;
  organizationUrn: string | null;
  organizationName: string | null;
  tokenExpiresAt: Date | null;
  autoPublish: boolean;
  channels: LinkedInChannel[];
  feedToken: string | null;
  careerSiteBaseUrl: string | null;
  isActive: boolean;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** İstemciye dönen güvenli görünüm — sır yok, yalnızca durum. */
export interface LinkedInConnectionView {
  id: number | null;
  companyId: number;
  organizationUrn: string | null;
  organizationName: string | null;
  autoPublish: boolean;
  channels: LinkedInChannel[];
  careerSiteBaseUrl: string | null;
  isActive: boolean;
  lastError: string | null;
  /** Client ID/Secret kaydedilmiş mi (değerleri DÖNMEZ). */
  hasCredentials: boolean;
  /** OAuth tamamlanmış, geçerli access token var mı. */
  isAuthorized: boolean;
  tokenExpiresAt: string | null;
  tokenExpired: boolean;
  createdAt: string;
  updatedAt: string;
}

export class LinkedInConnection {
  private constructor(private readonly props: LinkedInConnectionProps) {}

  static create(props: LinkedInConnectionProps): LinkedInConnection {
    return new LinkedInConnection(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get organizationUrn(): string | null {
    return this.props.organizationUrn;
  }
  get organizationName(): string | null {
    return this.props.organizationName;
  }
  get autoPublish(): boolean {
    return this.props.autoPublish;
  }
  get channels(): LinkedInChannel[] {
    return [...this.props.channels];
  }
  get feedToken(): string | null {
    return this.props.feedToken;
  }
  get careerSiteBaseUrl(): string | null {
    return this.props.careerSiteBaseUrl;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get tokenExpiresAt(): Date | null {
    return this.props.tokenExpiresAt;
  }

  /** Süre dolmuş mu — dolmasına 60 sn'den az varsa da dolmuş sayılır. */
  isTokenExpired(now: Date): boolean {
    if (this.props.tokenExpiresAt === null) return false;
    return this.props.tokenExpiresAt.getTime() - 60_000 <= now.getTime();
  }

  /** Bu kanal bu bağlantıda etkin mi. */
  hasChannel(channel: LinkedInChannel): boolean {
    return this.props.channels.includes(channel);
  }

  withId(id: number): LinkedInConnection {
    return new LinkedInConnection({ ...this.props, id });
  }

  toView(config: LinkedInCredentialConfig | null, now: Date): LinkedInConnectionView {
    const hasCredentials = Boolean(config?.clientId && config.clientSecret);
    const hasToken = Boolean(config?.accessToken);
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      organizationUrn: this.props.organizationUrn,
      organizationName: this.props.organizationName,
      autoPublish: this.props.autoPublish,
      channels: [...this.props.channels],
      careerSiteBaseUrl: this.props.careerSiteBaseUrl,
      isActive: this.props.isActive,
      lastError: this.props.lastError,
      hasCredentials,
      isAuthorized: hasToken && !this.isTokenExpired(now),
      tokenExpiresAt: this.props.tokenExpiresAt ? this.props.tokenExpiresAt.toISOString() : null,
      tokenExpired: hasToken && this.isTokenExpired(now),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}
