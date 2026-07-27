/**
 * fxCore — proje geneli döviz (TRY/USD/EUR) çekirdeği.
 *
 * SÖZLEŞME (Faz FX-1 kararları):
 *
 * 1) SAKLAMA — "çift kayıt". Dövizli bir kayıt şu alanları taşır:
 *      currency      : "TRY" | "USD" | "EUR"   — tutarın girildiği para birimi
 *      amount        : number                   — ORİJİNAL para birimindeki tutar
 *      fxRate        : number                   — 1 birim döviz kaç TRY (TRY için 1)
 *      fxRateSource  : "manual" | "tcmb"        — kur nereden geldi
 *      fxRateDate    : ISO tarih                — kurun ait olduğu gün
 *      amountTRY     : number                   — kurdan TÜRETİLEN TRY karşılığı (otoriter toplam)
 *    Böylece geçmişe dönük rakamlar kur güncellenince kaymaz (e-Defter/VUK uyumu) ve
 *    mevcut TRY tabanlı toplama kodu `amountTRY` ile bozulmadan çalışır.
 *
 * 2) GÖSTERİM KURU ÖNCELİĞİ:
 *      kaydın kendi kuru → kayıt tarihli TCMB kuru → güncel kur
 *    `resolveRate()` bu sırayı uygular ve hangi kaynağı kullandığını `basis` ile bildirir.
 *
 * Bu dosya SAF'tır: React, DOM ya da ağ bağımlılığı yoktur; birim test edilebilir.
 */

export type CurrencyCode = 'TRY' | 'USD' | 'EUR';
export type FxRateSource = 'manual' | 'tcmb';

/** Kur çözümlemesinin hangi kaynaktan geldiği. */
export type RateBasis =
  /** Para birimi TRY — çevrim yok. */
  | 'identity'
  /** Kaydın veri girişinde saklanan kendi kuru. */
  | 'record'
  /** Kayıt tarihine ait (ya da ondan önceki en yakın) TCMB kuru. */
  | 'history'
  /** Güncel TCMB kuru (tarihsel kayıt bulunamadı). */
  | 'current'
  /** Hiçbir kur bulunamadı — 1 kabul edildi, tutar güvenilmez. */
  | 'missing';

export interface ResolvedRate {
  /** 1 birim döviz kaç TRY. */
  rate: number;
  basis: RateBasis;
  /** Kurun ait olduğu ISO tarih (biliniyorsa). */
  rateDate: string | null;
}

export interface RateHistoryEntry {
  /** App.jsx `rateHistory` kayıtları "DD-MM-YYYY" taşır; ISO da kabul edilir. */
  date?: string | null;
  USD?: number | null;
  EUR?: number | null;
  [key: string]: unknown;
}

/** Kur defteri — App.jsx app-state'inden (`exchangeRates` + `rateHistory`) türetilir. */
export interface RateBook {
  /** Güncel kurlar: { USD: 34.02, EUR: 38.13 } */
  current?: Partial<Record<CurrencyCode, number | null>> | null;
  /** Tarihsel TCMB kayıtları (yeniden eskiye sıralı olması şart değil). */
  history?: RateHistoryEntry[] | null;
}

/** Dövizli alanları taşıyan herhangi bir kayıt (fatura, banka hareketi, kasa fişi…). */
export interface FxRecord {
  amount?: number | string | null;
  amountTRY?: number | string | null;
  currency?: string | null;
  fxRate?: number | string | null;
  /** Saklanan değer serbest string olabilir; okurken daraltılır. */
  fxRateSource?: string | null;
  fxRateDate?: string | null;
  /** Kaydın belge tarihi (ISO) — tarihsel kur araması bunun üzerinden yapılır. */
  date?: string | null;
}

/** Veri giriş formlarının tuttuğu dövizli blok. */
export interface FxDraft {
  /** "Dövizli kayıt" tiki. */
  isFx?: boolean;
  currency?: string | null;
  fxRate?: number | string | null;
  /** Saklanan değer serbest string olabilir; okurken daraltılır. */
  fxRateSource?: string | null;
  fxRateDate?: string | null;
}

export const FX_CURRENCIES: readonly CurrencyCode[] = ['TRY', 'USD', 'EUR'] as const;
/** TRY dışındaki desteklenen para birimleri (dövizli giriş seçenekleri). */
export const FX_FOREIGN_CURRENCIES: readonly CurrencyCode[] = ['USD', 'EUR'] as const;

export const FX_SYMBOLS: Record<CurrencyCode, string> = { TRY: '₺', USD: '$', EUR: '€' };

/** Varsayılan (TRY, dövizsiz) alan bloğu — yeni draft'lar için. */
export function blankFx(): Required<Pick<FxDraft, 'isFx' | 'currency'>> & FxDraft {
  return { isFx: false, currency: 'TRY', fxRate: null, fxRateSource: null, fxRateDate: null };
}

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return v === 'TRY' || v === 'USD' || v === 'EUR';
}

/** Bilinmeyen değeri güvenli para birimine indirger (varsayılan TRY). */
export function asCurrency(v: unknown): CurrencyCode {
  return isCurrencyCode(v) ? v : 'TRY';
}

/** Sayıya çevir; sonlu değilse null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Pozitif sayıya çevir; değilse null (kurlar için). */
function posNum(v: unknown): number | null {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
}

/**
 * "DD-MM-YYYY" ya da "YYYY-MM-DD" → ISO "YYYY-MM-DD". Ayrıştırılamazsa null.
 * (App.jsx `rateHistory` TCMB'nin DD-MM-YYYY biçimini saklar.)
 */
export function toIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  const s = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{2})[-./](\d{2})[-./](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Bugünün ISO tarihi (yerel saat — belge tarihleriyle aynı eksende). */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Tarihsel TCMB kuru: `isoDate`'e eşit ya da ondan ÖNCEKİ en yakın kayıt.
 * (Tatil/hafta sonu için TCMB kur yayınlamaz — bir önceki iş günü kullanılır.)
 */
export function findHistoryRate(
  history: RateHistoryEntry[] | null | undefined,
  currency: CurrencyCode,
  isoDate: string | null | undefined,
): { rate: number; rateDate: string } | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  if (currency === 'TRY') return null;
  const target = toIsoDate(isoDate);
  if (target === null) return null;

  let best: { rate: number; rateDate: string } | null = null;
  for (const entry of history) {
    const iso = toIsoDate(entry?.date);
    if (iso === null || iso > target) continue;
    const rate = posNum(entry?.[currency]);
    if (rate === null) continue;
    if (best === null || iso > best.rateDate) best = { rate, rateDate: iso };
  }
  return best;
}

/**
 * Kur çözümleyici — projedeki TEK kur karar noktası.
 * Öncelik: kaydın kendi kuru → kayıt tarihli TCMB → güncel kur.
 */
export function resolveRate(
  currency: unknown,
  opts: {
    /** Kayıt tarihi (ISO) — tarihsel arama için. */
    date?: string | null;
    /** Kayıtta saklı kur (veri girişinde girilmiş/dondurulmuş). */
    recordRate?: number | string | null;
    rateBook?: RateBook | null;
  } = {},
): ResolvedRate {
  const cur = asCurrency(currency);
  if (cur === 'TRY') return { rate: 1, basis: 'identity', rateDate: null };

  const own = posNum(opts.recordRate);
  if (own !== null) return { rate: own, basis: 'record', rateDate: toIsoDate(opts.date) };

  const hist = findHistoryRate(opts.rateBook?.history, cur, opts.date);
  if (hist !== null) return { rate: hist.rate, basis: 'history', rateDate: hist.rateDate };

  const now = posNum(opts.rateBook?.current?.[cur]);
  if (now !== null) return { rate: now, basis: 'current', rateDate: null };

  return { rate: 1, basis: 'missing', rateDate: null };
}

/** Dövizli tutarı TRY'ye çevirir. */
export function fxToTRY(
  amount: number | string | null | undefined,
  currency: unknown,
  opts: {
    date?: string | null;
    recordRate?: number | string | null;
    rateBook?: RateBook | null;
  } = {},
): number {
  const a = num(amount);
  if (a === null) return 0;
  return a * resolveRate(currency, opts).rate;
}

/** TRY tutarı hedef para birimine çevirir. */
export function fxFromTRY(
  amountTRY: number | string | null | undefined,
  currency: unknown,
  opts: {
    date?: string | null;
    recordRate?: number | string | null;
    rateBook?: RateBook | null;
  } = {},
): number {
  const a = num(amountTRY);
  if (a === null) return 0;
  const { rate } = resolveRate(currency, opts);
  return rate > 0 ? a / rate : 0;
}

/**
 * Kaydın TRY karşılığı. Saklanmış `amountTRY` otoriterdir (kur donmuş demektir);
 * yoksa kaydın kuruyla (o da yoksa tarihsel/güncel TCMB ile) hesaplanır.
 */
export function recordAmountTRY(
  record: FxRecord | null | undefined,
  rateBook?: RateBook | null,
): number {
  if (!record) return 0;
  const stored = num(record.amountTRY);
  if (stored !== null) return stored;
  return fxToTRY(record.amount, record.currency, {
    date: record.date ?? null,
    recordRate: record.fxRate ?? null,
    rateBook: rateBook ?? null,
  });
}

/**
 * Kaydın ekranda gösterilecek tutarı (üst bardaki `displayCurrency` cinsinden).
 *
 * Kayıt zaten hedef para birimindeyse ORİJİNAL tutar birebir döner (TRY'ye gidip
 * geri dönmenin yuvarlama kaybı olmaz — kullanıcının girdiği rakam neyse o görünür).
 */
export function displayAmount(
  record: FxRecord | null | undefined,
  displayCurrency: unknown,
  rateBook?: RateBook | null,
): number {
  if (!record) return 0;
  const target = asCurrency(displayCurrency);
  const amountTRY = recordAmountTRY(record, rateBook);
  if (target === 'TRY') return amountTRY;

  if (asCurrency(record.currency) === target) {
    const original = num(record.amount);
    if (original !== null) return original;
  }
  return fxFromTRY(amountTRY, target, { date: record.date ?? null, rateBook: rateBook ?? null });
}

/**
 * Toplam/rapor satırı gibi tek bir kayda bağlı olmayan TRY tutarların gösterim çevrimi.
 * `date` verilirse o tarihin TCMB kuru, verilmezse güncel kur kullanılır.
 */
export function convertTRYForDisplay(
  amountTRY: number | string | null | undefined,
  displayCurrency: unknown,
  opts: { date?: string | null; rateBook?: RateBook | null } = {},
): number {
  const target = asCurrency(displayCurrency);
  if (target === 'TRY') return num(amountTRY) ?? 0;
  return fxFromTRY(amountTRY, target, { date: opts.date ?? null, rateBook: opts.rateBook ?? null });
}

/** Kayıt listesinin TRY toplamı. */
export function sumTRY(
  records: readonly FxRecord[] | null | undefined,
  rateBook?: RateBook | null,
): number {
  if (records === null || records === undefined) return 0;
  let total = 0;
  for (const r of records) total += recordAmountTRY(r, rateBook);
  return total;
}

/**
 * Veri giriş draft'ını saklanabilir alanlara normalize eder.
 *
 * Dönen nesne doğrudan kayda yayılır (spread) — `amountTRY` toplama kodunun
 * güveneceği donmuş TRY karşılığıdır.
 */
export function normalizeFxDraft(
  draft: (FxDraft & { amount?: number | string | null; date?: string | null }) | null | undefined,
  rateBook?: RateBook | null,
): {
  currency: CurrencyCode;
  fxRate: number | null;
  fxRateSource: FxRateSource | null;
  fxRateDate: string | null;
  amountTRY: number;
} {
  const amount = num(draft?.amount) ?? 0;
  const isFx = draft?.isFx === true && asCurrency(draft?.currency) !== 'TRY';

  if (!isFx) {
    return {
      currency: 'TRY',
      fxRate: null,
      fxRateSource: null,
      fxRateDate: null,
      amountTRY: amount,
    };
  }

  const currency = asCurrency(draft?.currency);
  const source: FxRateSource = draft?.fxRateSource === 'manual' ? 'manual' : 'tcmb';
  const resolved = resolveRate(currency, {
    date: draft?.date ?? null,
    recordRate: draft?.fxRate ?? null,
    rateBook: rateBook ?? null,
  });

  return {
    currency,
    fxRate: resolved.rate,
    fxRateSource: source,
    fxRateDate: resolved.rateDate ?? toIsoDate(draft?.date) ?? todayIso(),
    amountTRY: +(amount * resolved.rate).toFixed(2),
  };
}

/** App.jsx app-state'inden kur defteri kurar. */
export function rateBookFromAppState(
  data:
    | {
        exchangeRates?: Partial<Record<CurrencyCode, number | null>> | null;
        rateHistory?: RateHistoryEntry[] | null;
      }
    | null
    | undefined,
): RateBook {
  return { current: data?.exchangeRates ?? {}, history: data?.rateHistory ?? [] };
}

/* ---------------------------------------------------------------- biçimleme */

/** Türk formatlı, daima 2 ondalıklı tutar. Boş/geçersiz için "". */
export function fmtFx(value: number | string | null | undefined, decimals = 2): string {
  const n = num(value);
  if (n === null) return '';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Negatifi parantezle gösteren biçim (muhasebe). */
export function fmtFxSign(value: number | string | null | undefined, decimals = 2): string {
  const n = num(value);
  if (n === null) return '—';
  const s = fmtFx(Math.abs(n), decimals);
  return n < 0 ? `(${s})` : s;
}

/** Sembollü tutar: "1.234,56 $". */
export function fmtFxMoney(
  value: number | string | null | undefined,
  currency: unknown,
  opts: { decimals?: number; symbolFirst?: boolean } = {},
): string {
  const s = fmtFx(value, opts.decimals ?? 2);
  if (s === '') return '';
  const sym = FX_SYMBOLS[asCurrency(currency)];
  return opts.symbolFirst === true ? `${sym} ${s}` : `${s} ${sym}`;
}

/** Kur gösterimi: 4 ondalık, binlik ayraçsız ("34,0217"). */
export function fmtRate(value: number | string | null | undefined): string {
  const n = num(value);
  if (n === null) return '—';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}
