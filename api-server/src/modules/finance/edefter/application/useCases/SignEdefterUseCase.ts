/**
 * e-Defter imzalama + berat üretimi use-case'i (Faz 3).
 *
 * Akış (GİB standart pipeline'ı):
 *   imzasız XBRL-GL defter  →  Mali Mühür ile imzala (XAdES-BES)
 *   →  imzalı defterin özetinden berat üret  →  beratı imzala
 *   →  {imzalı defter, imzalı berat, dosya adları} döndür.
 * (GİB web servisi beratı karşı-imzalar — o adım web servis entegrasyonu işidir.)
 */
import { randomUUID } from 'node:crypto';

import {
  buildBeratXml,
  beratFileName,
  type BeratProfile,
} from '../../domain/services/EdefterBeratBuilder.js';
import type { CertificateProvider } from '../ports/CertificateProvider.js';
import type { XmlSigner } from '../ports/XmlSigner.js';

export interface SignEdefterInput {
  kind: 'journal' | 'ledger';
  /** Faz 2'de üretilmiş imzasız XBRL-GL defter XML'i. */
  unsignedDefterXml: string;
  profile: BeratProfile;
  year: number;
  month: number;
  part?: number;
}

export interface SignEdefterResult {
  signedDefterXml: string;
  signedBeratXml: string;
  defterFileName: string;
  beratFileName: string;
  numberOfEntries: number;
  defterUniqueID: string;
}

function countEntries(xml: string): number {
  return (xml.match(/<gl-cor:entryHeader[\s>]/g) || []).length;
}
function extractUniqueID(xml: string): string {
  const m = xml.match(/<gl-cor:uniqueID[^>]*>([^<]+)<\/gl-cor:uniqueID>/);
  return m?.[1] ?? '';
}
function defterFileName(
  vkn: string,
  year: number,
  month: number,
  kind: 'journal' | 'ledger',
  part: number,
): string {
  const code = kind === 'journal' ? 'Y' : 'K';
  return `${vkn}-${year}${String(month).padStart(2, '0')}-${code}-${String(part).padStart(6, '0')}.xml`;
}

export class SignEdefterUseCase {
  constructor(
    private readonly signer: XmlSigner,
    private readonly certs: CertificateProvider,
  ) {}

  execute(input: SignEdefterInput): SignEdefterResult {
    const { kind, unsignedDefterXml, profile, year, month, part = 0 } = input;
    const cert = this.certs.get();

    // 1) Defteri imzala
    const signedDefterXml = this.signer.sign(unsignedDefterXml, cert, {
      rootElementName: 'edefter:defter',
      signerRole: 'Mali Mühür',
    });

    // 2) Berat üret (imzalı defterin özeti)
    const numberOfEntries = countEntries(unsignedDefterXml);
    const defterUniqueID = extractUniqueID(unsignedDefterXml);
    const fileSizeMb = Buffer.byteLength(signedDefterXml, 'utf8') / (1024 * 1024);
    const beratXml = buildBeratXml({
      kind,
      profile,
      year,
      month,
      defterUniqueID,
      numberOfEntries,
      fileSizeMb,
      beratGuid: randomUUID(),
      part,
    });

    // 3) Beratı imzala
    const signedBeratXml = this.signer.sign(beratXml, cert, {
      rootElementName: 'edefter:berat',
      signerRole: 'Mali Mühür',
    });

    return {
      signedDefterXml,
      signedBeratXml,
      defterFileName: defterFileName(profile.vkn, year, month, kind, part),
      beratFileName: beratFileName(profile.vkn, year, month, kind, part),
      numberOfEntries,
      defterUniqueID,
    };
  }
}
