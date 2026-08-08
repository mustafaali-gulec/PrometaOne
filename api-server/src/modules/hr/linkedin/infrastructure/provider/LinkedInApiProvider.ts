/**
 * LinkedInApiProvider — gerçek LinkedIn REST çağrıları.
 *
 * Kullanılan uçlar:
 *   OAuth      www.linkedin.com/oauth/v2/{authorization,accessToken}
 *   Sayfalar   api.linkedin.com/rest/organizationAcls  (r_organization_admin)
 *   Gönderi    api.linkedin.com/rest/posts             (w_organization_social)
 *
 * NOT: Bu uçlar "Community Management API" ürün onayı ister (LinkedIn
 * Developer portalından başvurulur). Onay yoksa çağrılar 403 döner ve
 * LinkedInApiError olarak yüzeye çıkar — sessizce yutulmaz.
 *
 * Native iş ilanı açan Job Posting API burada YOK: Talent Solutions partner
 * onayı gerektirir. Native ilan için `feed` kanalı (XML beslemesi) kullanılır.
 */
import type {
  LinkedInOrganization,
  LinkedInProvider,
  LinkedInShareResult,
  LinkedInTestResult,
  LinkedInTokenSet,
} from '../../application/ports/LinkedInProvider.js';
import type { LinkedInCredentialConfig } from '../../domain/entities/LinkedInConnection.js';
import { LinkedInApiError, LinkedInAuthError } from '../../domain/errors/LinkedInErrors.js';

const OAUTH_BASE = 'https://www.linkedin.com/oauth/v2';
const API_BASE = 'https://api.linkedin.com/rest';

/** LinkedIn versiyonlu API — `YYYYMM`. Env ile ileri sürüme alınabilir. */
const DEFAULT_API_VERSION = '202506';

/**
 * Posts API `commentary` alanı "Little Text" biçimindedir: bu karakterler
 * kaçırılmazsa LinkedIn 422 döner ya da metin bozuk render edilir.
 */
const RESERVED_COMMENTARY_CHARS = /([|{}@[\]()<>#\\*_~])/g;

export function escapeCommentary(text: string): string {
  return text.replace(RESERVED_COMMENTARY_CHARS, '\\$1');
}

export interface LinkedInApiProviderOptions {
  apiVersion?: string;
  /** Test edilebilirlik için enjekte edilebilir fetch. */
  fetchImpl?: typeof fetch;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export class LinkedInApiProvider implements LinkedInProvider {
  readonly name = 'linkedin';

  private readonly apiVersion: string;
  private readonly http: typeof fetch;

  constructor(opts: LinkedInApiProviderOptions = {}) {
    this.apiVersion = opts.apiVersion ?? process.env.LINKEDIN_API_VERSION ?? DEFAULT_API_VERSION;
    this.http = opts.fetchImpl ?? fetch;
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': this.apiVersion,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };
  }

  private requireToken(config: LinkedInCredentialConfig): string {
    if (config.accessToken === undefined || config.accessToken === '') {
      throw new LinkedInAuthError('access token yok');
    }
    return config.accessToken;
  }

  buildAuthorizeUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: readonly string[];
  }): string {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      state: params.state,
      scope: params.scopes.join(' '),
    });
    return `${OAUTH_BASE}/authorization?${q.toString()}`;
  }

  private async token(body: URLSearchParams): Promise<LinkedInTokenSet> {
    const res = await this.http(`${OAUTH_BASE}/accessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || json.access_token === undefined) {
      throw new LinkedInAuthError(
        json.error_description ?? json.error ?? `token alınamadı (HTTP ${res.status})`,
      );
    }
    return {
      accessToken: json.access_token,
      expiresInSeconds: json.expires_in ?? 3600,
      ...(json.refresh_token !== undefined ? { refreshToken: json.refresh_token } : {}),
    };
  }

  async exchangeCode(params: {
    config: LinkedInCredentialConfig;
    code: string;
    redirectUri: string;
  }): Promise<LinkedInTokenSet> {
    return this.token(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: params.config.clientId,
        client_secret: params.config.clientSecret,
      }),
    );
  }

  async refreshAccessToken(params: {
    config: LinkedInCredentialConfig;
    refreshToken: string;
  }): Promise<LinkedInTokenSet> {
    return this.token(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: params.refreshToken,
        client_id: params.config.clientId,
        client_secret: params.config.clientSecret,
      }),
    );
  }

  async listOrganizations(config: LinkedInCredentialConfig): Promise<LinkedInOrganization[]> {
    const token = this.requireToken(config);
    const url =
      `${API_BASE}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED` +
      `&projection=(elements*(organization~(localizedName)))`;

    const res = await this.http(url, { headers: this.headers(token) });
    if (!res.ok) {
      throw new LinkedInApiError(await this.errorText(res), res.status);
    }

    const body = (await res.json().catch(() => ({}))) as {
      elements?: Array<{
        organization?: string;
        'organization~'?: { localizedName?: string };
      }>;
    };

    return (body.elements ?? [])
      .map((el) => ({
        urn: el.organization ?? '',
        name: el['organization~']?.localizedName ?? el.organization ?? '',
      }))
      .filter((o) => o.urn !== '');
  }

  async testConnection(config: LinkedInCredentialConfig): Promise<LinkedInTestResult> {
    try {
      const organizations = await this.listOrganizations(config);
      return {
        ok: true,
        message:
          organizations.length === 0
            ? 'Bağlantı çalışıyor ancak yönetici olduğunuz LinkedIn şirket sayfası bulunamadı'
            : `Bağlantı başarılı — ${organizations.length} şirket sayfası yönetiliyor`,
        organizations,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        organizations: [],
      };
    }
  }

  async createShare(params: {
    config: LinkedInCredentialConfig;
    organizationUrn: string;
    commentary: string;
    linkUrl?: string;
    linkTitle?: string;
  }): Promise<LinkedInShareResult> {
    const token = this.requireToken(params.config);

    const payload: Record<string, unknown> = {
      author: params.organizationUrn,
      commentary: escapeCommentary(params.commentary),
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    // Başvuru linki varsa gönderiye makale kartı olarak iliştir — tıklama oranı
    // düz metne göre belirgin yüksek.
    if (params.linkUrl !== undefined && params.linkUrl !== '') {
      payload.content = {
        article: {
          source: params.linkUrl,
          ...(params.linkTitle !== undefined && params.linkTitle !== ''
            ? { title: params.linkTitle }
            : {}),
        },
      };
    }

    const res = await this.http(`${API_BASE}/posts`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new LinkedInApiError(await this.errorText(res), res.status);
    }

    // Gönderi URN'i gövdede değil `x-restli-id` başlığında döner.
    const urn = res.headers.get('x-restli-id') ?? res.headers.get('X-RestLi-Id') ?? '';
    if (urn === '') {
      throw new LinkedInApiError('gönderi oluşturuldu ancak URN döndürülmedi', res.status);
    }
    return { urn, url: `https://www.linkedin.com/feed/update/${urn}/` };
  }

  async deleteShare(params: { config: LinkedInCredentialConfig; urn: string }): Promise<void> {
    const token = this.requireToken(params.config);
    const res = await this.http(`${API_BASE}/posts/${encodeURIComponent(params.urn)}`, {
      method: 'DELETE',
      headers: this.headers(token),
    });
    // Zaten silinmiş gönderi hata değildir — kapatma akışı idempotent kalmalı.
    if (res.ok || res.status === 404) return;
    throw new LinkedInApiError(await this.errorText(res), res.status);
  }

  private async errorText(res: Response): Promise<string> {
    const raw = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(raw) as { message?: string };
      if (parsed.message !== undefined && parsed.message !== '') {
        return `${parsed.message} (HTTP ${res.status})`;
      }
    } catch {
      /* düz metin — aşağıda kullanılır */
    }
    return raw === '' ? `HTTP ${res.status}` : `${raw.slice(0, 300)} (HTTP ${res.status})`;
  }
}
