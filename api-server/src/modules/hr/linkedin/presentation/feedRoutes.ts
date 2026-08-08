/**
 * Public LinkedIn uçları — /v1/hr-jobs altına mount edilir.
 *
 *   GET /feed.xml?token=…          İş ilanı XML beslemesi (LinkedIn crawler'ı okur)
 *   GET /linkedin/callback?code=…  OAuth dönüşü (tarayıcı yönlendirmesi)
 *
 * İKİSİNDE DE authMiddleware YOKTUR — crawler ve OAuth yönlendirmesi bizim
 * JWT'mizi taşıyamaz. Yetkilendirme:
 *   feed     → tahmin edilemez `feed_token` (companyId jetondan çözülür)
 *   callback → HMAC imzalı `state` (companyId imzadan çözülür)
 * Her iki uçta da companyId İSTEMCİDEN ALINMAZ.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import type { GetJobFeedUseCase } from '../application/useCases/GetJobFeedUseCase.js';
import type { CompleteLinkedInOAuthUseCase } from '../application/useCases/OAuthUseCases.js';

import { mapLinkedInError } from './errorMapping.js';

export interface LinkedInFeedRouterDeps {
  getJobFeed: GetJobFeedUseCase;
  completeOAuth: CompleteLinkedInOAuthUseCase;
  resolveRedirectUri: (requestUrl: string) => string;
}

/**
 * Yetkilendirme penceresini kapatan sabit HTML. İçine HİÇBİR kullanıcı/LinkedIn
 * verisi gömülmez (XSS yüzeyi yok); açan pencere durumu API'den yeniden okur.
 */
function closingPage(ok: boolean): string {
  const title = ok ? 'LinkedIn bağlantısı tamamlandı' : 'LinkedIn bağlantısı başarısız';
  const note = ok
    ? 'Bu pencereyi kapatabilirsiniz.'
    : 'Bu pencereyi kapatıp ayarlar ekranından tekrar deneyin.';
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:14px system-ui,sans-serif;padding:40px;text-align:center;color:#1f2937}</style>
</head><body>
<h3>${title}</h3><p>${note}</p>
<script>
  try { window.opener && window.opener.postMessage({ type: 'linkedin-oauth', ok: ${String(ok)} }, '*'); } catch (e) {}
  setTimeout(function () { window.close(); }, 1200);
</script>
</body></html>`;
}

export function createLinkedInFeedRouter(deps: LinkedInFeedRouterDeps): Hono {
  const app = new Hono();

  // --- Public XML iş ilanı beslemesi ---------------------------------------
  app.get(
    '/feed.xml',
    zValidator('query', z.object({ token: z.string().min(1).max(200) })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const { xml } = await deps.getJobFeed.execute({ token: q.token });
        return c.body(xml, 200, {
          'Content-Type': 'application/xml; charset=utf-8',
          // Crawler sık gelir; kısa cache kaynak tüketimini düşürür ama yeni
          // ilanın görünmesini de geciktirmemeli.
          'Cache-Control': 'public, max-age=300',
          'X-Robots-Tag': 'noindex',
        });
      } catch (err) {
        mapLinkedInError(err);
      }
    },
  );

  // --- OAuth dönüşü --------------------------------------------------------
  app.get(
    '/linkedin/callback',
    zValidator(
      'query',
      z.object({
        code: z.string().min(1).max(2000).optional(),
        state: z.string().min(1).max(4000).optional(),
        error: z.string().max(200).optional(),
        error_description: z.string().max(1000).optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');

      // Kullanıcı onay ekranında "İptal" dediyse LinkedIn code yerine error yollar.
      if (q.error !== undefined || q.code === undefined || q.state === undefined) {
        return c.html(closingPage(false), 200);
      }

      try {
        await deps.completeOAuth.execute({
          code: q.code,
          state: q.state,
          redirectUri: deps.resolveRedirectUri(c.req.url),
        });
        return c.html(closingPage(true), 200);
      } catch {
        // Hata ayrıntısı tarayıcıya SIZDIRILMAZ (state/imza bilgisi taşıyabilir);
        // kullanıcı ayrıntıyı ayarlar ekranındaki "son hata" alanında görür.
        return c.html(closingPage(false), 200);
      }
    },
  );

  return app;
}
