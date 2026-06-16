/**
 * e-Defter / berat XML imzalama portu (Mali Mühür / NES, XAdES-BES).
 *
 * Soyutlama, imza materyalinin kaynağından (test PEM, üretim PKCS#12/PFX, ya da
 * akıllı kart için PKCS#11 HSM) bağımsızdır. Üretimde GİB Mali Mühür sertifikası
 * ile değiştirilir; yapı aynı kalır.
 */

export interface SignerCertificate {
  /** PEM kodlu özel anahtar (PKCS#8 / PKCS#1). */
  privateKeyPem: string;
  /** PEM kodlu X.509 sertifika (imzalayan Mali Mühür). */
  certificatePem: string;
}

export interface SignOptions {
  /** xades:ClaimedRole — örn. "Mali Mühür" veya "Beyanname imzalama". */
  signerRole?: string;
  /** İmza zamanı (xades:SigningTime). Test için enjekte edilir; yoksa now. */
  signingTime?: Date;
  /** Üst eleman adı: defter "edefter:defter", berat "edefter:berat". */
  rootElementName?: string;
}

export interface XmlSigner {
  /** İmzasız XBRL-GL XML'ine zarflı (enveloped) XAdES-BES imza ekler. */
  sign(xml: string, cert: SignerCertificate, opts?: SignOptions): string;
}

/** İmza self-doğrulama sonucu (test/teşhis için). */
export interface SignatureVerification {
  documentDigestValid: boolean;
  signedPropertiesDigestValid: boolean;
  signatureValueValid: boolean;
  hasRequiredXadesElements: boolean;
  get valid(): boolean;
}
