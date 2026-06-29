/**
 * Kasa Excel Import parser — SAF use-case (DB/repo yok, tamamen deterministik).
 *
 * Ham hücre matrislerini (string[][]) normalize kasa hareketlerine ve tespit
 * edilen gider kartlarına çevirir. İki format desteklenir:
 *   - can_tekel_daily: CAN TEKEL günlük kasa raporu (HASILATLAR / GİDERLER /
 *     AÇIK HESAP bölümleri)
 *   - generic: kolon eşlemeli serbest tablo
 *
 * Para ve tarih ayrıştırma TR ve EN formatlarını tolere eder.
 */
import type { FlowDirection } from '../../domain/entities/ExpenseCard.js';
import type {
  GenericColumnMap,
  KasaImportEntry,
  KasaImportExpenseCard,
  KasaImportResult,
  KasaImportSheet,
  ParseKasaImportInput,
  PaymentMethod,
} from '../dto/KasaImportDtos.js';

const DEFAULT_YEAR = 2026;

const EN_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/**
 * Para metnini sayıya çevirir. ₺, NBSP ve boşluklar temizlenir.
 *   - hem ',' hem '.' varsa: SONUNCUSU ondalık, diğeri binlik
 *   - sadece ',' varsa: ondalık
 *   - sadece '.' varsa: ondalık
 * Mutlak değer döner (işaret type tarafından taşınır). Geçersiz/boş → 0.
 */
export function parseAmount(raw: string): number {
  if (raw == null) return 0;
  let s = String(raw)
    .replace(/₺/g, '') // ₺
    .replace(/TL/gi, '')
    .replace(/\s/g, '')
    .trim();
  if (s.length === 0) return 0;
  // Negatif işaret / parantez
  const negative = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '').replace(/^-/, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // virgül ondalık → noktaları (binlik) sil, virgülü '.' yap
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // nokta ondalık → virgülleri (binlik) sil
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  // sadece '.' → zaten ondalık; hiçbiri → düz tamsayı

  // kalan binlik virgüller olabilir (yukarıda temizlendi); fazlalık nokta tek
  const n = Number.parseFloat(s);
  if (Number.isNaN(n)) return 0;
  const abs = Math.abs(n);
  return negative ? abs : abs;
}

/** Bir hücre tam tarih mi ("Friday, May 01, 2026") — YYYY-MM-DD döner ya da null. */
function parseFullDate(cell: string): string | null {
  if (!cell) return null;
  const text = cell.trim();
  // İngilizce ay adı + gün + yıl ara
  const m = /([A-Za-z]+)\s+(\d{1,2})\s*,?\s*(\d{4})/.exec(text);
  if (m) {
    const monthName = m[1]!.toLowerCase();
    const month = EN_MONTHS[monthName];
    if (month) {
      const day = parseInt(m[2]!, 10);
      const year = parseInt(m[3]!, 10);
      if (day >= 1 && day <= 31) {
        return `${year}-${pad2(month)}-${pad2(day)}`;
      }
    }
  }
  // ISO benzeri YYYY-MM-DD
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "DD.MM" sayfa adı + yıl → YYYY-MM-DD (ya da null). */
function parseSheetNameDate(name: string, year: number): string | null {
  const m = /^\s*(\d{1,2})[.\-/](\d{1,2})\s*$/.exec(name);
  if (!m) return null;
  const day = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function cellAt(row: string[] | undefined, idx: number): string {
  if (!row) return '';
  const v = row[idx];
  return v == null ? '' : String(v).trim();
}

function upper(s: string): string {
  return s.trim().toLocaleUpperCase('tr-TR');
}

/** Workbook genelinde bulunabilecek ilk tam tarihten yılı türet (deterministik). */
function deriveYear(sheets: KasaImportSheet[], inputYear?: number): number {
  if (inputYear && Number.isFinite(inputYear)) return inputYear;
  for (const sheet of sheets) {
    for (let r = 0; r < Math.min(sheet.rows.length, 5); r += 1) {
      const row = sheet.rows[r] ?? [];
      for (const cell of row) {
        const d = parseFullDate(cell ?? '');
        if (d) return parseInt(d.slice(0, 4), 10);
      }
    }
  }
  return DEFAULT_YEAR;
}

/** Sayfanın tarihini belirler: ilk ~3 satırda tam tarih, yoksa sayfa adı. */
function resolveSheetDate(sheet: KasaImportSheet, year: number): string | null {
  for (let r = 0; r < Math.min(sheet.rows.length, 3); r += 1) {
    const row = sheet.rows[r] ?? [];
    for (const cell of row) {
      const d = parseFullDate(cell ?? '');
      if (d) return d;
    }
  }
  return parseSheetNameDate(sheet.name, year);
}

// --- gider kartı toplayıcı --------------------------------------------------
interface CardAcc {
  name: string;
  category: string;
  direction: FlowDirection;
  occurrences: number;
}

class ExpenseCardCollector {
  private readonly map = new Map<string, CardAcc>();

  add(name: string, category: string, direction: FlowDirection, occurrences = 1): void {
    const key = upper(name);
    if (key.length === 0) return;
    const existing = this.map.get(key);
    if (existing) {
      existing.occurrences += occurrences;
      if (existing.category.length === 0 && category.trim().length > 0) {
        existing.category = category.trim();
      }
    } else {
      this.map.set(key, {
        name: name.trim(),
        category: category.trim(),
        direction,
        occurrences,
      });
    }
  }

  toArray(): KasaImportExpenseCard[] {
    return [...this.map.values()].map((c) => ({
      name: c.name,
      category: c.category,
      direction: c.direction,
      occurrences: c.occurrences,
    }));
  }
}

// ============================================================================
// can_tekel_daily parser
// ============================================================================
function parseCanTekelSheet(
  sheet: KasaImportSheet,
  date: string,
  entries: KasaImportEntry[],
  cards: ExpenseCardCollector,
): void {
  const rows = sheet.rows;
  const isGenelToplam = (row: string[]): boolean =>
    upper(cellAt(row, 2)).includes('GENEL TOPLAM') ||
    upper(cellAt(row, 3)).includes('GENEL TOPLAM');

  // --- 1) HASILATLAR (gelirler) ---
  const hasilatIdx = rows.findIndex((row) =>
    (row ?? []).some((cell) => upper(cell ?? '') === 'HASILATLAR'),
  );
  if (hasilatIdx >= 0) {
    for (let r = hasilatIdx + 1; r < rows.length; r += 1) {
      const row = rows[r] ?? [];
      if (isGenelToplam(row)) break;
      const label = cellAt(row, 1) || cellAt(row, 2);
      if (label.length === 0) continue;
      // başlık satırını ("Nakit"/"Kredi Kartı"/"Toplam") atla
      const up = upper(label);
      if (up === 'NAKIT' || up === 'KREDI KARTI' || up === 'TOPLAM') continue;
      const cashAmt = parseAmount(cellAt(row, 4));
      const cardAmt = parseAmount(cellAt(row, 5));
      pushIfPositive(entries, {
        date,
        type: 'in',
        method: 'cash',
        amount: cashAmt,
        description: label,
        category: 'HASILAT',
        source: 'HASILAT',
        invoiceNo: '',
        sheetName: sheet.name,
        rowRef: r,
      });
      pushIfPositive(entries, {
        date,
        type: 'in',
        method: 'card',
        amount: cardAmt,
        description: label,
        category: 'HASILAT',
        source: 'HASILAT',
        invoiceNo: '',
        sheetName: sheet.name,
        rowRef: r,
      });
    }
  }

  // --- 2) GİDERLER (giderler) ---
  const giderIdx = rows.findIndex((row) =>
    (row ?? []).some((cell) => upper(cell ?? '') === 'GİDERLER'),
  );
  if (giderIdx >= 0) {
    for (let r = giderIdx + 1; r < rows.length; r += 1) {
      const row = rows[r] ?? [];
      if (isGenelToplam(row)) break;
      const description = cellAt(row, 2);
      const mahiyeti = cellAt(row, 3);
      const source = cellAt(row, 1);
      const cashAmt = parseAmount(cellAt(row, 4));
      const cardAmt = parseAmount(cellAt(row, 5));
      const invoiceNo = cellAt(row, 6);
      // boş numaralı satırlar (açıklama yok + tutar yok) atlanır
      if (description.length === 0 && cashAmt === 0 && cardAmt === 0) continue;
      if (description.length === 0) continue;
      // alt başlık satırını atla
      const up = upper(description);
      if (up === 'GİDERLER') continue;

      let emitted = false;
      if (cashAmt > 0) {
        entries.push({
          date,
          type: 'out',
          amount: cashAmt,
          paymentMethod: 'cash',
          description,
          category: mahiyeti,
          source,
          invoiceNo,
          sheetName: sheet.name,
          rowRef: r,
        });
        emitted = true;
      }
      if (cardAmt > 0) {
        entries.push({
          date,
          type: 'out',
          amount: cardAmt,
          paymentMethod: 'card',
          description,
          category: mahiyeti,
          source,
          invoiceNo,
          sheetName: sheet.name,
          rowRef: r,
        });
        emitted = true;
      }
      if (emitted && mahiyeti.length > 0) {
        cards.add(mahiyeti, mahiyeti, 'out');
      }
    }
  }

  // --- 3) AÇIK HESAP (açık hesap / kredili alımlar — kasa girişi YOK) ---
  const acikIdx = rows.findIndex((row) =>
    (row ?? []).some((cell) => upper(cell ?? '') === 'AÇIK HESAP'),
  );
  if (acikIdx >= 0) {
    // başlık satırı: FATURA NO(0) FİRMA ADI(2) MAHİYETİ(4) TUTARI(6)
    for (let r = acikIdx + 1; r < rows.length; r += 1) {
      const row = rows[r] ?? [];
      const c4 = upper(cellAt(row, 4));
      // başlık satırını atla
      if (c4 === 'MAHİYETİ' || c4 === 'MAHIYETI') continue;
      // TOPLAM ya da tamamen boş satır → bölüm bitti
      const joined = (row ?? []).map((c) => (c ?? '').trim()).join('');
      if (joined.length === 0) break;
      if (upper(cellAt(row, 0)).includes('TOPLAM') || upper(cellAt(row, 2)).includes('TOPLAM'))
        break;
      const mahiyeti = cellAt(row, 4);
      if (mahiyeti.length > 0) {
        cards.add(mahiyeti, mahiyeti, 'out');
      }
    }
  }
}

interface PushArgs {
  date: string;
  type: FlowDirection;
  method: PaymentMethod;
  amount: number;
  description: string;
  category: string;
  source: string;
  invoiceNo: string;
  sheetName: string;
  rowRef: number;
}

function pushIfPositive(entries: KasaImportEntry[], a: PushArgs): void {
  if (a.amount <= 0) return;
  entries.push({
    date: a.date,
    type: a.type,
    amount: a.amount,
    paymentMethod: a.method,
    description: a.description,
    category: a.category,
    source: a.source,
    invoiceNo: a.invoiceNo,
    sheetName: a.sheetName,
    rowRef: a.rowRef,
  });
}

// ============================================================================
// generic parser
// ============================================================================
function detectType(text: string): FlowDirection {
  const t = text.toLocaleLowerCase('tr-TR');
  if (/gir|tahsil|gelir|\bin\b/.test(t)) return 'in';
  if (/çık|cik|öde|ode|gider|\bout\b/.test(t)) return 'out';
  return 'out';
}

function parseGenericSheet(
  sheet: KasaImportSheet,
  map: GenericColumnMap,
  year: number,
  entries: KasaImportEntry[],
  cards: ExpenseCardCollector,
  warnings: string[],
): void {
  const sheetFallbackDate = parseSheetNameDate(sheet.name, year);
  for (let r = map.headerRowIndex + 1; r < sheet.rows.length; r += 1) {
    const row = sheet.rows[r] ?? [];
    const joined = row.map((c) => (c ?? '').trim()).join('');
    if (joined.length === 0) continue;

    const dateCell = cellAt(row, map.date);
    const date = parseFullDate(dateCell) ?? sheetFallbackDate;
    if (!date) {
      warnings.push(`Sayfa '${sheet.name}' satır ${r}: tarih ayrıştırılamadı`);
      continue;
    }
    const description = cellAt(row, map.description);
    const category = map.category !== undefined ? cellAt(row, map.category) : '';
    const invoiceNo = map.invoiceNo !== undefined ? cellAt(row, map.invoiceNo) : '';

    if (map.amountIn !== undefined || map.amountOut !== undefined) {
      const inAmt = map.amountIn !== undefined ? parseAmount(cellAt(row, map.amountIn)) : 0;
      const outAmt = map.amountOut !== undefined ? parseAmount(cellAt(row, map.amountOut)) : 0;
      if (inAmt > 0) {
        entries.push(mkEntry(date, 'in', inAmt, description, category, invoiceNo, sheet.name, r));
        cards.add(category || description, category, 'out');
      }
      if (outAmt > 0) {
        entries.push(mkEntry(date, 'out', outAmt, description, category, invoiceNo, sheet.name, r));
        cards.add(category || description, category, 'out');
      }
    } else {
      const amount = map.amount !== undefined ? parseAmount(cellAt(row, map.amount)) : 0;
      if (amount <= 0) continue;
      const type: FlowDirection =
        map.type !== undefined ? detectType(cellAt(row, map.type)) : 'out';
      entries.push(mkEntry(date, type, amount, description, category, invoiceNo, sheet.name, r));
      cards.add(category || description, category, 'out');
    }
  }
}

function mkEntry(
  date: string,
  type: FlowDirection,
  amount: number,
  description: string,
  category: string,
  invoiceNo: string,
  sheetName: string,
  rowRef: number,
): KasaImportEntry {
  return {
    date,
    type,
    amount,
    paymentMethod: '',
    description,
    category,
    source: '',
    invoiceNo,
    sheetName,
    rowRef,
  };
}

// ============================================================================
// Use-case
// ============================================================================
export class ParseKasaImportUseCase {
  execute(input: ParseKasaImportInput): KasaImportResult {
    const entries: KasaImportEntry[] = [];
    const cards = new ExpenseCardCollector();
    const warnings: string[] = [];
    const year = deriveYear(input.sheets, input.year);

    for (const sheet of input.sheets) {
      if (input.formatId === 'can_tekel_daily') {
        const date = resolveSheetDate(sheet, year);
        if (!date) {
          warnings.push(`Sayfa '${sheet.name}': tarih belirlenemedi, atlandı`);
          continue;
        }
        parseCanTekelSheet(sheet, date, entries, cards);
      } else {
        // generic
        if (!input.columnMap) {
          warnings.push('generic format için columnMap gerekli, atlandı');
          break;
        }
        parseGenericSheet(sheet, input.columnMap, year, entries, cards, warnings);
      }
    }

    const expenseCards = cards.toArray();
    const totalIn = entries.filter((e) => e.type === 'in').reduce((s, e) => s + e.amount, 0);
    const totalOut = entries.filter((e) => e.type === 'out').reduce((s, e) => s + e.amount, 0);
    const dates = entries.map((e) => e.date).sort();

    return {
      formatId: input.formatId,
      entries,
      expenseCards,
      warnings,
      summary: {
        entryCount: entries.length,
        totalIn: round2(totalIn),
        totalOut: round2(totalOut),
        sheetCount: input.sheets.length,
        expenseCardCount: expenseCards.length,
        dateRange: {
          from: dates.length > 0 ? dates[0]! : null,
          to: dates.length > 0 ? dates[dates.length - 1]! : null,
        },
      },
    };
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
