/**
 * XAdES-BES imzalayıcı (e-Defter / berat) — Mali Mühür / NES.
 *
 * GİB e-Defter şematronunun zorunlu kıldığı zarflı (enveloped) imza yapısını üretir:
 *   ds:Signature > ds:SignedInfo (2 Reference: enveloped doküman + #SignedProperties),
 *   ds:SignatureValue, ds:KeyInfo (RSAKeyValue + X509Certificate),
 *   ds:Object > xades:QualifyingProperties > xades:SignedProperties
 *     (SigningTime, SigningCertificate[CertDigest+IssuerSerial], SignerRole).
 *
 * İmza, RSA-SHA256 + inclusive C14N (REC-xml-c14n-20010315) ile hesaplanır.
 * Tüm digest'ler ve SignatureValue, ağacın YERİNDEKİ (in-context) kanonik halinden
 * üretilir; bu sayede `verifyXadesSignature` ile birebir self-doğrulanabilir.
 *
 * NOT (üretim sınırı): Bu imzanın GİB tarafından KABULÜ için (1) gerçek Mali Mühür
 * sertifikası (Kamu SM), (2) GİB e-Defter test ortamı + Uyumluluk Onayı, (3) beratın
 * GİB web servisine yüklenip karşı-imzalanması gerekir. Bu sınıf imza mekaniğini
 * (yapı + kriptografik geçerlilik) sağlar; test sertifikasıyla doğrulanır.
 */
/* @xmldom DOM düğümleri ve xml-crypto gevşek tipli olduğundan, C14N/imza glue
   kodunda DOM manipülasyonu için type-aware "no-unsafe-*" + "any" kuralları
   bu dosyada bilinçli olarak kapalıdır. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
import crypto from 'node:crypto';

import { DOMParser } from '@xmldom/xmldom';
import xmlcrypto from 'xml-crypto';

import type {
  XmlSigner,
  SignerCertificate,
  SignOptions,
  SignatureVerification,
} from '../../application/ports/XmlSigner.js';

const { C14nCanonicalization } = xmlcrypto as unknown as {
  C14nCanonicalization: new () => { process(node: unknown, options?: unknown): string };
};

const NS_DS = 'http://www.w3.org/2000/09/xmldsig#';
const NS_XADES = 'http://uri.etsi.org/01903/v1.3.2#';
const ALG_C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ALG_RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const ALG_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const ALG_ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

function sha256B64(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('base64');
}

// Bir düğümün üst zincirindeki tüm xmlns bildirimlerini topla (inclusive c14n için)
function ancestorNamespaces(node: any): Array<{ prefix: string; namespaceURI: string }> {
  const found: Record<string, string> = {};
  let cur = node.parentNode;
  while (cur && cur.attributes) {
    for (let i = 0; i < cur.attributes.length; i++) {
      const a = cur.attributes[i];
      if (a.name === 'xmlns' && found[''] === undefined) found[''] = a.value;
      else if (a.name.startsWith('xmlns:')) {
        const p = a.name.slice(6);
        if (found[p] === undefined) found[p] = a.value;
      }
    }
    cur = cur.parentNode;
  }
  return Object.keys(found).map((prefix) => ({ prefix, namespaceURI: found[prefix] ?? '' }));
}

function c14n(node: any): string {
  return new C14nCanonicalization().process(node, { ancestorNamespaces: ancestorNamespaces(node) });
}

function firstNS(root: any, ns: string, local: string): any {
  return root.getElementsByTagNameNS(ns, local)[0];
}

// Sertifikadan imza materyali (RSAKeyValue, X509, CertDigest, IssuerSerial)
function certMaterial(certPem: string) {
  const x509 = new crypto.X509Certificate(certPem);
  const der = x509.raw; // DER buffer
  const jwk = x509.publicKey.export({ format: 'jwk' }) as { n?: string; e?: string };
  const b64url = (s: string) => Buffer.from(s, 'base64url').toString('base64');
  // Issuer DN → RFC2253 (satırları ters çevirip virgülle birleştir)
  const issuerRfc2253 = String(x509.issuer || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .reverse()
    .join(',');
  const serialDec = BigInt('0x' + x509.serialNumber).toString(10);
  return {
    certB64: der.toString('base64'),
    certDigest: sha256B64(der),
    modulus: jwk.n ? b64url(jwk.n) : '',
    exponent: jwk.e ? b64url(jwk.e) : '',
    issuerRfc2253,
    serialDec,
  };
}

export class XadesMaliMuhurSigner implements XmlSigner {
  sign(xml: string, cert: SignerCertificate, opts: SignOptions = {}): string {
    const signingTime = (opts.signingTime ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const role = opts.signerRole ?? 'Mali Mühür';
    const rootName = opts.rootElementName ?? 'edefter:defter';
    const m = certMaterial(cert.certificatePem);

    const sigId = 'Signature1';
    const spId = 'SignedProperties1';

    // 1) Enveloped doküman digest'i (imza eklenmeden önce, kök elemanın c14n'i)
    const preDoc = new DOMParser().parseFromString(xml, 'text/xml');
    const docDigest = sha256B64(c14n(preDoc.documentElement));

    // 2) SignedProperties (xades) — digest'i yerleştikten sonra hesaplanır
    const signedProps =
      `<xades:SignedProperties Id="${spId}">` +
      `<xades:SignedSignatureProperties>` +
      `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
      `<xades:SigningCertificate><xades:Cert>` +
      `<xades:CertDigest>` +
      `<ds:DigestMethod Algorithm="${ALG_SHA256}"/>` +
      `<ds:DigestValue>${m.certDigest}</ds:DigestValue>` +
      `</xades:CertDigest>` +
      `<xades:IssuerSerial>` +
      `<ds:X509IssuerName>${escapeXml(m.issuerRfc2253)}</ds:X509IssuerName>` +
      `<ds:X509SerialNumber>${m.serialDec}</ds:X509SerialNumber>` +
      `</xades:IssuerSerial>` +
      `</xades:Cert></xades:SigningCertificate>` +
      `<xades:SignerRole><xades:ClaimedRoles><xades:ClaimedRole>${escapeXml(role)}</xades:ClaimedRole></xades:ClaimedRoles></xades:SignerRole>` +
      `</xades:SignedSignatureProperties>` +
      `</xades:SignedProperties>`;

    const SP_DIGEST = '__SP_DIGEST__';
    const SIG_VALUE = '__SIG_VALUE__';

    const signedInfo =
      `<ds:SignedInfo>` +
      `<ds:CanonicalizationMethod Algorithm="${ALG_C14N}"/>` +
      `<ds:SignatureMethod Algorithm="${ALG_RSA_SHA256}"/>` +
      `<ds:Reference URI="">` +
      `<ds:Transforms><ds:Transform Algorithm="${ALG_ENVELOPED}"/></ds:Transforms>` +
      `<ds:DigestMethod Algorithm="${ALG_SHA256}"/>` +
      `<ds:DigestValue>${docDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
      `<ds:Reference URI="#${spId}" Type="http://uri.etsi.org/01903#SignedProperties">` +
      `<ds:DigestMethod Algorithm="${ALG_SHA256}"/>` +
      `<ds:DigestValue>${SP_DIGEST}</ds:DigestValue>` +
      `</ds:Reference>` +
      `</ds:SignedInfo>`;

    const signature =
      `<ds:Signature Id="${sigId}">` +
      signedInfo +
      `<ds:SignatureValue>${SIG_VALUE}</ds:SignatureValue>` +
      `<ds:KeyInfo>` +
      `<ds:KeyValue><ds:RSAKeyValue>` +
      `<ds:Modulus>${m.modulus}</ds:Modulus>` +
      `<ds:Exponent>${m.exponent}</ds:Exponent>` +
      `</ds:RSAKeyValue></ds:KeyValue>` +
      `<ds:X509Data><ds:X509Certificate>${m.certB64}</ds:X509Certificate></ds:X509Data>` +
      `</ds:KeyInfo>` +
      `<ds:Object>` +
      `<xades:QualifyingProperties Target="#${sigId}">` +
      signedProps +
      `</xades:QualifyingProperties>` +
      `</ds:Object>` +
      `</ds:Signature>`;

    // İmzayı kök elemanın son çocuğu olarak ekle
    const closeTag = `</${rootName}>`;
    const idx = xml.lastIndexOf(closeTag);
    if (idx < 0) throw new Error(`Kök eleman kapanışı bulunamadı: ${closeTag}`);
    let assembled = xml.slice(0, idx) + signature + xml.slice(idx);

    // 3) SignedProperties digest'i (yerinde c14n) → Reference2'ye yaz
    const doc2 = new DOMParser().parseFromString(assembled, 'text/xml');
    const spNode = firstNS(doc2, NS_XADES, 'SignedProperties');
    const spDigest = sha256B64(c14n(spNode));
    assembled = assembled.replace(SP_DIGEST, spDigest);

    // 4) SignedInfo'yu imzala (yerinde c14n) → SignatureValue
    const doc3 = new DOMParser().parseFromString(assembled, 'text/xml');
    const siNode = firstNS(doc3, NS_DS, 'SignedInfo');
    const signatureValue = crypto
      .createSign('RSA-SHA256')
      .update(c14n(siNode))
      .sign(cert.privateKeyPem, 'base64');
    assembled = assembled.replace(SIG_VALUE, signatureValue);

    return assembled;
  }
}

/** İmzayı self-doğrula: her digest yeniden hesaplanır + SignatureValue RSA ile doğrulanır. */
export function verifyXadesSignature(signedXml: string): SignatureVerification {
  // İmza ve digest'ler ağacın YERİNDEKİ (in-context) hâlinden hesaplandığı için
  // bütünlüğü bozmadan, sağlam bir kopya üzerinde çalışırız.
  const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
  const sig = firstNS(doc, NS_DS, 'Signature');
  const si = firstNS(doc, NS_DS, 'SignedInfo');
  const sp = firstNS(doc, NS_XADES, 'SignedProperties');
  const refs = si ? si.getElementsByTagNameNS(NS_DS, 'Reference') : [];

  // Enveloped doküman digest'i: AYRI bir kopyadan Signature'ı çıkar, kökü c14n'le
  // (ana ağaca dokunmayız ki si/sp'nin üst namespace'leri korunsun).
  const docForEnvelope = new DOMParser().parseFromString(signedXml, 'text/xml');
  const sigCopy = firstNS(docForEnvelope, NS_DS, 'Signature');
  if (sigCopy && sigCopy.parentNode) sigCopy.parentNode.removeChild(sigCopy);
  const docDigest = sha256B64(c14n(docForEnvelope.documentElement));
  const docDigestExpected = refs[0]?.getElementsByTagNameNS(NS_DS, 'DigestValue')[0]?.textContent;
  const documentDigestValid = !!docDigestExpected && docDigest === docDigestExpected;

  // SignedProperties digest'i (ana ağaçta, yerinde)
  const spDigest = sp ? sha256B64(c14n(sp)) : '';
  const spDigestExpected = refs[1]?.getElementsByTagNameNS(NS_DS, 'DigestValue')[0]?.textContent;
  const signedPropertiesDigestValid = !!spDigestExpected && spDigest === spDigestExpected;

  // SignatureValue: c14n(SignedInfo) üzerinden RSA-SHA256 doğrula
  let signatureValueValid = false;
  try {
    const sigVal = firstNS(sig, NS_DS, 'SignatureValue')?.textContent || '';
    const certB64 = firstNS(sig, NS_DS, 'X509Certificate')?.textContent || '';
    const certPem =
      '-----BEGIN CERTIFICATE-----\n' +
      (certB64.match(/.{1,64}/g) || []).join('\n') +
      '\n-----END CERTIFICATE-----\n';
    const pub = new crypto.X509Certificate(certPem).publicKey;
    signatureValueValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(c14n(si)),
      pub,
      Buffer.from(sigVal, 'base64'),
    );
  } catch {
    signatureValueValid = false;
  }

  const hasRequiredXadesElements =
    !!firstNS(doc, NS_XADES, 'SigningTime') &&
    !!firstNS(doc, NS_XADES, 'SigningCertificate') &&
    !!firstNS(doc, NS_DS, 'X509Certificate') &&
    !!firstNS(doc, NS_DS, 'KeyInfo') &&
    !!firstNS(doc, NS_DS, 'Object');

  return {
    documentDigestValid,
    signedPropertiesDigestValid,
    signatureValueValid,
    hasRequiredXadesElements,
    get valid() {
      return (
        this.documentDigestValid &&
        this.signedPropertiesDigestValid &&
        this.signatureValueValid &&
        this.hasRequiredXadesElements
      );
    },
  };
}

function escapeXml(s: string): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
