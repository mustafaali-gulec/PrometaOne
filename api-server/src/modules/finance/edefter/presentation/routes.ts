/**
 * e-Defter imzalama HTTP route'ları (Faz 3).
 *
 * POST /edefter/sign — imzasız XBRL-GL defter alır; Mali Mühür ile imzalar,
 * berat üretip imzalar, ikisini de döndürür. authMiddleware + 'cfo' rolü.
 * Sertifika yapılandırılmamışsa 503.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../../middleware/auth.js';
import type { CertificateProvider } from '../application/ports/CertificateProvider.js';
import type {
  SignEdefterUseCase,
  SignEdefterInput,
} from '../application/useCases/SignEdefterUseCase.js';

export interface EdefterRouterDeps {
  signEdefter: SignEdefterUseCase;
  certs: CertificateProvider;
}

const profileSchema = z.object({
  vkn: z.string().min(10).max(11),
  unvan: z.string().min(1),
  isPerson: z.boolean().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z
    .object({
      buildingNumber: z.string().optional(),
      street: z.string().optional(),
      street2: z.string().optional(),
      city: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  naceCode: z.string().optional(),
  fiscalYearStart: z.string().optional(),
  fiscalYearEnd: z.string().optional(),
  creator: z.string().optional(),
  accountant: z
    .object({
      name: z.string().optional(),
      engagement: z.string().optional(),
    })
    .optional(),
  sourceApplication: z.string().optional(),
});

const signBody = z.object({
  kind: z.enum(['journal', 'ledger']),
  unsignedDefterXml: z.string().min(1),
  profile: profileSchema,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  part: z.number().int().min(0).optional(),
});

export function createEdefterRouter(deps: EdefterRouterDeps): Hono {
  const app = new Hono();
  app.use('/edefter/*', authMiddleware);

  app.post('/edefter/sign', requireRole('cfo'), zValidator('json', signBody), (c) => {
    if (!deps.certs.isConfigured()) {
      return c.json(
        {
          error: 'certificate_not_configured',
          message:
            'Mali Mühür sertifikası yapılandırılmamış. EDEFTER_SIGN_KEY_PEM/EDEFTER_SIGN_CERT_PEM ' +
            'veya EDEFTER_PFX_PATH tanımlayın. Üretim için GİB Mali Mühür sertifikası gerekir.',
        },
        503,
      );
    }
    // zod sınırda doğruladı; exactOptionalPropertyTypes farkı için sınır cast'i
    const body = c.req.valid('json') as SignEdefterInput;
    try {
      const result = deps.signEdefter.execute(body);
      return c.json(result);
    } catch (err) {
      return c.json(
        { error: 'sign_failed', message: err instanceof Error ? err.message : 'İmzalama hatası' },
        500,
      );
    }
  });

  return app;
}
