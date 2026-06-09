/**
 * GibHtmlInvoiceParser — GİB e-Fatura "görüntüleme" HTML'i → ParsedEInvoice.
 *
 * Kullanıcının GİB/entegratör portalından indirdiği e-Fatura HTML çıktısını
 * (UBL XML değil) içe aktarmak için. HTML, QR kodun ham içeriğini taşıyan
 * gömülü bir JSON bloğu barındırır (`<p id="qrvalue">…</p>`):
 *
 *   { vkntckn, avkntckn, senaryo, tip, tarih, no, ettn, parabirimi,
 *     malhizmettoplam, "kdvmatrah(<oran>)", "hesaplanankdv(<oran>)",
 *     vergidahil, odenecek }
 *
 * Bu JSON → başlık + tutarlar GÜVENİLİR kaynaktır. Kalemler (`#lineTable`)
 * entegratör şablonuna göre değiştiğinden BEST-EFFORT okunur; `EInvoice.lines`
 * zaten transient (DB'ye yazılmaz, yalnız UI önizleme). Tam kalem doğruluğu
 * gerekiyorsa UBL XML yolu (UblInvoiceParser) kullanılmalıdır.
 *
 * `vkntckn` = satıcı, `avkntckn` = alıcı. `direction`'a göre karşı taraf
 * seçilir (UblInvoiceParser ile aynı sözleşme): incoming → satıcı, outgoing → alıcı.
 */
import { toCurrency, type Currency } from '../../../domain/valueObjects/Currency.js';
import { Money } from '../../../domain/valueObjects/Money.js';
import { EInvoiceLine } from '../entities/EInvoiceLine.js';
import { GibHtmlParseError } from '../errors/EInvoiceErrors.js';
import type { InvoiceDirection } from '../valueObjects/InvoiceDirection.js';

import type { ParsedEInvoice, ParsedParty } from './UblInvoiceParser.js';

interface QrValue {
  vkntckn?: string;
  avkntckn?: string;
  senaryo?: string;
  tip?: string;
  tarih?: string;
  no?: string;
  ettn?: string;
  parabirimi?: string;
  malhizmettoplam?: string;
  vergidahil?: string;
  odenecek?: string;
  // dinamik: "kdvmatrah(20)" / "hesaplanankdv(20.00)" vb.
  [key: string]: string | undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** JSON tutarı ("15100.00" — nokta ondalıklı) → number. */
function jsonNum(v: string | undefined): number {
  if (v === undefined) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Türk biçimli tutar ("1.450,00 TL") → number. */
function trMoney(s: string): number {
  const cleaned = s.replace(/TL|₺/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export const GibHtmlInvoiceParser = {
  /** İçeriğin GİB e-Fatura HTML görüntüsü olup olmadığını sezgisel saptar. */
  looksLikeGibHtml(content: string): boolean {
    return /id=["']qrvalue["']/.test(content) || /<html[\s>]/i.test(content);
  },

  parse(html: string, direction: InvoiceDirection): ParsedEInvoice {
    const qr = extractQrValue(html);
    if (qr === null) {
      throw new GibHtmlParseError('gömülü qrvalue JSON bloğu bulunamadı/çözülemedi');
    }

    const currencyRaw = (qr.parabirimi ?? 'TRY').toUpperCase();
    let currency: Currency;
    try {
      currency = toCurrency(currencyRaw);
    } catch {
      throw new GibHtmlParseError(`desteklenmeyen para birimi: ${currencyRaw}`);
    }

    const uuid = (qr.ettn ?? '').trim();
    const invoiceNo = (qr.no ?? '').trim();
    if (uuid === '' && invoiceNo === '') {
      throw new GibHtmlParseError('ETTN ve fatura no boş — geçerli e-fatura değil');
    }

    // KDV oranlarını gez: "hesaplanankdv(<oran>)" topla.
    let kdvTotal = Money.zero(currency);
    for (const [key, value] of Object.entries(qr)) {
      if (/^hesaplanankdv\(/i.test(key)) {
        kdvTotal = kdvTotal.plus(Money.fromMajor(jsonNum(value), currency));
      }
    }

    const subtotal = Money.fromMajor(jsonNum(qr.malhizmettoplam), currency);
    const payableAmount = Money.fromMajor(jsonNum(qr.odenecek ?? qr.vergidahil), currency);

    const sellerVkn = (qr.vkntckn ?? '').trim();
    const buyerVkn = (qr.avkntckn ?? '').trim();
    const names = extractPartyNames(html);
    const party: ParsedParty =
      direction === 'incoming'
        ? { vknTckn: sellerVkn, name: names.seller, alias: null }
        : { vknTckn: buyerVkn, name: names.buyer, alias: null };

    return {
      uuid: uuid === '' ? invoiceNo : uuid,
      invoiceNo,
      direction,
      invoiceType: qr.tip ?? null,
      scenario: qr.senaryo ?? null,
      party,
      issueDate: normalizeDate(qr.tarih ?? ''),
      dueDate: null,
      currency,
      exchangeRate: null,
      subtotal,
      kdvTotal,
      tevkifatTotal: Money.zero(currency),
      konaklamaVergisi: Money.zero(currency),
      ozelTuketimVergisi: Money.zero(currency),
      payableAmount,
      lines: extractLines(html, currency),
      xmlRaw: html,
    };
  },
} as const;

/** `<p id="qrvalue" …> { … } </p>` içeriğini çekip JSON parse eder. */
function extractQrValue(html: string): QrValue | null {
  const m = html.match(/id=["']qrvalue["'][^>]*>([\s\S]*?)<\//i);
  if (!m || m[1] === undefined) return null;
  const raw = decodeEntities(m[1]).trim();
  if (raw === '') return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object') return null;
    return parsed as QrValue;
  } catch {
    return null;
  }
}

/** "2026-06-09" veya "09-06-2026[ 11:25]" → "YYYY-MM-DD". */
function normalizeDate(raw: string): string {
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const tr = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (tr) return `${tr[3]}-${tr[2]}-${tr[1]}`;
  return s.slice(0, 10);
}

/**
 * Satıcı/alıcı adlarını HTML başlığından best-effort çeker. Satıcı genelde
 * gövdenin en üstündeki firma adı; alıcı "Sayın <ad>" satırında. Bulunamazsa
 * boş döner (party mapping VKN'den adı doldurur).
 */
function extractPartyNames(html: string): { seller: string; buyer: string } {
  let buyer = '';
  const buyerMatch = stripTags(html).match(
    /SAYIN\s+(.+?)(?:\s+(?:1961|MUTLUKENT|MAHALLE|MAH\.?|CAD|VERGİ|VKN|E-Posta|TEL|FAX|Adres)|$)/i,
  );
  if (buyerMatch && buyerMatch[1] !== undefined) {
    buyer = buyerMatch[1].trim();
  }
  // Satıcı: <h1>/<h2>/<b> içindeki ilk anlamlı firma adı, yoksa boş.
  let seller = '';
  const sellerMatch = html.match(/<(?:h1|h2|b|strong)[^>]*>([\s\S]*?)<\/(?:h1|h2|b|strong)>/i);
  if (sellerMatch && sellerMatch[1] !== undefined) {
    const t = stripTags(sellerMatch[1]);
    if (t !== '' && !/e-?fatura/i.test(t)) seller = t;
  }
  return { seller, buyer };
}

/**
 * `#lineTable` kalemlerini best-effort okur. Sıra-no'su saf sayı olan satırları
 * alır; ad = 3. hücre, satır toplamı = son TL hücresi, miktar/birim/KDV sezgisel.
 * Şablon tanınmazsa boş dizi döner (başlık+tutarlar JSON'dan zaten gelir).
 */
function extractLines(html: string, currency: Currency): EInvoiceLine[] {
  const start = html.search(/id=["']lineTable["']/i);
  if (start < 0) return [];
  // lineTable başından notesTable'a (yoksa belge sonuna) kadar olan bölge.
  const notesIdx = html.slice(start).search(/id=["']notesTable["']/i);
  const region = notesIdx > 0 ? html.slice(start, start + notesIdx) : html.slice(start);

  const lines: EInvoiceLine[] = [];
  const trRegex = /<tr[\s\S]*?<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRegex.exec(region)) !== null) {
    const cells = [...tr[0].matchAll(/<td[\s\S]*?<\/td>/gi)].map((c) => stripTags(c[0]));
    if (cells.length < 4) continue;
    if (!/^\d+$/.test(cells[0]!)) continue; // sıra-no saf sayı değilse veri satırı değil

    const name = cells[2] ?? '';
    if (name === '') continue;

    // Son TL içeren hücre = satır toplamı.
    let lineTotal = Money.zero(currency);
    for (let i = cells.length - 1; i >= 0; i -= 1) {
      if (/TL|₺|\d+,\d{2}/.test(cells[i]!)) {
        lineTotal = Money.fromMajor(trMoney(cells[i]!), currency);
        break;
      }
    }

    // Miktar + birim: "50,0 Paket" / "1 Adet" gibi hücre.
    let quantity = 0;
    let unit = '';
    for (const cell of cells) {
      const qm = cell.match(/^(\d+(?:[.,]\d+)?)\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)$/);
      if (qm && qm[1] !== undefined && qm[2] !== undefined) {
        quantity = Number(qm[1].replace(',', '.')) || 0;
        unit = qm[2];
        break;
      }
    }

    // KDV oranı: "%20,00" / "20" gibi (TL içermeyen) hücre.
    let kdvRate = 0;
    for (const cell of cells) {
      const rm = cell.match(/^%?\s*(\d{1,2})(?:[.,]\d+)?\s*%?$/);
      if (rm && rm[1] !== undefined && !/TL/.test(cell) && cell !== cells[0]) {
        kdvRate = Number(rm[1]) || 0;
        break;
      }
    }

    lines.push(
      EInvoiceLine.create({
        name,
        description: null,
        quantity,
        unit,
        unitPrice: Money.zero(currency),
        lineTotal,
        kdvRatePercent: kdvRate,
        kdvAmount: Money.zero(currency),
        tevkifatRatePercent: null,
        tevkifatAmount: null,
      }),
    );
  }
  return lines;
}
