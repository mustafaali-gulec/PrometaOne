/**
 * e-Defter modülü — DI (Faz 3: Mali Mühür imzalama + berat).
 *
 * registerEdefterModule() durumsuzdur (DB gerektirmez): sertifika sağlayıcı +
 * XAdES imzalayıcı + use-case'i wire eder, Hono router döndürür. app `/v1/finance`
 * altına mount eder (yol: /edefter/*).
 *
 * Sertifika EDEFTER_SIGN_* / EDEFTER_PFX_* env'den okunur; yoksa /edefter/sign 503.
 */
import { SignEdefterUseCase } from './application/useCases/SignEdefterUseCase.js';
import { EnvCertificateProvider } from './infrastructure/crypto/EnvCertificateProvider.js';
import { XadesMaliMuhurSigner } from './infrastructure/crypto/XadesMaliMuhurSigner.js';
import { createEdefterRouter } from './presentation/routes.js';

export function registerEdefterModule(): ReturnType<typeof createEdefterRouter> {
  const certs = new EnvCertificateProvider();
  const signer = new XadesMaliMuhurSigner();
  const signEdefter = new SignEdefterUseCase(signer, certs);
  if (!certs.isConfigured()) {
    console.warn(
      '[edefter] Mali Mühür sertifikası tanımsız — /edefter/sign 503 döner. ' +
        'EDEFTER_SIGN_KEY_PEM/EDEFTER_SIGN_CERT_PEM veya EDEFTER_PFX_PATH tanımlayın.',
    );
  }
  return createEdefterRouter({ signEdefter, certs });
}
