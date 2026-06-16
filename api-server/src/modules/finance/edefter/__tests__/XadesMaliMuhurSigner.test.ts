/**
 * XAdES-BES imzalayıcı + berat üretici testleri.
 *
 * Self-imzalı TEST sertifikası (openssl) ile imza mekaniği uçtan uca doğrulanır:
 * her digest yeniden hesaplanır ve SignatureValue RSA ile kriptografik olarak
 * doğrulanır. (Üretim geçerliliği için gerçek Mali Mühür + GİB Uyumluluk Onayı
 * gerekir — bu test imzanın YAPISAL + KRİPTOGRAFİK doğruluğunu kanıtlar.)
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, before } from 'node:test';

import { SignEdefterUseCase } from '../application/useCases/SignEdefterUseCase.js';
import { buildBeratXml, beratFileName } from '../domain/services/EdefterBeratBuilder.js';
import { EnvCertificateProvider } from '../infrastructure/crypto/EnvCertificateProvider.js';
import {
  XadesMaliMuhurSigner,
  verifyXadesSignature,
} from '../infrastructure/crypto/XadesMaliMuhurSigner.js';

// Minimal ama yapısal olarak gerçek bir e-Defter (imzalama içerikten bağımsızdır)
const SAMPLE_DEFTER =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<?xml-stylesheet type="text/xsl" href="yevmiye.xslt"?>\n` +
  `<edefter:defter xmlns:edefter="http://www.edefter.gov.tr" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
  `<xbrli:xbrl xmlns:gl-cor="http://www.xbrl.org/int/gl/cor/2006-10-25" xmlns:xbrli="http://www.xbrl.org/2003/instance">` +
  `<gl-cor:accountingEntries><gl-cor:documentInfo>` +
  `<gl-cor:entriesType>journal</gl-cor:entriesType>` +
  `<gl-cor:uniqueID>YEV202606000000</gl-cor:uniqueID>` +
  `</gl-cor:documentInfo></gl-cor:accountingEntries>` +
  `</xbrli:xbrl></edefter:defter>`;

let cert: { privateKeyPem: string; certificatePem: string };
let tmp: string;

before(() => {
  tmp = mkdtempSync(join(tmpdir(), 'edefter-test-'));
  const keyPath = join(tmp, 'key.pem');
  const certPath = join(tmp, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '2',
      '-nodes',
      '-subj',
      '/C=TR/O=Prometa Test/CN=Test Mali Muhur',
    ],
    { stdio: 'pipe' },
  );
  cert = {
    privateKeyPem: readFileSync(keyPath, 'utf8'),
    certificatePem: readFileSync(certPath, 'utf8'),
  };
});

describe('XadesMaliMuhurSigner', () => {
  it('produces a self-consistent, cryptographically valid XAdES-BES signature', () => {
    const signer = new XadesMaliMuhurSigner();
    const signed = signer.sign(SAMPLE_DEFTER, cert, {
      signingTime: new Date('2026-07-01T08:00:00Z'),
    });

    const v = verifyXadesSignature(signed);
    assert.equal(v.documentDigestValid, true, 'document (enveloped) digest must match');
    assert.equal(v.signedPropertiesDigestValid, true, 'SignedProperties digest must match');
    assert.equal(v.signatureValueValid, true, 'RSA SignatureValue must verify');
    assert.equal(v.hasRequiredXadesElements, true, 'required ds/xades elements must be present');
    assert.equal(v.valid, true);
  });

  it('embeds the schematron-required signature elements', () => {
    const signer = new XadesMaliMuhurSigner();
    const signed = signer.sign(SAMPLE_DEFTER, cert, {
      signingTime: new Date('2026-07-01T08:00:00Z'),
    });
    for (const tag of [
      '<ds:Signature',
      '<ds:SignedInfo',
      '<ds:Reference URI=""',
      'enveloped-signature',
      '#SignedProperties1',
      '<ds:SignatureValue>',
      '<ds:KeyInfo>',
      '<ds:X509Certificate>',
      '<ds:Object>',
      '<xades:SigningTime>',
      '<xades:SigningCertificate>',
      '<xades:CertDigest>',
      '<xades:IssuerSerial>',
      '<ds:X509SerialNumber>',
    ]) {
      assert.ok(signed.includes(tag), `signed XML must contain ${tag}`);
    }
    // SHA-1 kullanılmamalı (şematron kuralı)
    assert.ok(!signed.includes('xmldsig#sha1') && !signed.includes('xmldsig#rsa-sha1'));
    assert.ok(signed.includes('2026-07-01T08:00:00Z'));
  });

  it('detects tampering (digest mismatch after content change)', () => {
    const signer = new XadesMaliMuhurSigner();
    const signed = signer.sign(SAMPLE_DEFTER, cert, {
      signingTime: new Date('2026-07-01T08:00:00Z'),
    });
    const tampered = signed.replace('YEV202606000000', 'YEV202606000099');
    const v = verifyXadesSignature(tampered);
    assert.equal(v.documentDigestValid, false, 'tampering must break the document digest');
  });

  it('signs a berat document (root edefter:berat)', () => {
    const berat = buildBeratXml({
      kind: 'journal',
      profile: {
        vkn: '1234567890',
        unvan: 'Test AŞ',
        phone: '0312',
        email: 'a@b.c',
        address: {
          buildingNumber: '1',
          street: 'X',
          city: 'Ankara',
          zip: '06',
          country: 'Türkiye',
        },
        accountant: { name: 'SMMM Ali', engagement: 'Sözleşme' },
      },
      year: 2026,
      month: 6,
      defterUniqueID: 'YEV202606000000',
      numberOfEntries: 2,
      fileSizeMb: 0.01,
      beratGuid: 'test-guid-0001',
    });
    const signer = new XadesMaliMuhurSigner();
    const signed = signer.sign(berat, cert, {
      rootElementName: 'edefter:berat',
      signingTime: new Date('2026-07-01T08:00:00Z'),
    });
    const v = verifyXadesSignature(signed);
    assert.equal(v.valid, true, 'signed berat must self-verify');
  });
});

describe('EdefterBeratBuilder', () => {
  it('builds a well-formed berat with the GİB segment summary', () => {
    const xml = buildBeratXml({
      kind: 'journal',
      profile: {
        vkn: '1234567890',
        unvan: 'Test AŞ',
        phone: '0312',
        email: 'a@b.c',
        address: {
          buildingNumber: '1',
          street: 'X',
          city: 'Ankara',
          zip: '06',
          country: 'Türkiye',
        },
        accountant: { name: 'SMMM Ali', engagement: 'Sözleşme' },
      },
      year: 2026,
      month: 6,
      defterUniqueID: 'YEV202606000000',
      numberOfEntries: 7,
      fileSizeMb: 0.06,
      beratGuid: 'guid-xyz',
    });
    assert.ok(xml.includes('<edefter:berat'));
    assert.ok(
      xml.includes(
        '<gl-bus:numberOfEntries contextRef="journal_context" unitRef="countable">7</gl-bus:numberOfEntries>',
      ),
    );
    assert.ok(
      xml.includes('<gl-cor:uniqueID contextRef="journal_context">guid-xyz</gl-cor:uniqueID>'),
    );
    assert.ok(
      xml.includes(
        '<gl-cor:uniqueID contextRef="journal_context">YEV202606000000</gl-cor:uniqueID>',
      ),
    );
    assert.ok(xml.includes('journal'));
    assert.ok(xml.includes('0.06'));
  });

  it('builds the berat file name', () => {
    assert.equal(
      beratFileName('1234567890', 2026, 6, 'journal'),
      '1234567890-202606-YB-000000.xml',
    );
    assert.equal(beratFileName('1234567890', 2026, 6, 'ledger'), '1234567890-202606-KB-000000.xml');
  });
});

describe('SignEdefterUseCase (orchestration: cert → sign defter → berat → sign berat)', () => {
  const DEFTER_WITH_ENTRIES =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<edefter:defter xmlns:edefter="http://www.edefter.gov.tr" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">` +
    `<xbrli:xbrl xmlns:gl-cor="http://www.xbrl.org/int/gl/cor/2006-10-25" xmlns:xbrli="http://www.xbrl.org/2003/instance">` +
    `<gl-cor:accountingEntries>` +
    `<gl-cor:documentInfo><gl-cor:uniqueID>YEV202606000000</gl-cor:uniqueID></gl-cor:documentInfo>` +
    `<gl-cor:entryHeader><gl-cor:entryNumber>1</gl-cor:entryNumber></gl-cor:entryHeader>` +
    `<gl-cor:entryHeader><gl-cor:entryNumber>2</gl-cor:entryNumber></gl-cor:entryHeader>` +
    `</gl-cor:accountingEntries></xbrli:xbrl></edefter:defter>`;

  it('signs defter + builds & signs berat; both self-verify', () => {
    process.env.EDEFTER_SIGN_KEY_PEM = cert.privateKeyPem;
    process.env.EDEFTER_SIGN_CERT_PEM = cert.certificatePem;
    const certs = new EnvCertificateProvider();
    assert.equal(certs.isConfigured(), true);

    const useCase = new SignEdefterUseCase(new XadesMaliMuhurSigner(), certs);
    const result = useCase.execute({
      kind: 'journal',
      unsignedDefterXml: DEFTER_WITH_ENTRIES,
      profile: {
        vkn: '1234567890',
        unvan: 'Test AŞ',
        phone: '0312',
        email: 'a@b.c',
        address: {
          buildingNumber: '1',
          street: 'X',
          city: 'Ankara',
          zip: '06',
          country: 'Türkiye',
        },
        accountant: { name: 'SMMM Ali', engagement: 'Sözleşme' },
      },
      year: 2026,
      month: 6,
    });

    assert.equal(result.numberOfEntries, 2, 'should count 2 entryHeader');
    assert.equal(result.defterUniqueID, 'YEV202606000000');
    assert.equal(result.defterFileName, '1234567890-202606-Y-000000.xml');
    assert.equal(result.beratFileName, '1234567890-202606-YB-000000.xml');
    assert.equal(
      verifyXadesSignature(result.signedDefterXml).valid,
      true,
      'signed defter must self-verify',
    );
    assert.equal(
      verifyXadesSignature(result.signedBeratXml).valid,
      true,
      'signed berat must self-verify',
    );

    delete process.env.EDEFTER_SIGN_KEY_PEM;
    delete process.env.EDEFTER_SIGN_CERT_PEM;
  });

  it('reports not configured when no cert env is set', () => {
    delete process.env.EDEFTER_SIGN_KEY_PEM;
    delete process.env.EDEFTER_SIGN_CERT_PEM;
    delete process.env.EDEFTER_PFX_PATH;
    assert.equal(new EnvCertificateProvider().isConfigured(), false);
  });
});

process.on('exit', () => {
  try {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});
