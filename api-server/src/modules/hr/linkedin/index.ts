/**
 * İşe Alım · LinkedIn entegrasyonu — DI kompozisyonu.
 *
 * registerHrLinkedInModule(pool) iki router döndürür:
 *   router     → /v1/hr/linkedin  (auth'lu: ayarlar, OAuth başlat, yayınla, kapat)
 *   feedRouter → /v1/hr-jobs      (public: XML iş ilanı beslemesi + OAuth callback)
 *
 * Ortam değişkenleri (hepsi opsiyonel — hiçbiri yoksa modül yine ayağa kalkar,
 * yalnızca gerçek gönderim yapılamaz):
 *   HR_LINKEDIN_MASTER_KEY  OAuth token şifreleme anahtarı (yoksa EINVOICE_MASTER_KEY)
 *   PUBLIC_BASE_URL         Dışa açık kök adres (yoksa istekten türetilir)
 *   LINKEDIN_REDIRECT_URI   OAuth dönüş adresi override'ı
 *   LINKEDIN_PROVIDER       'mock' → ağa çıkmayan sahte sağlayıcı (dev/test)
 *   LINKEDIN_API_VERSION    LinkedIn versiyonlu API başlığı (YYYYMM)
 */
import { randomBytes } from 'node:crypto';

import type { Hono } from 'hono';
import type { Pool } from 'pg';

import { systemClock } from '../application/ports/Clock.js';

import type { CredentialCipher } from './application/ports/CredentialCipher.js';
import type { LinkedInProvider } from './application/ports/LinkedInProvider.js';
import { LinkedInAccess } from './application/services/LinkedInAccess.js';
import { CloseJobPostingUseCase } from './application/useCases/CloseJobPostingUseCase.js';
import {
  DeleteLinkedInConnectionUseCase,
  GetLinkedInConnectionUseCase,
  SaveLinkedInConnectionUseCase,
  TestLinkedInConnectionUseCase,
} from './application/useCases/ConnectionUseCases.js';
import { GetJobFeedUseCase } from './application/useCases/GetJobFeedUseCase.js';
import { ListLinkedInPostsUseCase } from './application/useCases/ListLinkedInPostsUseCase.js';
import {
  CompleteLinkedInOAuthUseCase,
  StartLinkedInOAuthUseCase,
} from './application/useCases/OAuthUseCases.js';
import { PublishJobPostingUseCase } from './application/useCases/PublishJobPostingUseCase.js';
import { AesGcmCredentialCipher } from './infrastructure/crypto/AesGcmCredentialCipher.js';
import { CryptoTokenGenerator } from './infrastructure/crypto/CryptoTokenGenerator.js';
import { HmacOAuthStateCodec } from './infrastructure/crypto/HmacOAuthStateCodec.js';
import { PgJobPostingFeedRepository } from './infrastructure/persistence/PgJobPostingFeedRepository.js';
import { PgLinkedInConnectionRepository } from './infrastructure/persistence/PgLinkedInConnectionRepository.js';
import { PgLinkedInPostRepository } from './infrastructure/persistence/PgLinkedInPostRepository.js';
import { LinkedInApiProvider } from './infrastructure/provider/LinkedInApiProvider.js';
import { MockLinkedInProvider } from './infrastructure/provider/MockLinkedInProvider.js';
import { createLinkedInFeedRouter } from './presentation/feedRoutes.js';
import { createLinkedInRouter } from './presentation/routes.js';

// --- Public API (test + dış kullanım) --------------------------------------
export { LinkedInConnection } from './domain/entities/LinkedInConnection.js';
export type {
  LinkedInConnectionView,
  LinkedInCredentialConfig,
} from './domain/entities/LinkedInConnection.js';
export { JobPostingSnapshot } from './domain/entities/JobPostingSnapshot.js';
export { LinkedInJobPost } from './domain/entities/LinkedInJobPost.js';
export {
  ALL_LINKEDIN_CHANNELS,
  IMPLEMENTED_LINKEDIN_CHANNELS,
  isLinkedInChannel,
  normalizeChannels,
  toLinkedInChannel,
} from './domain/valueObjects/LinkedInChannel.js';
export type { LinkedInChannel } from './domain/valueObjects/LinkedInChannel.js';
export { buildJobFeedXml, splitLocation } from './domain/services/JobFeedXmlBuilder.js';
export {
  buildShareCommentary,
  MAX_COMMENTARY_LENGTH,
} from './domain/services/JobShareTextBuilder.js';
export {
  escapeCommentary,
  LinkedInApiProvider,
} from './infrastructure/provider/LinkedInApiProvider.js';
export { MockLinkedInProvider } from './infrastructure/provider/MockLinkedInProvider.js';
export { HmacOAuthStateCodec } from './infrastructure/crypto/HmacOAuthStateCodec.js';
export { PublishJobPostingUseCase } from './application/useCases/PublishJobPostingUseCase.js';
export { createLinkedInRouter } from './presentation/routes.js';
export { createLinkedInFeedRouter } from './presentation/feedRoutes.js';

function resolveCipher(): CredentialCipher {
  try {
    return AesGcmCredentialCipher.fromEnv();
  } catch {
    console.warn(
      '[hr/linkedin] HR_LINKEDIN_MASTER_KEY / EINVOICE_MASTER_KEY tanımsız — efemeral anahtar ' +
        'kullanılıyor (sadece dev). Süreç yeniden başlayınca kayıtlı LinkedIn yetkisi çözülemez.',
    );
    return new AesGcmCredentialCipher(randomBytes(32));
  }
}

function resolveProvider(): LinkedInProvider {
  if (process.env.LINKEDIN_PROVIDER === 'mock') {
    console.warn('[hr/linkedin] LINKEDIN_PROVIDER=mock — gerçek LinkedIn çağrısı yapılmayacak');
    return new MockLinkedInProvider();
  }
  return new LinkedInApiProvider();
}

function publicBaseUrl(requestUrl: string): string {
  const env = process.env.PUBLIC_BASE_URL;
  if (env !== undefined && env !== '') return env.replace(/\/+$/, '');
  try {
    const u = new URL(requestUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

function redirectUri(requestUrl: string): string {
  const env = process.env.LINKEDIN_REDIRECT_URI;
  if (env !== undefined && env !== '') return env;
  return `${publicBaseUrl(requestUrl)}/v1/hr-jobs/linkedin/callback`;
}

export interface RegisteredLinkedInModule {
  /** /v1/hr/linkedin — auth'lu uçlar. */
  router: Hono;
  /** /v1/hr-jobs — public besleme + OAuth callback. */
  feedRouter: Hono;
}

export function registerHrLinkedInModule(pool: Pool): RegisteredLinkedInModule {
  const clock = systemClock;
  const cipher = resolveCipher();
  const provider = resolveProvider();
  const tokens = new CryptoTokenGenerator();

  const stateSecret = process.env.JWT_SECRET ?? randomBytes(32).toString('hex');
  const stateCodec = new HmacOAuthStateCodec(stateSecret, () => clock.now());

  const connections = new PgLinkedInConnectionRepository(pool);
  const feed = new PgJobPostingFeedRepository(pool);
  const posts = new PgLinkedInPostRepository(pool);

  const access = new LinkedInAccess(connections, cipher, provider, clock);

  const router = createLinkedInRouter({
    getConnection: new GetLinkedInConnectionUseCase(connections, cipher, clock),
    saveConnection: new SaveLinkedInConnectionUseCase(connections, cipher, tokens, clock),
    deleteConnection: new DeleteLinkedInConnectionUseCase(connections),
    testConnection: new TestLinkedInConnectionUseCase(access, provider),
    startOAuth: new StartLinkedInOAuthUseCase(connections, cipher, provider, stateCodec, clock),
    publishJobPosting: new PublishJobPostingUseCase(access, provider, feed, posts, clock),
    closeJobPosting: new CloseJobPostingUseCase(access, provider, feed, posts, clock),
    listPosts: new ListLinkedInPostsUseCase(posts),
    resolvePublicBaseUrl: publicBaseUrl,
    resolveRedirectUri: redirectUri,
  });

  const feedRouter = createLinkedInFeedRouter({
    getJobFeed: new GetJobFeedUseCase(connections, feed, clock),
    completeOAuth: new CompleteLinkedInOAuthUseCase(
      connections,
      cipher,
      provider,
      stateCodec,
      clock,
    ),
    resolveRedirectUri: redirectUri,
  });

  return { router, feedRouter };
}
