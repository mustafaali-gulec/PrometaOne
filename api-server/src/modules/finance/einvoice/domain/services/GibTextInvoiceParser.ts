/**
 * GibTextInvoiceParser — GİB e-Fatura/e-Arşiv görüntüsünün DÜZ METİN hâli →
 * ParsedEInvoice.
 *
 * İki tüketicisi var:
 *   1. PDF yolu: pdf metni çıkarılır (infrastructure/PdfTextExtractor) ve
 *      buraya verilir.
 *   2. GibHtmlInvoiceParser fallback'i: qrvalue JSON'u olmayan/bozuk HTML'ler
 *      tag'leri sıyrılıp buraya düşer.
 *
 * GİB şablonundaki sabit etiketlere dayanır (best-effort):
 *   "Fatura No", "Fatura Tarihi", "ETTN", "VKN/TCKN", "SAYIN",
 *   "Ödenecek Tutar", "Vergiler Dahil Toplam Tutar",
 *   "Malzeme/Hizmet Toplam Tutarı" (veya "Mal Hizmet Toplam Tutarı"), "KDV(...)".
 *
 * Taraf kuralı: belgede ilk görünen VKN/TCKN = satıcı (üst başlık bloğu),
 * "SAYIN" bloğundan sonraki ilk VKN/TCKN = alıcı. direction'a göre karşı taraf
 * seçilir (UblInvoiceParser sözleşmesi: incoming → satıcı, outgoing → alıcı).
 */
import { toCurrency, type Currency } from '../../../domain/valueObjects/Currency.js';
import { Money } from '../../../domain/valueObjects/Money.js';
import { GibHtmlParseError } from '../errors/EInvoiceErrors.js';
import type { InvoiceDirection } from '../valueObjects/InvoiceDirection.js';

import { InvoiceNoteHints } from './InvoiceNoteHints.js';
import type { ParsedEInvoice, ParsedParty } from './UblInvoiceParser.js';

/** Türk biçimli tutar ("21.301,96 TL") → number. */
function trMoney(s: string): number {
  const cleaned = s.replace(/TL|₺/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** "08-06-2026", "08.06.2026", "2026-06-08" (saat eki olabilir) → YYYY-MM-DD | ''. */
function normalizeDate(raw: string): string {
  const s = raw.trim();
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const tr = s.match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
  if (tr) return `${tr[3]}-${tr[2]}-${tr[1]}`;
  return '';
}

const MONEY_RE = String.raw`([\d.]+,\d{2})\s*(?:TL|₺)?`;

function findMoney(text: string, labelRe: string): number | null {
  const m = text.match(new RegExp(`${labelRe}\\s*:?\\s*${MONEY_RE}`, 'i'));
  return m && m[1] !== undefined ? trMoney(m[1]) : null;
}

export const GibTextInvoiceParser = {
  /**
   * @param text     Belgenin düz metni (PDF çıkarımı veya tag'siz HTML).
   * @param rawSource xml_raw kolonuna yazılacak ham kaynak (HTML/metin).
   */
  parse(text: string, direction: InvoiceDirection, rawSource: string): ParsedEInvoice {
    const flat = text.replace(/\s+/g, ' ').trim();

    const ettn = flat.match(/ETTN\s*:?\s*([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})/);
    const invoiceNoM = flat.match(/Fatura\s*No\s*:?\s*([A-Z0-9]{3,8}\d{4,13})/i);
    const uuid = ettn?.[1]?.toLowerCase() ?? '';
    const invoiceNo = invoiceNoM?.[1] ?? '';
    if (uuid === '' && invoiceNo === '') {
      throw new GibHtmlParseError('ETTN ve fatura no bulunamadı — GİB fatura metni tanınamadı');
    }

    const dateM = flat.match(/Fatura\s*Tarihi\s*:?\s*([\d.\-/]{8,10})/i);
    const issueDate = normalizeDate(dateM?.[1] ?? '');

    // VKN/TCKN'ler: ilk = satıcı; SAYIN'dan sonraki ilk = alıcı.
    const vknRe = /(?:VKN|TCKN|VKN\/TCKN|TCKN\/VKN)\s*:?\s*(\d{10,11})/gi;
    const vkns: { index: number; value: string }[] = [];
    let vm: RegExpExecArray | null;
    while ((vm = vknRe.exec(flat)) !== null) {
      vkns.push({ index: vm.index, value: vm[1]! });
    }
    const sayinIdx = flat.search(/SAYIN\b/i);
    const sellerVkn = vkns[0]?.value ?? '';
    const buyerVkn =
      (sayinIdx >= 0 ? vkns.find((v) => v.index > sayinIdx)?.value : vkns[1]?.value) ?? '';

    // Alıcı adı: "SAYIN <ad>" — adres/iletişim etiketine kadar.
    let buyerName = '';
    const buyerM = flat.match(
      /SAYIN\s+(.+?)(?:\s+(?:MAHALLE|MAH\.?|CAD|SOK|BULV|NO:|E-Posta|Tel|Fax|Vergi|VKN|TCKN|Adres)|$)/i,
    );
    if (buyerM && buyerM[1] !== undefined) buyerName = buyerM[1].trim().slice(0, 160);

    // Satıcı adı: belge başındaki ilk şirket benzeri satır (best-effort).
    let sellerName = '';
    const headM = text.match(/^\s*([^\n]{3,160}?(?:A\.Ş\.?|LTD\.?\s*ŞTİ\.?|ŞTİ\.?|A\.S\.?))\s*$/im);
    if (headM && headM[1] !== undefined && headM.index !== undefined) {
      if (sayinIdx < 0 || text.indexOf(headM[1]) < text.search(/SAYIN\b/i)) {
        sellerName = headM[1].trim();
      }
    }

    const currency: Currency = toCurrency(
      /USD|\$/.test(flat) && !/TL|₺/.test(flat) ? 'USD' : 'TRY',
    );

    const subtotalN =
      findMoney(flat, String.raw`Mal(?:zeme)?\s*\/?\s*Hizmet\s*Toplam\s*Tutar[ıi]`) ?? 0;
    const payableN =
      findMoney(flat, String.raw`Ödenecek\s*Tutar`) ??
      findMoney(flat, String.raw`Vergiler\s*Dahil\s*Toplam\s*Tutar`) ??
      0;
    if (payableN === 0 && subtotalN === 0) {
      throw new GibHtmlParseError('tutar alanları bulunamadı — GİB fatura metni tanınamadı');
    }

    // KDV satırları: "KDV(%20,00- Matrah:3.804,00 TL) 760,80 TL" → tutarları topla.
    let kdvN = 0;
    const kdvRe = new RegExp(String.raw`KDV\s*\([^)]*\)\s*:?\s*${MONEY_RE}`, 'gi');
    let km: RegExpExecArray | null;
    while ((km = kdvRe.exec(flat)) !== null) {
      kdvN += trMoney(km[1]!);
    }
    if (kdvN === 0 && payableN > subtotalN && subtotalN > 0) {
      kdvN = Math.round((payableN - subtotalN) * 100) / 100;
    }

    const notes = extractNotes(text);
    const hints = InvoiceNoteHints.extract(notes, issueDate);

    const party: ParsedParty =
      direction === 'incoming'
        ? { vknTckn: sellerVkn, name: sellerName, alias: null }
        : { vknTckn: buyerVkn, name: buyerName, alias: null };

    const scenarioM = flat.match(/Senaryo\s*:?\s*([A-ZÇĞİÖŞÜ]+FATURA)/i);
    const typeM = flat.match(/Fatura\s*Tipi\s*:?\s*([A-ZÇĞİÖŞÜ]{3,20})\b/i);

    return {
      uuid: uuid === '' ? invoiceNo : uuid,
      invoiceNo,
      direction,
      invoiceType: typeM?.[1] ?? null,
      scenario: scenarioM?.[1] ?? null,
      party,
      issueDate,
      dueDate: hints.dueDate,
      currency,
      exchangeRate: null,
      subtotal: Money.fromMajor(subtotalN, currency),
      kdvTotal: Money.fromMajor(kdvN, currency),
      tevkifatTotal: Money.zero(currency),
      konaklamaVergisi: Money.zero(currency),
      ozelTuketimVergisi: Money.zero(currency),
      payableAmount: Money.fromMajor(payableN === 0 ? subtotalN + kdvN : payableN, currency),
      lines: [],
      notes,
      xmlRaw: rawSource,
    };
  },
} as const;

/**
 * "Genel Açıklamalar" bölümünü (varsa) alır; yoksa "Not:" satırlarını toplar.
 * Banka/IBAN gürültüsü vade-proje regex'lerini etkilemediği için agresif
 * filtrelenmez — yalnız bariz IBAN satırları atılır.
 */
function extractNotes(text: string): string | null {
  const lines: string[] = [];
  const genelIdx = text.search(/Genel\s*Açıklamalar/i);
  if (genelIdx >= 0) {
    const region = text.slice(genelIdx, genelIdx + 2500);
    for (const lineRaw of region.split('\n')) {
      const line = lineRaw.trim();
      if (line === '' || /^Genel\s*Açıklamalar/i.test(line)) continue;
      if (/^TR\d{2}[\d ]{10,}$/.test(line)) continue; // IBAN
      lines.push(line);
    }
  } else {
    for (const lineRaw of text.split('\n')) {
      const line = lineRaw.trim();
      if (/^not\s*[:=]/i.test(line) || /vade|proje/i.test(line)) lines.push(line);
    }
  }
  const joined = lines.join('\n').trim();
  return joined === '' ? null : joined;
}
