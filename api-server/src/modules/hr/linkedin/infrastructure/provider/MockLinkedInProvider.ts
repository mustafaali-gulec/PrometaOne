/**
 * MockLinkedInProvider — testler ve LinkedIn kimliği olmayan dev ortamı için.
 *
 * Dışarıya HİÇBİR ağ çağrısı yapmaz; sahte ama tutarlı URN/URL üretir.
 * Böylece "Yayınla → LinkedIn'e gitti" akışı uçtan uca denenebilir.
 */
import type {
  LinkedInOrganization,
  LinkedInProvider,
  LinkedInShareResult,
  LinkedInTestResult,
  LinkedInTokenSet,
} from '../../application/ports/LinkedInProvider.js';
import type { LinkedInCredentialConfig } from '../../domain/entities/LinkedInConnection.js';

export class MockLinkedInProvider implements LinkedInProvider {
  readonly name = 'mock';

  private counter = 0;
  readonly deleted: string[] = [];

  constructor(
    private readonly organizations: LinkedInOrganization[] = [
      { urn: 'urn:li:organization:99999', name: 'Demo Şirket' },
    ],
  ) {}

  buildAuthorizeUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: readonly string[];
  }): string {
    const q = new URLSearchParams({
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      state: params.state,
      scope: params.scopes.join(' '),
      mock: '1',
    });
    return `https://example.invalid/mock-linkedin/authorize?${q.toString()}`;
  }

  exchangeCode(): Promise<LinkedInTokenSet> {
    return Promise.resolve({
      accessToken: 'mock-access-token',
      expiresInSeconds: 3600,
      refreshToken: 'mock-refresh',
    });
  }

  refreshAccessToken(): Promise<LinkedInTokenSet> {
    return Promise.resolve({
      accessToken: 'mock-access-token-2',
      expiresInSeconds: 3600,
      refreshToken: 'mock-refresh',
    });
  }

  listOrganizations(_config: LinkedInCredentialConfig): Promise<LinkedInOrganization[]> {
    return Promise.resolve([...this.organizations]);
  }

  testConnection(_config: LinkedInCredentialConfig): Promise<LinkedInTestResult> {
    return Promise.resolve({
      ok: true,
      message: 'Mock sağlayıcı — gerçek LinkedIn çağrısı yapılmadı',
      organizations: [...this.organizations],
    });
  }

  createShare(): Promise<LinkedInShareResult> {
    this.counter += 1;
    const urn = `urn:li:share:mock${this.counter}`;
    return Promise.resolve({ urn, url: `https://www.linkedin.com/feed/update/${urn}/` });
  }

  deleteShare(params: { urn: string }): Promise<void> {
    this.deleted.push(params.urn);
    return Promise.resolve();
  }
}
