/**
 * LinkedInProvider — LinkedIn REST API portu.
 *
 * Application katmanı LinkedIn'in HTTP ayrıntılarını bilmez. Concrete impl'ler
 * infrastructure/provider/ altında:
 *   - LinkedInApiProvider  → gerçek api.linkedin.com çağrıları
 *   - MockLinkedInProvider → testler + kimliksiz dev ortamı
 *
 * `job_api` (native Job Posting API) kanalı bilinçli olarak BURADA YOK: LinkedIn
 * Talent Solutions partner onayı ister. Kanal geldiğinde bu porta
 * `createJobPosting` eklenir; şema (DB + VO) o günü zaten karşılıyor.
 */
import type { LinkedInCredentialConfig } from '../../domain/entities/LinkedInConnection.js';

/** OAuth yetkilendirme sonrası dönen token seti. */
export interface LinkedInTokenSet {
  accessToken: string;
  /** Saniye cinsinden geçerlilik. */
  expiresInSeconds: number;
  refreshToken?: string;
}

/** Kullanıcının yönetici olduğu şirket sayfaları. */
export interface LinkedInOrganization {
  urn: string;
  name: string;
}

export interface LinkedInShareResult {
  urn: string;
  url: string;
}

export interface LinkedInTestResult {
  ok: boolean;
  message: string;
  organizations: LinkedInOrganization[];
}

export interface LinkedInProvider {
  readonly name: string;

  /** Kullanıcının yönlendirileceği OAuth onay adresi. */
  buildAuthorizeUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: readonly string[];
  }): string;

  /** `code` → access token takası. */
  exchangeCode(params: {
    config: LinkedInCredentialConfig;
    code: string;
    redirectUri: string;
  }): Promise<LinkedInTokenSet>;

  /** Refresh token ile yenileme (LinkedIn her üründe vermez → opsiyonel). */
  refreshAccessToken(params: {
    config: LinkedInCredentialConfig;
    refreshToken: string;
  }): Promise<LinkedInTokenSet>;

  /** Token'ın yönetebildiği şirket sayfaları. */
  listOrganizations(config: LinkedInCredentialConfig): Promise<LinkedInOrganization[]>;

  /** Bağlantıyı doğrular (token geçerli mi, sayfa yetkisi var mı). */
  testConnection(config: LinkedInCredentialConfig): Promise<LinkedInTestResult>;

  /** Şirket sayfasında gönderi oluşturur. */
  createShare(params: {
    config: LinkedInCredentialConfig;
    organizationUrn: string;
    commentary: string;
    /** Gönderiye iliştirilen başvuru linki (link önizlemesi). */
    linkUrl?: string;
    linkTitle?: string;
  }): Promise<LinkedInShareResult>;

  /** Gönderiyi siler (ilan kapatılınca). Bulunamayan gönderi hata DEĞİLDİR. */
  deleteShare(params: { config: LinkedInCredentialConfig; urn: string }): Promise<void>;
}
