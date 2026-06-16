/**
 * e-Defter Berat XML üreticisi (GİB).
 *
 * Berat, imzalanmış deftere ait özet/onay belgesidir (`edefter:berat`). Defterin
 * tüm entry verisini taşımaz; dönem + mükellef + muhasebeci bilgisi ile
 * `xbrli:segment` içinde madde sayısı (numberOfEntries), berat GUID'i ve dosya
 * boyutu (measurableQuantity, MB) taşır. Berat da Mali Mühür ile imzalanır;
 * GİB web servisi beratı karşı-imzalayıp (GIB- ön ekli) geri döner.
 *
 * Dayanak: GİB e-Defter Paketi `xml/*-YB-*.xml` / `*-KB-*.xml` örnekleri +
 * `sch/edefter_berat.sch`. Saf fonksiyon — kripto/DOM bağımlılığı yok.
 */

export interface BeratProfile {
  vkn: string;
  unvan: string;
  isPerson?: boolean;
  phone?: string;
  email?: string;
  address?: {
    buildingNumber?: string;
    street?: string;
    street2?: string;
    city?: string;
    zip?: string;
    country?: string;
  };
  naceCode?: string;
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
  creator?: string;
  accountant?: { name?: string; engagement?: string };
  sourceApplication?: string;
}

export interface BeratInput {
  kind: 'journal' | 'ledger';
  profile: BeratProfile;
  year: number;
  month: number;
  /** Deftere ait uniqueID (YEV/KEB + dönem + parça), berat bununla eşleşir. */
  defterUniqueID: string;
  /** Defterdeki yevmiye madde (entryHeader) sayısı. */
  numberOfEntries: number;
  /** İmzalı defter dosyasının boyutu (MB). */
  fileSizeMb: number;
  /** Berat tekil kimliği (GUID). Üretici dışarıdan verir (deterministik test). */
  beratGuid: string;
  part?: number;
}

const GL_PLT_XSD = '../xsd/2006-10-25/plt/case-c-b/gl-plt-2006-10-25.xsd';

type Scalar = string | number | null | undefined;

function esc(s: Scalar): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}
function el(tag: string, ctx: string, value: Scalar, attrs = ''): string {
  return `<${tag} contextRef="${ctx}"${attrs ? ' ' + attrs : ''}>${esc(value)}</${tag}>`;
}

/** Berat XML (imzasız) üretir. */
export function buildBeratXml(input: BeratInput): string {
  const { kind, profile, year, month, defterUniqueID, numberOfEntries, fileSizeMb, beratGuid } =
    input;
  const ctx = kind === 'journal' ? 'journal_context' : 'ledger_context';
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const instant = `${nextYear}-${pad(nextMonth, 2)}-01`;
  const periodStart = `${year}-${pad(month, 2)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const periodEnd = `${year}-${pad(month, 2)}-${pad(lastDay, 2)}`;
  const kindLabel = kind === 'journal' ? 'yevmiye defteri beratı' : 'defter-i kebir beratı';
  const adr = profile.address || {};
  const acc = profile.accountant || {};
  const orgDesc = profile.isPerson ? 'Adı Soyadı' : 'Kurum Unvanı';
  const fyStart = profile.fiscalYearStart || `${year}-01-01`;
  const fyEnd = profile.fiscalYearEnd || `${year}-12-31`;

  const context =
    `<xbrli:context id="${ctx}">` +
    `<xbrli:entity>` +
    `<xbrli:identifier scheme="http://www.gib.gov.tr">${esc(profile.vkn)}</xbrli:identifier>` +
    `<xbrli:segment>` +
    `<gl-bus:numberOfEntries contextRef="${ctx}" unitRef="countable">${numberOfEntries}</gl-bus:numberOfEntries>` +
    `<gl-cor:uniqueID contextRef="${ctx}">${esc(beratGuid)}</gl-cor:uniqueID>` +
    `<gl-bus:measurableQuantity contextRef="${ctx}" unitRef="countable">${Number(fileSizeMb).toFixed(2)}</gl-bus:measurableQuantity>` +
    `</xbrli:segment>` +
    `</xbrli:entity>` +
    `<xbrli:period><xbrli:instant>${instant}</xbrli:instant></xbrli:period>` +
    `</xbrli:context>` +
    `<xbrli:unit id="try"><xbrli:measure>iso4217:TRY</xbrli:measure></xbrli:unit>` +
    `<xbrli:unit id="countable"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit>`;

  const documentInfo =
    `<gl-cor:documentInfo>` +
    el('gl-cor:entriesType', ctx, kind) +
    el('gl-cor:uniqueID', ctx, defterUniqueID) +
    el('gl-cor:language', ctx, 'iso639:tr') +
    el('gl-cor:creationDate', ctx, periodEnd) +
    el('gl-bus:creator', ctx, profile.creator || profile.unvan || '') +
    el(
      'gl-cor:entriesComment',
      ctx,
      `${periodStart} - ${periodEnd} arası ${profile.unvan || ''} ${kindLabel}.`,
    ) +
    el('gl-cor:periodCoveredStart', ctx, periodStart) +
    el('gl-cor:periodCoveredEnd', ctx, periodEnd) +
    el(
      'gl-bus:sourceApplication',
      ctx,
      profile.sourceApplication || `${profile.vkn}##Promet Bilisim##Prometa One e-Defter##1.0`,
    ) +
    `</gl-cor:documentInfo>`;

  const entityInformation =
    `<gl-cor:entityInformation>` +
    `<gl-bus:entityPhoneNumber>` +
    el('gl-bus:phoneNumberDescription', ctx, 'main') +
    el('gl-bus:phoneNumber', ctx, profile.phone || '') +
    `</gl-bus:entityPhoneNumber>` +
    `<gl-bus:entityEmailAddressStructure>` +
    el('gl-bus:entityEmailAddress', ctx, profile.email || '') +
    `</gl-bus:entityEmailAddressStructure>` +
    `<gl-bus:organizationIdentifiers>` +
    el('gl-bus:organizationIdentifier', ctx, profile.unvan || '') +
    el('gl-bus:organizationDescription', ctx, orgDesc) +
    `</gl-bus:organizationIdentifiers>` +
    `<gl-bus:organizationAddress>` +
    el('gl-bus:organizationBuildingNumber', ctx, adr.buildingNumber || '') +
    el('gl-bus:organizationAddressStreet', ctx, adr.street || '') +
    (adr.street2 ? el('gl-bus:organizationAddressStreet2', ctx, adr.street2) : '') +
    el('gl-bus:organizationAddressCity', ctx, adr.city || '') +
    el('gl-bus:organizationAddressZipOrPostalCode', ctx, adr.zip || '') +
    el('gl-bus:organizationAddressCountry', ctx, adr.country || 'Türkiye') +
    `</gl-bus:organizationAddress>` +
    (profile.naceCode ? el('gl-bus:businessDescription', ctx, profile.naceCode) : '') +
    el('gl-bus:fiscalYearStart', ctx, fyStart) +
    el('gl-bus:fiscalYearEnd', ctx, fyEnd) +
    `<gl-bus:accountantInformation>` +
    el('gl-bus:accountantName', ctx, acc.name || profile.unvan || '') +
    el(
      'gl-bus:accountantEngagementTypeDescription',
      ctx,
      acc.engagement || 'Şirket bünyesinde tutulmaktadır',
    ) +
    `</gl-bus:accountantInformation>` +
    `</gl-cor:entityInformation>`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?xml-stylesheet type="text/xsl" href="berat.xslt"?>\n` +
    `<edefter:berat xmlns:edefter="http://www.edefter.gov.tr" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.edefter.gov.tr ../xsd/edefter.xsd">` +
    `<xbrli:xbrl xmlns:gl-bus="http://www.xbrl.org/int/gl/bus/2006-10-25" xmlns:gl-cor="http://www.xbrl.org/int/gl/cor/2006-10-25" xmlns:gl-plt="http://www.xbrl.org/int/gl/plt/2006-10-25" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:iso639="http://www.xbrl.org/2005/iso639" xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:xlink="http://www.w3.org/1999/xlink">` +
    `<link:schemaRef xlink:href="${GL_PLT_XSD}" xlink:type="simple"/>` +
    context +
    `<gl-cor:accountingEntries>` +
    documentInfo +
    entityInformation +
    `</gl-cor:accountingEntries>` +
    `</xbrli:xbrl>` +
    `</edefter:berat>`
  );
}

/** Berat dosya adı: {vkn}-{YYYYMM}-{YB|KB}-{parça}.xml */
export function beratFileName(
  vkn: string,
  year: number,
  month: number,
  kind: 'journal' | 'ledger',
  part = 0,
): string {
  const code = kind === 'journal' ? 'YB' : 'KB';
  return `${vkn}-${year}${pad(month, 2)}-${code}-${pad(part, 6)}.xml`;
}
