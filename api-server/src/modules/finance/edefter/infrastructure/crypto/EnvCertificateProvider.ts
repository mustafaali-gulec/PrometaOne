/**
 * Env / PKCS#12 tabanlı Mali Mühür sertifika sağlayıcı.
 *
 * Öncelik sırası:
 *   1) EDEFTER_SIGN_KEY_PEM + EDEFTER_SIGN_CERT_PEM (ham PEM veya base64-PEM)
 *   2) EDEFTER_PFX_PATH (+ EDEFTER_PFX_PASSWORD) — openssl ile PEM'e çıkarılır
 * Hiçbiri yoksa isConfigured() false; route 503 döner.
 *
 * NOT: Akıllı kart (PKCS#11/HSM) bu sağlayıcının kapsamı dışındadır; gerçek
 * Mali Mühür donanım token'ı için ayrı bir PKCS#11 sağlayıcı gerekir.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import type { CertificateProvider } from '../../application/ports/CertificateProvider.js';
import type { SignerCertificate } from '../../application/ports/XmlSigner.js';

function decodePem(value: string): string {
  const v = value.trim();
  if (v.includes('-----BEGIN')) return v;
  return Buffer.from(v, 'base64').toString('utf8');
}

function extractPemBlock(text: string, label: string): string {
  const re = new RegExp(
    `-----BEGIN [^-]*${label}[^-]*-----[\\s\\S]*?-----END [^-]*${label}[^-]*-----`,
  );
  const m = text.match(re);
  if (!m) throw new Error(`PEM bloğu bulunamadı: ${label}`);
  return m[0] + '\n';
}

export class EnvCertificateProvider implements CertificateProvider {
  isConfigured(): boolean {
    return (
      (!!process.env.EDEFTER_SIGN_KEY_PEM && !!process.env.EDEFTER_SIGN_CERT_PEM) ||
      !!process.env.EDEFTER_PFX_PATH
    );
  }

  get(): SignerCertificate {
    const keyPem = process.env.EDEFTER_SIGN_KEY_PEM;
    const certPem = process.env.EDEFTER_SIGN_CERT_PEM;
    if (keyPem && certPem) {
      return { privateKeyPem: decodePem(keyPem), certificatePem: decodePem(certPem) };
    }
    const pfxPath = process.env.EDEFTER_PFX_PATH;
    if (pfxPath) {
      readFileSync(pfxPath); // erişilebilirlik kontrolü
      const pass = process.env.EDEFTER_PFX_PASSWORD ?? '';
      const keyOut = execFileSync(
        'openssl',
        ['pkcs12', '-in', pfxPath, '-nocerts', '-nodes', '-passin', `pass:${pass}`],
        { encoding: 'utf8' },
      );
      const certOut = execFileSync(
        'openssl',
        ['pkcs12', '-in', pfxPath, '-clcerts', '-nokeys', '-passin', `pass:${pass}`],
        { encoding: 'utf8' },
      );
      return {
        privateKeyPem: extractPemBlock(keyOut, 'PRIVATE KEY'),
        certificatePem: extractPemBlock(certOut, 'CERTIFICATE'),
      };
    }
    throw new Error(
      'Mali Mühür sertifikası yapılandırılmamış (EDEFTER_SIGN_* / EDEFTER_PFX_PATH).',
    );
  }
}
