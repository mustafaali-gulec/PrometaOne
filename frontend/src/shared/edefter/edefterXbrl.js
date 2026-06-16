/* =====================================================================
 * e-DEFTER XBRL-GL ÜRETİCİSİ (Faz 2)
 * ---------------------------------------------------------------------
 * GİB e-Defter Yevmiye ve Defter-i Kebir defterlerini XBRL-GL formatında
 * üretir. Çıktı, GİB e-Defter Paketi'ndeki resmi örnek XML'lerin yapısına
 * (xsd/2006-10-25 gl-* şemaları + edefter_yevmiye.sch / edefter_kebir.sch
 * kuralları) göre yazılmıştır.
 *
 * ÖNEMLİ: Şematron `ds:Signature` elemanını ZORUNLU kılar — yani GİB'e
 * yüklenebilir geçerli bir defter, Mali Mühür/NES ile XAdES imzalanmış
 * olmalıdır. Bu modül İMZASIZ XBRL-GL örneğini (signing pipeline'ının
 * girdisini) üretir; imzalama + berat üretimi Faz 3'tür (sertifika gerekir).
 *
 * Saf fonksiyonlar — React/DOM bağımlılığı yok, test edilebilir.
 * ===================================================================== */

const GL_PLT_XSD = '../xsd/2006-10-25/plt/case-c-b/gl-plt-2006-10-25.xsd';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 0'dan büyük tutarı bilimsel gösterim olmadan, nokta ondalıkla yaz
function fmtAmount(v) {
  const n = Number(v) || 0;
  if (!Number.isFinite(n)) return '0';
  // 2 ondalığa yuvarla ama gereksiz sıfırları at (925, 1027.88)
  const r = Math.round(n * 100) / 100;
  return String(r);
}

function pad(n, len) {
  return String(n).padStart(len, '0');
}

// 'YYYY-MM-DD' → 'YYYYMM'
export function gibPeriod(year, month) {
  return `${year}${pad(month, 2)}`;
}

// Dosya adı: {vkn}-{YYYYMM}-{tip}-{parça}.xml   (tip: Y | K | YB | KB)
export function gibDefterFileName(vkn, year, month, typeCode, part = 0) {
  return `${vkn}-${gibPeriod(year, month)}-${typeCode}-${pad(part, 6)}.xml`;
}

// Bağlam (contextRef) atfı olan basit eleman
function el(tag, ctx, value, attrs = '') {
  return `<${tag} contextRef="${ctx}"${attrs ? ' ' + attrs : ''}>${esc(value)}</${tag}>`;
}

// Hesap kodunu ana + alt hesaba ayır (accountSubID, accountMainID ile başlamalı)
function splitAccount(code, accounts) {
  const full = String(code || '').trim();
  const acc = (accounts || []).find((a) => a.code === full);
  const fullName = acc ? acc.name : '';
  // Ana hesap = ilk 3 karakter (THP ana hesabı), en az 3 karakter zorunlu
  const mainId = full.length >= 3 ? full.slice(0, 3) : full;
  const mainAcc = (accounts || []).find((a) => a.code === mainId);
  const mainDesc = mainAcc ? mainAcc.name : fullName || mainId;
  if (full.length > 3) {
    return { mainId, mainDesc, subId: full, subDesc: fullName || full };
  }
  return { mainId, mainDesc, subId: null, subDesc: null };
}

function accountXml(code, accounts, ctx) {
  const a = splitAccount(code, accounts);
  let out = `<gl-cor:account>`;
  out += el('gl-cor:accountMainID', ctx, a.mainId);
  out += el('gl-cor:accountMainDescription', ctx, a.mainDesc);
  if (a.subId) {
    out += `<gl-cor:accountSub>`;
    out += el('gl-cor:accountSubDescription', ctx, a.subDesc);
    out += el('gl-cor:accountSubID', ctx, a.subId);
    out += `</gl-cor:accountSub>`;
  }
  out += `</gl-cor:account>`;
  return out;
}

// Defterin kapsadığı aya ait, onaylı (posted) fişler; tarihe göre sıralı
export function selectPeriodEntries(entries, year, month) {
  const prefix = `${year}-${pad(month, 2)}`;
  return (entries || [])
    .filter((e) => e.status === 'posted' && typeof e.date === 'string' && e.date.startsWith(prefix))
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (
        (a.entryTime || '').localeCompare(b.entryTime || '') ||
        (a.voucherNo || '').localeCompare(b.voucherNo || '')
      );
    });
}

// Bir fişin defterde geçerli satırları (tutarı 0'dan büyük olanlar)
function entryLines(entry) {
  return (entry.lines || []).filter(
    (l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0,
  );
}

// context + units bloğu (yevmiye/kebir ortak). instant = dönem sonrası ay başı.
function contextAndUnits(ctxId, vkn, year, month) {
  // instant: dönemi izleyen ayın 1'i (örnek dosyalarla aynı: 2018-04 → 2018-05-01)
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const instant = `${nextYear}-${pad(nextMonth, 2)}-01`;
  return (
    `<xbrli:context id="${ctxId}">` +
    `<xbrli:entity><xbrli:identifier scheme="http://www.gib.gov.tr">${esc(vkn)}</xbrli:identifier></xbrli:entity>` +
    `<xbrli:period><xbrli:instant>${instant}</xbrli:instant></xbrli:period>` +
    `</xbrli:context>` +
    `<xbrli:unit id="try"><xbrli:measure>iso4217:TRY</xbrli:measure></xbrli:unit>` +
    `<xbrli:unit id="countable"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit>`
  );
}

function documentInfoXml(ctx, kind, profile, year, month, part) {
  const period = gibPeriod(year, month);
  const prefix = kind === 'journal' ? 'YEV' : 'KEB';
  const uniqueID = `${prefix}${period}${pad(part, 6)}`; // 15 karakter
  const periodStart = `${year}-${pad(month, 2)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const periodEnd = `${year}-${pad(month, 2)}-${pad(lastDay, 2)}`;
  const creationDate = periodEnd; // creationDate >= periodCoveredEnd
  const kindLabel = kind === 'journal' ? 'yevmiye defteri' : 'defter-i kebir';
  return (
    `<gl-cor:documentInfo>` +
    el('gl-cor:entriesType', ctx, kind) +
    el('gl-cor:uniqueID', ctx, uniqueID) +
    el('gl-cor:language', ctx, 'iso639:tr') +
    el('gl-cor:creationDate', ctx, creationDate) +
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
      profile.sourceApplication ||
        `${profile.softwareProducerVkn || profile.vkn}##${profile.softwareProducer || 'Prometa One'}##${profile.softwareName || 'Prometa One e-Defter'}##${profile.softwareVersion || '1.0'}`,
    ) +
    `</gl-cor:documentInfo>`
  );
}

function entityInformationXml(ctx, profile, year) {
  const adr = profile.address || {};
  const acc = profile.accountant || {};
  const orgDesc = profile.isPerson ? 'Adı Soyadı' : 'Kurum Unvanı';
  // Mali yıl: profilde yoksa takvim yılı varsay
  const fyStart = profile.fiscalYearStart || `${year}-01-01`;
  const fyEnd = profile.fiscalYearEnd || `${year}-12-31`;
  let out = `<gl-cor:entityInformation>`;
  out +=
    `<gl-bus:entityPhoneNumber>` +
    el('gl-bus:phoneNumberDescription', ctx, 'main') +
    el('gl-bus:phoneNumber', ctx, profile.phone || '') +
    `</gl-bus:entityPhoneNumber>`;
  out +=
    `<gl-bus:entityEmailAddressStructure>` +
    el('gl-bus:entityEmailAddress', ctx, profile.email || '') +
    `</gl-bus:entityEmailAddressStructure>`;
  out +=
    `<gl-bus:organizationIdentifiers>` +
    el('gl-bus:organizationIdentifier', ctx, profile.unvan || '') +
    el('gl-bus:organizationDescription', ctx, orgDesc) +
    `</gl-bus:organizationIdentifiers>`;
  out +=
    `<gl-bus:organizationAddress>` +
    el('gl-bus:organizationBuildingNumber', ctx, adr.buildingNumber || '') +
    el('gl-bus:organizationAddressStreet', ctx, adr.street || '') +
    (adr.street2 ? el('gl-bus:organizationAddressStreet2', ctx, adr.street2) : '') +
    el('gl-bus:organizationAddressCity', ctx, adr.city || '') +
    el('gl-bus:organizationAddressZipOrPostalCode', ctx, adr.zip || '') +
    el('gl-bus:organizationAddressCountry', ctx, adr.country || 'Türkiye') +
    `</gl-bus:organizationAddress>`;
  if (profile.naceCode) {
    out += el('gl-bus:businessDescription', ctx, profile.naceCode);
  }
  out += el('gl-bus:fiscalYearStart', ctx, fyStart);
  out += el('gl-bus:fiscalYearEnd', ctx, fyEnd);
  out +=
    `<gl-bus:accountantInformation>` +
    el('gl-bus:accountantName', ctx, acc.name || profile.unvan || '') +
    el(
      'gl-bus:accountantEngagementTypeDescription',
      ctx,
      acc.engagement || 'Şirket bünyesinde tutulmaktadır',
    ) +
    `</gl-bus:accountantInformation>`;
  out += `</gl-cor:entityInformation>`;
  return out;
}

/** Yevmiye defteri (journal) XBRL-GL — imzasız. */
export function buildYevmiyeXbrl({ profile, year, month, entries, accounts, part = 0 }) {
  const ctx = 'journal_context';
  const periodEntries = selectPeriodEntries(entries, year, month);
  let lineCounter = 0; // tüm defterde müteselsil lineNumber
  const headers = periodEntries
    .map((entry, idx) => {
      const counter = idx + 1; // entryNumberCounter (müteselsil)
      const entryNumber = entry.yevmiyeMaddeNo ? String(entry.yevmiyeMaddeNo) : pad(counter, 6);
      const lines = entryLines(entry);
      let totalDebit = 0;
      let totalCredit = 0;
      const detailXml = lines
        .map((l) => {
          lineCounter += 1;
          const debit = Number(l.debit) || 0;
          const credit = Number(l.credit) || 0;
          const isDebit = debit > 0;
          const amount = isDebit ? debit : credit;
          if (isDebit) totalDebit += debit;
          else totalCredit += credit;
          return (
            `<gl-cor:entryDetail>` +
            el('gl-cor:lineNumber', ctx, lineCounter) +
            el('gl-cor:lineNumberCounter', ctx, counter, 'decimals="INF" unitRef="countable"') +
            accountXml(l.accountCode, accounts, ctx) +
            el('gl-cor:amount', ctx, fmtAmount(amount), 'decimals="INF" unitRef="try"') +
            el('gl-cor:debitCreditCode', ctx, isDebit ? 'D' : 'C') +
            el('gl-cor:postingDate', ctx, entry.date) +
            el('gl-cor:documentReference', ctx, entryNumber) +
            el('gl-cor:detailComment', ctx, l.description || entry.description || '') +
            `</gl-cor:entryDetail>`
          );
        })
        .join('');
      return (
        `<gl-cor:entryHeader>` +
        el(
          'gl-cor:enteredBy',
          ctx,
          entry.approvedByName || entry.createdBy || profile.creator || '',
        ) +
        el('gl-cor:enteredDate', ctx, entry.date) +
        el('gl-cor:entryNumber', ctx, entryNumber) +
        el('gl-cor:entryComment', ctx, entry.description || '') +
        el('gl-bus:totalDebit', ctx, fmtAmount(totalDebit), 'decimals="INF" unitRef="try"') +
        el('gl-bus:totalCredit', ctx, fmtAmount(totalCredit), 'decimals="INF" unitRef="try"') +
        el('gl-cor:entryNumberCounter', ctx, counter, 'decimals="INF" unitRef="countable"') +
        detailXml +
        `</gl-cor:entryHeader>`
      );
    })
    .join('');

  return wrapDefter(
    contextAndUnits(ctx, profile.vkn, year, month) +
      `<gl-cor:accountingEntries>` +
      documentInfoXml(ctx, 'journal', profile, year, month, part) +
      entityInformationXml(ctx, profile, year) +
      headers +
      `</gl-cor:accountingEntries>`,
    'yevmiye.xslt',
  );
}

/** Defter-i Kebir (ledger) XBRL-GL — imzasız. Hesap bazında gruplanır. */
export function buildKebirXbrl({ profile, year, month, entries, accounts, part = 0 }) {
  const ctx = 'ledger_context';
  const periodEntries = selectPeriodEntries(entries, year, month);

  // Hesap kodu → o hesabın tüm hareketleri (yevmiye madde sırasıyla)
  const byAccount = new Map();
  periodEntries.forEach((entry, idx) => {
    const counter = idx + 1;
    const entryNumber = entry.yevmiyeMaddeNo ? String(entry.yevmiyeMaddeNo) : pad(counter, 6);
    entryLines(entry).forEach((l, li) => {
      const code = String(l.accountCode || '').trim();
      if (!code) return;
      if (!byAccount.has(code)) byAccount.set(code, []);
      const debit = Number(l.debit) || 0;
      const credit = Number(l.credit) || 0;
      byAccount.get(code).push({
        entryNumber,
        date: entry.date,
        lineNumber: li + 1, // yevmiyedeki satır no
        amount: debit > 0 ? debit : credit,
        isDebit: debit > 0,
        description: l.description || entry.description || '',
      });
    });
  });

  let counter = 0;
  const headers = [...byAccount.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, moves]) => {
      let totalDebit = 0;
      let totalCredit = 0;
      const detailXml = moves
        .map((m) => {
          counter += 1;
          if (m.isDebit) totalDebit += m.amount;
          else totalCredit += m.amount;
          return (
            `<gl-cor:entryDetail>` +
            el('gl-cor:lineNumber', ctx, m.lineNumber) +
            el('gl-cor:lineNumberCounter', ctx, counter, 'decimals="INF" unitRef="countable"') +
            accountXml(code, accounts, ctx) +
            el('gl-cor:amount', ctx, fmtAmount(m.amount), 'decimals="INF" unitRef="try"') +
            el('gl-cor:debitCreditCode', ctx, m.isDebit ? 'D' : 'C') +
            el('gl-cor:postingDate', ctx, m.date) +
            el('gl-cor:documentReference', ctx, m.entryNumber) +
            el('gl-cor:detailComment', ctx, m.description) +
            `</gl-cor:entryDetail>`
          );
        })
        .join('');
      return (
        `<gl-cor:entryHeader>` +
        el('gl-bus:totalDebit', ctx, fmtAmount(totalDebit), 'decimals="INF" unitRef="try"') +
        el('gl-bus:totalCredit', ctx, fmtAmount(totalCredit), 'decimals="INF" unitRef="try"') +
        detailXml +
        `</gl-cor:entryHeader>`
      );
    })
    .join('');

  return wrapDefter(
    contextAndUnits(ctx, profile.vkn, year, month) +
      `<gl-cor:accountingEntries>` +
      documentInfoXml(ctx, 'ledger', profile, year, month, part) +
      entityInformationXml(ctx, profile, year) +
      headers +
      `</gl-cor:accountingEntries>`,
    'kebir.xslt',
  );
}

// edefter:defter + xbrli:xbrl zarfı (imza bloğu Faz 3'te eklenecek)
function wrapDefter(inner, xslt) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?xml-stylesheet type="text/xsl" href="${xslt}"?>\n` +
    `<edefter:defter xmlns:edefter="http://www.edefter.gov.tr" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.edefter.gov.tr ../xsd/edefter.xsd">` +
    `<xbrli:xbrl xmlns:gl-bus="http://www.xbrl.org/int/gl/bus/2006-10-25" xmlns:gl-cor="http://www.xbrl.org/int/gl/cor/2006-10-25" xmlns:gl-plt="http://www.xbrl.org/int/gl/plt/2006-10-25" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:iso639="http://www.xbrl.org/2005/iso639" xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:xlink="http://www.w3.org/1999/xlink" xsi:schemaLocation="http://www.xbrl.org/int/gl/plt/2006-10-25 ${GL_PLT_XSD}">` +
    `<link:schemaRef xlink:href="${GL_PLT_XSD}" xlink:type="simple"/>` +
    inner +
    `</xbrli:xbrl>` +
    `</edefter:defter>`
  );
}

// Mükellef profilinde eksik (GİB zorunlu) alanları döndürür — imza öncesi uyarı
export function missingProfileFields(profile) {
  const m = [];
  const adr = profile.address || {};
  const acc = profile.accountant || {};
  if (!profile.vkn) m.push('VKN/TCKN');
  if (!profile.unvan) m.push('Unvan');
  if (!profile.phone) m.push('Telefon');
  if (!profile.email) m.push('E-posta');
  if (!adr.buildingNumber) m.push('Bina no');
  if (!adr.street) m.push('Cadde/Sokak');
  if (!adr.city) m.push('İl');
  if (!adr.zip) m.push('Posta kodu');
  if (!acc.name) m.push('Muhasebeci adı (SMMM)');
  return m;
}
