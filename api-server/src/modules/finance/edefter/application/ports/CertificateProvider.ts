/**
 * İmza sertifikası sağlayıcı portu.
 *
 * Üretimde GİB Mali Mühür: ya yazılım sertifikası (PKCS#12/.pfx) ya da akıllı
 * kart/HSM (PKCS#11). Bu port kaynağı soyutlar; mevcut implementasyon soft-cert
 * (PFX/PEM) destekler — GİB test sertifikaları ve yazılım Mali Mührü için yeterli.
 * Akıllı kart için ileride PKCS#11 tabanlı bir sağlayıcı eklenebilir.
 */
import type { SignerCertificate } from './XmlSigner.js';

export interface CertificateProvider {
  /** Sertifika materyali yapılandırılmış mı (env/PFX). */
  isConfigured(): boolean;
  /** İmza için anahtar + sertifika. Yapılandırılmamışsa hata fırlatır. */
  get(): SignerCertificate;
}
