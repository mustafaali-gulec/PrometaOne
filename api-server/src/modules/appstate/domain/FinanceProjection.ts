/**
 * FinanceProjection — app-state blob'unun FİNANS çekirdeğini MEVCUT normalize
 * finance tablolarının satırlarına projeksiyonlar (048_finance_projection.sql).
 *
 * SAF fonksiyon: IO yok, birim testlenebilir. PUT /v1/app-state/promet:data
 * sonrası SetAppStateUseCase bunu çağırıp PgFinanceProjectionRepository
 * .replaceAll'a verir (access/hr projeksiyonlarıyla aynı fire-and-forget kalıbı).
 *
 * Blob kaynak şekilleri (044_app_state_mirror.sql view'ları + App.jsx hedefli
 * grep ile DOĞRULANDI):
 *   banks[] (GLOBAL KÖK ALAN, companyData dışı; ~29181/~76517)
 *                    = { id:"bnk_...", name, code, color }
 *   companyData[cid].bankAccounts[] (~76547)
 *                    = { id:"acc_...", bankId, name, iban, accountingCode,
 *                        currency, openingBalance, cashflowCatId, active }
 *   companyData[cid].kasaAccounts[] = MEZUN (bkz. GRADUATED_COLLECTIONS) —
 *                      yansıtılmaz; yalnız transfer para-birimi fallback'i için
 *                      salt-okunur okunur (satır üretilmez).
 *   companyData[cid].inflows/outflows/nonPnlOutflows/kasaCategories[]
 *                    = { id:"in_1"/"out_1"/"npo_1"/"kc_...", name }
 *                      — 4 alan adı categories.section enum'uyla BİREBİR.
 *   companyData[cid].cells = MAP { "<catId>:<monthIdx>": number } (~30319,
 *                      ~75649); fiscal_year şirket alanı fiscalYear'dan gelir.
 *   companyData[cid].kasaEntries[] = MEZUN (bkz. GRADUATED_COLLECTIONS) —
 *                      yansıtılmaz.
 *   companyData[cid].transfers[] (~65089 + TransferModal ~95773)
 *                    = { id:"trf_...", date, fromType(bank|kasa), fromId,
 *                        toType, toId, fromAmount, toAmount, fromCurrency,
 *                        toCurrency, description, cashflowCatId }
 *   companyData[cid].invoices[] — İKİ eleman şekli (v_blob_invoices COALESCE
 *     mantığı):
 *       elle girilen (~108355): { id:"inv_...", type(in|out), invoiceNo, date,
 *         dueDate, counterparty, currency, netAmount, vatRate(%), vatAmount,
 *         total, paidAmount, payments:[], cashflowCatId, description,
 *         committedToCells }
 *       e-fatura içe aktarım (~109870): { id:"inv_...", type(AP|AR), invoiceNo,
 *         issueDate, dueDate, partyName, currency, total, paidAmount,
 *         cashflowCatId, source:"einvoice", committedToCells } (payments YOK)
 *     payments[] elemanı (~108525): { id:"pay_...", date, amount, currency,
 *         fromType(bank|kasa), fromId, description, ts }
 *   companyData[cid].bankEntries[] → TABLO KARŞILIĞI YOK (banka hareket tablosu
 *     şemada yok) — ATLANIR; 044 v_bank_entries view'u zaten sunar.
 *
 * ŞİRKET AYRIMI: access/hr projeksiyonlarıyla aynı yerleşik kalıp — Number(cid)
 * pozitifse o, değilse DEFAULT (1). companies'te olmayan company_id repository'de
 * düşürülür (projeksiyon saf kalır). banks GLOBAL'dir: banks tablosunda şirket
 * kolonu YOK → tek satır kümesi, şirket kopyası yapılmaz.
 *
 * ENUM EŞLEME TABLOLARI (blob → DB; eşlenemeyenler düşer + sayaç):
 *   currency_code   : TRY/USD/EUR→aynı, TL→TRY, EURO→EUR (büyük/küçük harf
 *                     duyarsız); boş/yok→TRY (frontend öndeğeri); diğer→DÜŞER.
 *   flow_direction  : in→in, out→out; diğer→DÜŞER (adopt use-case'i de
 *                     kullanır — kasa hareketleri MEZUN, projeksiyonda yok).
 *   invoices.type   : in/AP→in, out/AR→out (büyük/küçük harf duyarsız);
 *                     diğer→DÜŞER (yön verisi kritik — öndeğer verilmez).
 *   category_section: blob alan adları (inflows/outflows/nonPnlOutflows/
 *                     kasaCategories) enum değerleriyle birebir.
 *   endpoint_type   : bank/kasa; diğer→DÜŞER.
 *
 * ŞEMA UYUM KURALLARI:
 *   - banks.code NOT NULL + UNIQUE: code yoksa addan türetilir (ilk 3 harf
 *     büyük). Batch içi çift code/name'de SON kazanır, önceki DÜŞER (sayaç).
 *   - categories UNIQUE (company_id, section, name): batch içi çift adda SON
 *     kazanır, önceki DÜŞER (sayaç categories.duplicateName).
 *   - cells: fiscalYear şirket alanı geçersizse o şirketin TÜM hücreleri düşer
 *     (sayaç cells.fiscalYear); month_idx 0-11 dışı, çözülmeyen kategori,
 *     sayısal olmayan değer → düşer.
 *   - invoice_payments CHECK (amount > 0): pozitif olmayan düşer.
 *   - invoices CHECK (total > 0): düşer. paid_amount [0, total] aralığına
 *     kırpılır (CHECK paid_amount <= total + 0.01).
 *   - invoice_payments toplamı total'i aşamaz (DB trigger'ı paid_amount'u
 *     ödemelerin toplamına eşitler → CHECK patlamasın): kümülatif toplam
 *     total + 0.01'i aşan ödemeler düşer (sayaç invoicePayments.exceedsTotal).
 *   - transfers CHECK (aynı hesaba transfer yasak): kaynak=hedef düşer.
 *   - Şemada kolonu olmayan blob alanları atlanır: invoices.partyId/partyVkn/
 *     projectId/source/sourceUuid/approvalStatus, kasaEntries.paymentMethod/
 *     invoiceNo, transfers.ts/userId... (044 mirror view'ları sunar).
 *   - Para alanları NUMERIC(20,2)'ye round2 ile coerce edilir.
 */

import { resolveAccessCompanyId } from './AccessProjection.js';

export const DEFAULT_FINANCE_COMPANY_ID = 1;

/**
 * YAZMA-CUTOVER'LANAN (MEZUN) KOLEKSİYONLAR — projeksiyondan çıkarıldı
 * (HrProjection.GRADUATED_COLLECTIONS kalıbı).
 *
 * kasa_accounts + kasa_entries artık SUNUCU-OTORİTERDİR: tek seferlik devralma
 * POST /v1/finance/kasa/adopt-blob ile yapılır; FE blob'daki kasaAccounts/
 * kasaEntries alanlarını sunucudan doldurulan SALT-OKUNUR önbellek olarak
 * taşır ve önbellek satırlarının id'si SUNUCU id'sidir (ör. "12").
 *
 * Bu koleksiyonlar yansıtılmaya devam etseydi önbellek yankısı client_id='12'
 * gibi ÇİFT satırlar üretir ve prune, kasa CRUD/adopt yazımlarını silerdi.
 * Bu yüzden projectFinance bu koleksiyonlar için satır ÜRETMEZ ve
 * PgFinanceProjectionRepository bu iki tabloya upsert/prune/delete YAPMAZ.
 *
 * Bağımlılıklar mezuniyet sonrası:
 *   - transfers'ın kasa uçları ve invoice_payments'ın kasa referansı olduğu
 *     gibi taşınır; çözüm PgFinanceProjectionRepository'dedir (DB client_id
 *     haritası + geçerli SAYISAL sunucu id fallback'i — işe alım emsali).
 *   - kasaAccounts blob alanı yalnız transfer para-birimi fallback'i için
 *     okunur (hrJobTitles'ın salt-çözüm kalıbı; satır üretmez).
 */
export const GRADUATED_COLLECTIONS = ['kasaAccounts', 'kasaEntries'] as const;

// --- DB enum'ları ------------------------------------------------------------
export type DbCurrency = 'TRY' | 'USD' | 'EUR';
export type DbFlowDirection = 'in' | 'out';
export type DbEndpointType = 'bank' | 'kasa';
export type DbCategorySection = 'inflows' | 'outflows' | 'nonPnlOutflows' | 'kasaCategories';

// --- Eşleme tabloları (dışa açık: birim test + dokümantasyon) ---------------
/** Büyük harfe normalize edilmiş anahtarlarla bakılır. */
export const CURRENCY_MAP: Readonly<Record<string, DbCurrency>> = {
  TRY: 'TRY',
  TL: 'TRY',
  USD: 'USD',
  EUR: 'EUR',
  EURO: 'EUR',
};

/** Küçük harfe normalize edilmiş anahtarlarla bakılır (AP/AR e-fatura şekli). */
export const INVOICE_TYPE_MAP: Readonly<Record<string, DbFlowDirection>> = {
  in: 'in',
  ap: 'in',
  out: 'out',
  ar: 'out',
};

export const CATEGORY_SECTIONS: readonly DbCategorySection[] = [
  'inflows',
  'outflows',
  'nonPnlOutflows',
  'kasaCategories',
];

// --- Projeksiyon satır tipleri -----------------------------------------------
export interface FinanceBankProjection {
  /** banks tablosu ŞİRKETSİZDİR (global kök alan) — companyId yok. */
  clientId: string;
  name: string;
  code: string;
  color: string | null;
}

export interface FinanceBankAccountProjection {
  companyId: number;
  clientId: string;
  bankClientId: string;
  name: string;
  iban: string | null;
  accountingCode: string | null;
  currency: DbCurrency;
  openingBalance: number;
  cashflowCatClientId: string | null;
  active: boolean;
}

export interface FinanceKasaAccountProjection {
  companyId: number;
  clientId: string;
  name: string;
  currency: DbCurrency;
  openingBalance: number;
  active: boolean;
}

export interface FinanceCategoryProjection {
  companyId: number;
  clientId: string;
  section: DbCategorySection;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface FinanceCellProjection {
  companyId: number;
  /** Blob map anahtarı: "<catClientId>:<monthIdx>". */
  clientId: string;
  categoryClientId: string;
  fiscalYear: number;
  monthIdx: number;
  value: number;
}

export interface FinanceKasaEntryProjection {
  /** kasa_entries'te şirket kolonu yok — bağlı kasanın şirketi (filtre için). */
  companyId: number;
  clientId: string;
  kasaAccountClientId: string;
  date: string;
  type: DbFlowDirection;
  amount: number;
  description: string | null;
  category: string | null;
  cashflowCatClientId: string | null;
}

export interface FinanceTransferProjection {
  companyId: number;
  clientId: string;
  date: string;
  fromType: DbEndpointType;
  /**
   * bank uçları blob bankAccounts'a karşı doğrulanır; kasa uçları MEZUN
   * kasa_accounts'a olduğu gibi taşınır (eski "ksa_..." client-id'si VEYA
   * önbellekten gelen SAYISAL sunucu id'si) — çözüm repository'dedir,
   * çözülemeyen transfer orada düşer.
   */
  fromClientId: string;
  toType: DbEndpointType;
  toClientId: string;
  fromAmount: number;
  toAmount: number;
  fromCurrency: DbCurrency;
  toCurrency: DbCurrency;
  description: string | null;
  cashflowCatClientId: string | null;
}

export interface FinanceInvoiceProjection {
  companyId: number;
  clientId: string;
  type: DbFlowDirection;
  invoiceNo: string | null;
  counterparty: string;
  issueDate: string | null;
  dueDate: string;
  currency: DbCurrency;
  subtotal: number;
  kdvRate: number;
  kdv: number;
  total: number;
  /** [0, total] aralığına kırpılmış; payments varsa DB trigger'ı toplamı yazar. */
  paidAmount: number;
  cashflowCatClientId: string | null;
  committedToCells: boolean;
  note: string | null;
}

export interface FinanceInvoicePaymentProjection {
  /** invoice_payments'te şirket kolonu yok — faturanın şirketi (filtre için). */
  companyId: number;
  clientId: string;
  invoiceClientId: string;
  amount: number;
  date: string;
  currency: DbCurrency;
  bankAccountClientId: string | null;
  /**
   * MEZUN kasa_accounts referansı — olduğu gibi taşınır ("ksa_..." VEYA
   * sayısal sunucu id'si); çözüm repository'dedir, çözülemezse NULL
   * (nullable kolon).
   */
  kasaAccountClientId: string | null;
  note: string | null;
}

export interface FinanceProjection {
  banks: FinanceBankProjection[];
  bankAccounts: FinanceBankAccountProjection[];
  /** MEZUN — her zaman boş (bkz. GRADUATED_COLLECTIONS). */
  kasaAccounts: FinanceKasaAccountProjection[];
  categories: FinanceCategoryProjection[];
  cells: FinanceCellProjection[];
  /** MEZUN — her zaman boş (bkz. GRADUATED_COLLECTIONS). */
  kasaEntries: FinanceKasaEntryProjection[];
  transfers: FinanceTransferProjection[];
  invoices: FinanceInvoiceProjection[];
  invoicePayments: FinanceInvoicePaymentProjection[];
  /** Düşürülen/uyarlanmış satır sayaçları ("invoices.total" → n). */
  dropped: Record<string, number>;
}

export interface ProjectFinanceOptions {
  /** Sayısal olmayan blob şirket anahtarlarının düşeceği company_id (öndeğer 1). */
  defaultCompanyId?: number;
}

// --- Küçük yardımcılar (Access/Hr projeksiyon kalıbı) ------------------------
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function idString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function textOrNull(value: unknown, maxLen?: number): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (t === '') return null;
  return maxLen !== undefined ? t.slice(0, maxLen) : t;
}

const ISO_DATE_RE = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])/;

/** DATE kolonları: geçerli ISO önekli string'in ilk 10 karakteri; aksi null. */
function isoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return ISO_DATE_RE.test(t) ? t.slice(0, 10) : null;
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Para alanları NUMERIC(20,2): 2 haneye yuvarla. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Boş/yok → TRY (frontend öndeğeri); bilinen → eşlenik; bilinmeyen → null (DÜŞ).
 * Dışa açık: AdoptBlobFinanceKasaUseCase aynı kuralı TEK KAYNAK'tan kullanır.
 */
export function currencyOrNull(value: unknown): DbCurrency | null {
  if (value === undefined || value === null) return 'TRY';
  if (typeof value !== 'string') return null;
  const t = value.trim().toUpperCase();
  if (t === '') return 'TRY';
  return CURRENCY_MAP[t] ?? null;
}

/** Dışa açık: AdoptBlobFinanceKasaUseCase aynı kuralı TEK KAYNAK'tan kullanır. */
export function flowDirectionOrNull(value: unknown): DbFlowDirection | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().toLowerCase();
  return t === 'in' || t === 'out' ? t : null;
}

function invoiceTypeOrNull(value: unknown): DbFlowDirection | null {
  if (typeof value !== 'string') return null;
  return INVOICE_TYPE_MAP[value.trim().toLowerCase()] ?? null;
}

function endpointTypeOrNull(value: unknown): DbEndpointType | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().toLowerCase();
  return t === 'bank' || t === 'kasa' ? t : null;
}

/** Dizi alanını obje elemanlara indirger; clientId'de SON kazanır. */
function collectItems(value: unknown): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(value)) return out;
  for (const item of value) {
    if (!isPlainObject(item)) continue;
    const clientId = idString(item['id']);
    if (clientId === null) continue;
    out.set(clientId, item);
  }
  return out;
}

class DropCounter {
  readonly counts: Record<string, number> = {};
  add(reason: string, n = 1): void {
    if (n <= 0) return;
    this.counts[reason] = (this.counts[reason] ?? 0) + n;
  }
}

interface CompanySlice {
  companyId: number;
  fields: Record<string, unknown>;
}

interface RawItem {
  companyId: number;
  item: Record<string, unknown>;
}

// --- Ana projeksiyon ---------------------------------------------------------
export function projectFinance(
  blobValue: unknown,
  opts?: ProjectFinanceOptions,
): FinanceProjection {
  const defaultCompanyId = opts?.defaultCompanyId ?? DEFAULT_FINANCE_COMPANY_ID;
  const dropped = new DropCounter();

  const slices: CompanySlice[] = [];
  let rootBanks: unknown;
  if (isPlainObject(blobValue)) {
    rootBanks = blobValue['banks']; // GLOBAL kök alan — companyData dışı
    const companyData = blobValue['companyData'];
    if (isPlainObject(companyData)) {
      for (const [cid, companyValue] of Object.entries(companyData)) {
        if (cid.trim() === '' || !isPlainObject(companyValue)) continue;
        slices.push({
          companyId: resolveAccessCompanyId(cid, defaultCompanyId),
          fields: companyValue,
        });
      }
    }
  }

  // --- Bankalar (global; code/name UNIQUE — batch içi çiftte SON kazanır) ----
  const banks = new Map<string, FinanceBankProjection>();
  for (const [clientId, item] of collectItems(rootBanks)) {
    const name = textOrNull(item['name'], 100);
    if (name === null) {
      dropped.add('banks.name');
      continue;
    }
    const code = textOrNull(item['code'], 20) ?? name.slice(0, 3).toUpperCase().slice(0, 20);
    banks.set(clientId, {
      clientId,
      name,
      code,
      color: textOrNull(item['color'], 20),
    });
  }
  dedupByKey(banks, (b) => b.code, dropped, 'banks.duplicateCode');
  dedupByKey(banks, (b) => b.name, dropped, 'banks.duplicateName');

  // clientId → projeksiyon satırı (SON kazanır; şirketler arası birleşim).
  // NOT: kasaAccounts/kasaEntries MEZUN (GRADUATED_COLLECTIONS) — satır
  // üretilmez.
  const categories = new Map<string, FinanceCategoryProjection>();
  const bankAccounts = new Map<string, FinanceBankAccountProjection>();
  const cells = new Map<string, FinanceCellProjection>(); // anahtar: "cid|catId:mi"
  const transfers = new Map<string, FinanceTransferProjection>();
  const invoices = new Map<string, FinanceInvoiceProjection>();
  const invoicePayments = new Map<string, FinanceInvoicePaymentProjection>();

  /**
   * kasaAccounts MEZUN: tablo satırı üretilmez; yalnız transfer para-birimi
   * fallback'i için id → currency haritası okunur (hrJobTitles salt-çözüm
   * kalıbı). Önbellek satırları sunucu id'si taşıyabilir — anahtar her ikisini
   * de kapsar.
   */
  const kasaCurrencyByRef = new Map<string, DbCurrency>();

  /** Ham blob elemanları (2. faz — tüm üst entiteler toplandıktan sonra). */
  const rawBankAccounts = new Map<string, RawItem>();
  const rawTransfers = new Map<string, RawItem>();
  const rawInvoices = new Map<string, RawItem>();
  const rawCells: { companyId: number; fiscalYear: number | null; map: Record<string, unknown> }[] =
    [];

  // --- 1. faz: üst entiteler + ham toplama ------------------------------------
  for (const { companyId, fields } of slices) {
    // Kategoriler: 4 blob alanı = 4 enum section'ı (birebir).
    for (const section of CATEGORY_SECTIONS) {
      const list = fields[section];
      if (!Array.isArray(list)) continue;
      let sortOrder = 0;
      for (const raw of list) {
        if (!isPlainObject(raw)) continue;
        const clientId = idString(raw['id']);
        const name = textOrNull(raw['name'], 200);
        if (clientId === null) continue;
        if (name === null) {
          dropped.add('categories.name');
          continue;
        }
        categories.set(clientId, {
          companyId,
          clientId,
          section,
          name,
          sortOrder: sortOrder++,
          active: raw['active'] !== false,
        });
      }
    }

    // kasaAccounts + kasaEntries: MEZUN — satır üretilmez (bkz.
    // GRADUATED_COLLECTIONS; sunucu-otoriter, önbellek yankısı yasak).
    // kasaAccounts yalnız para-birimi çözümü için okunur.
    for (const [clientId, item] of collectItems(fields['kasaAccounts'])) {
      const currency = currencyOrNull(item['currency']);
      if (currency !== null) kasaCurrencyByRef.set(clientId, currency);
    }

    for (const [clientId, item] of collectItems(fields['bankAccounts'])) {
      rawBankAccounts.set(clientId, { companyId, item });
    }
    for (const [clientId, item] of collectItems(fields['transfers'])) {
      rawTransfers.set(clientId, { companyId, item });
    }
    for (const [clientId, item] of collectItems(fields['invoices'])) {
      rawInvoices.set(clientId, { companyId, item });
    }

    const cellsMap = fields['cells'];
    if (isPlainObject(cellsMap)) {
      const fyRaw = finiteOrNull(fields['fiscalYear']);
      const fy = fyRaw !== null ? Math.trunc(fyRaw) : null;
      rawCells.push({
        companyId,
        fiscalYear: fy !== null && fy >= 1900 && fy <= 2200 ? fy : null,
        map: cellsMap,
      });
    }
  }

  // Kategori doğal anahtarı (company, section, name) UNIQUE — SON kazanır.
  dedupByKey(
    categories,
    (c) => `${c.companyId} ${c.section} ${c.name}`,
    dropped,
    'categories.duplicateName',
  );

  const resolveCategory = (value: unknown): string | null => {
    const id = idString(value);
    return id !== null && categories.has(id) ? id : null;
  };

  // --- 2. faz: banka hesapları ------------------------------------------------
  for (const [clientId, { companyId, item }] of rawBankAccounts) {
    const name = textOrNull(item['name'], 200);
    if (name === null) {
      dropped.add('bankAccounts.name');
      continue;
    }
    const bankClientId = idString(item['bankId']);
    if (bankClientId === null || !banks.has(bankClientId)) {
      dropped.add('bankAccounts.bank'); // bank_id NOT NULL FK — düşür
      continue;
    }
    const currency = currencyOrNull(item['currency']);
    if (currency === null) {
      dropped.add('bankAccounts.currency');
      continue;
    }
    bankAccounts.set(clientId, {
      companyId,
      clientId,
      bankClientId,
      name,
      iban: textOrNull(item['iban'], 34),
      accountingCode: textOrNull(item['accountingCode'], 40),
      currency,
      openingBalance: round2(finiteOrNull(item['openingBalance']) ?? 0),
      cashflowCatClientId: resolveCategory(item['cashflowCatId']),
      active: item['active'] !== false,
    });
  }

  // --- Hücreler (cells map → satırlar) -----------------------------------------
  for (const { companyId, fiscalYear, map } of rawCells) {
    for (const [key, rawVal] of Object.entries(map)) {
      if (fiscalYear === null) {
        dropped.add('cells.fiscalYear'); // fiscal_year NOT NULL — şirket alanı bozuk
        continue;
      }
      const sep = key.lastIndexOf(':');
      const monthIdx = sep > 0 ? Number(key.slice(sep + 1)) : NaN;
      if (!Number.isInteger(monthIdx) || monthIdx < 0 || monthIdx > 11) {
        dropped.add('cells.monthIdx'); // CHECK month_idx BETWEEN 0 AND 11
        continue;
      }
      const categoryClientId = key.slice(0, sep);
      if (!categories.has(categoryClientId)) {
        dropped.add('cells.category'); // category_id NOT NULL FK — düşür
        continue;
      }
      const value = finiteOrNull(rawVal);
      if (value === null) {
        dropped.add('cells.value');
        continue;
      }
      const clientId = `${categoryClientId}:${monthIdx}`;
      cells.set(`${companyId}|${clientId}`, {
        companyId,
        clientId,
        categoryClientId,
        fiscalYear,
        monthIdx,
        value: round2(value),
      });
    }
  }

  // --- Transferler ---------------------------------------------------------------
  // Kasa ucu para birimi: MEZUN kasaAccounts'tan salt-çözüm haritası
  // (kasaCurrencyByRef) — satır üretmez, yalnız fallback.
  const endpointCurrency = (type: DbEndpointType, clientId: string): DbCurrency | null =>
    type === 'bank'
      ? (bankAccounts.get(clientId)?.currency ?? null)
      : (kasaCurrencyByRef.get(clientId) ?? null);

  for (const [clientId, { companyId, item }] of rawTransfers) {
    const date = isoDateOrNull(item['date']) ?? isoDateOrNull(item['ts']);
    if (date === null) {
      dropped.add('transfers.date'); // date NOT NULL — düşür
      continue;
    }
    const fromType = endpointTypeOrNull(item['fromType']);
    const toType = endpointTypeOrNull(item['toType']);
    if (fromType === null || toType === null) {
      dropped.add('transfers.endpointType');
      continue;
    }
    const fromClientId = idString(item['fromId']);
    const toClientId = idString(item['toId']);
    // bank uçları blob bankAccounts'a karşı doğrulanır; kasa uçları MEZUN —
    // olduğu gibi taşınır, çözüm/düşürme repository'dedir.
    const fromOk = fromClientId !== null && (fromType === 'kasa' || bankAccounts.has(fromClientId));
    const toOk = toClientId !== null && (toType === 'kasa' || bankAccounts.has(toClientId));
    if (!fromOk || !toOk) {
      dropped.add('transfers.endpoint'); // from_id/to_id NOT NULL — düşür
      continue;
    }
    if (fromType === toType && fromClientId === toClientId) {
      dropped.add('transfers.sameEndpoint'); // CHECK aynı hesaba transfer yasak
      continue;
    }
    const fromAmountRaw = finiteOrNull(item['fromAmount']);
    const fromAmount = fromAmountRaw !== null ? round2(fromAmountRaw) : null;
    if (fromAmount === null || fromAmount <= 0) {
      dropped.add('transfers.amount'); // CHECK from_amount > 0 — düşür
      continue;
    }
    const toAmountRaw = finiteOrNull(item['toAmount']);
    let toAmount = toAmountRaw !== null ? round2(toAmountRaw) : null;
    if (toAmount === null || toAmount <= 0) toAmount = fromAmount; // frontend fallback'i

    // Para birimi: blob alanı → yoksa uç hesabın birimi → bilinmeyen → düşür.
    const fromCurrency =
      item['fromCurrency'] === undefined || item['fromCurrency'] === null
        ? endpointCurrency(fromType, fromClientId)
        : currencyOrNull(item['fromCurrency']);
    const toCurrency =
      item['toCurrency'] === undefined || item['toCurrency'] === null
        ? endpointCurrency(toType, toClientId)
        : currencyOrNull(item['toCurrency']);
    if (fromCurrency === null || toCurrency === null) {
      dropped.add('transfers.currency');
      continue;
    }

    transfers.set(clientId, {
      companyId,
      clientId,
      date,
      fromType,
      fromClientId,
      toType,
      toClientId,
      fromAmount,
      toAmount,
      fromCurrency,
      toCurrency,
      description: textOrNull(item['description']),
      cashflowCatClientId: resolveCategory(item['cashflowCatId']),
    });
  }

  // --- Faturalar + fatura ödemeleri -----------------------------------------------
  for (const [clientId, { companyId, item }] of rawInvoices) {
    const type = invoiceTypeOrNull(item['type']);
    if (type === null) {
      dropped.add('invoices.type'); // yön kritik — öndeğer verilmez, düşür
      continue;
    }
    // İki eleman şekli: elle girilen counterparty+date, e-fatura partyName+issueDate.
    const counterparty =
      textOrNull(item['counterparty'], 300) ?? textOrNull(item['partyName'], 300);
    if (counterparty === null) {
      dropped.add('invoices.counterparty'); // counterparty NOT NULL — düşür
      continue;
    }
    const issueDate = isoDateOrNull(item['date']) ?? isoDateOrNull(item['issueDate']);
    const dueDate = isoDateOrNull(item['dueDate']) ?? issueDate ?? isoDateOrNull(item['createdAt']);
    if (dueDate === null) {
      dropped.add('invoices.dueDate'); // due_date NOT NULL — düşür
      continue;
    }
    const currency = currencyOrNull(item['currency']);
    if (currency === null) {
      dropped.add('invoices.currency');
      continue;
    }
    const totalRaw = finiteOrNull(item['total']);
    const total = totalRaw !== null ? round2(totalRaw) : null;
    if (total === null || total <= 0) {
      dropped.add('invoices.total'); // CHECK total > 0 — düşür
      continue;
    }
    const subtotal = round2(finiteOrNull(item['netAmount']) ?? total);
    const vatRateRaw = finiteOrNull(item['vatRate']);
    // Blob yüzde (20) tutar, DB oran NUMERIC(5,4) tutar (0.20) — /100 + kırp.
    const kdvRate = vatRateRaw !== null ? Math.min(Math.max(vatRateRaw / 100, 0), 9.9999) : 0;
    const kdv = round2(finiteOrNull(item['vatAmount']) ?? 0);
    const paidAmount = Math.min(Math.max(round2(finiteOrNull(item['paidAmount']) ?? 0), 0), total);

    invoices.set(clientId, {
      companyId,
      clientId,
      type,
      invoiceNo: textOrNull(item['invoiceNo'], 80),
      counterparty,
      issueDate,
      dueDate,
      currency,
      subtotal,
      kdvRate,
      kdv,
      total,
      paidAmount,
      cashflowCatClientId: resolveCategory(item['cashflowCatId']),
      committedToCells: item['committedToCells'] === true,
      note: textOrNull(item['description']) ?? textOrNull(item['note']),
    });

    // Fatura içi ödemeler dizisi → invoice_payments (delete-then-insert detayı).
    const payments = item['payments'];
    if (!Array.isArray(payments)) continue;
    let cumulative = 0;
    let idx = 0;
    for (const raw of payments) {
      const pIdx = idx++;
      if (!isPlainObject(raw)) continue;
      const amountRaw = finiteOrNull(raw['amount']);
      const amount = amountRaw !== null ? round2(amountRaw) : null;
      if (amount === null || amount <= 0) {
        dropped.add('invoicePayments.amount'); // CHECK amount > 0 — düşür
        continue;
      }
      const date = isoDateOrNull(raw['date']) ?? isoDateOrNull(raw['ts']);
      if (date === null) {
        dropped.add('invoicePayments.date'); // date NOT NULL — düşür
        continue;
      }
      const pCurrency =
        raw['currency'] === undefined || raw['currency'] === null
          ? currency
          : currencyOrNull(raw['currency']);
      if (pCurrency === null) {
        dropped.add('invoicePayments.currency');
        continue;
      }
      // DB trigger'ı paid_amount = SUM(payments) yazar; CHECK
      // (paid_amount <= total + 0.01) patlamasın diye kümülatif toplam kırpılır.
      // (Geçerlilik kontrollerinden SONRA — geçersiz ödeme kotayı tüketmesin.)
      if (round2(cumulative + amount) > total + 0.01) {
        dropped.add('invoicePayments.exceedsTotal');
        continue;
      }
      const fromType = endpointTypeOrNull(raw['fromType']);
      const fromId = idString(raw['fromId']);
      const bankAccountClientId =
        fromType === 'bank' && fromId !== null && bankAccounts.has(fromId) ? fromId : null;
      // kasa MEZUN — referans olduğu gibi taşınır; çözüm repository'de
      // (çözülemezse NULL, kolon nullable).
      const kasaAccountClientId = fromType === 'kasa' && fromId !== null ? fromId : null;

      cumulative = round2(cumulative + amount);
      const paymentClientId = idString(raw['id']) ?? `${clientId}:p${pIdx}`;
      invoicePayments.set(paymentClientId, {
        companyId,
        clientId: paymentClientId,
        invoiceClientId: clientId,
        amount,
        date,
        currency: pCurrency,
        bankAccountClientId,
        kasaAccountClientId,
        note: textOrNull(raw['description']) ?? textOrNull(raw['note']),
      });
    }
  }

  return {
    banks: [...banks.values()],
    bankAccounts: [...bankAccounts.values()],
    kasaAccounts: [], // MEZUN (GRADUATED_COLLECTIONS)
    categories: [...categories.values()],
    cells: [...cells.values()],
    kasaEntries: [], // MEZUN (GRADUATED_COLLECTIONS)
    transfers: [...transfers.values()],
    invoices: [...invoices.values()],
    invoicePayments: [...invoicePayments.values()],
    dropped: dropped.counts,
  };
}

/**
 * UNIQUE anahtar üzerinde batch içi tekilleştirme: SON kazanır, önceki satır
 * kümeden DÜŞÜRÜLÜR (NOT NULL anahtar NULL'lanamaz — HR dedupCodes'tan farkı).
 */
function dedupByKey<T>(
  rows: Map<string, T>,
  keyOf: (row: T) => string,
  dropped: DropCounter,
  reason: string,
): void {
  const owner = new Map<string, string>(); // anahtar → clientId (map anahtarı)
  for (const [clientId, row] of rows) {
    const key = keyOf(row);
    const prev = owner.get(key);
    if (prev !== undefined) {
      rows.delete(prev);
      dropped.add(reason);
    }
    owner.set(key, clientId);
  }
}
