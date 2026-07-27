/**
 * FxInfo — dövizli bir kaydın DONDURULMUŞ kur bilgisi (modüller arası ortak).
 *
 * Frontend `frontend/src/shared/fx/fxCore.ts` ile AYNI sözleşme; migration
 * 051_fx_currency_fields.sql ile aynı kolon adları:
 *
 *   currency     → <tablo>.currency        (tutarın girildiği para birimi)
 *   rate         → <tablo>.fx_rate         (1 birim döviz kaç TRY)
 *   source       → <tablo>.fx_rate_source  ('manual' | 'tcmb')
 *   rateDate     → <tablo>.fx_rate_date    (kurun ait olduğu gün)
 *   amountTRY    → <tablo>.<amount>_try    (kurdan türetilen TRY karşılığı)
 *
 * NEDEN DONDURULUR: kur sonradan değişince geçmişe dönük TRY tutarları
 * KAYMAMALI (VUK / e-Defter). Raporlar `_try` kolonunu toplar; canlı çevrim
 * yapmaz.
 *
 * Bu dosya SAF'tır: DB, HTTP ya da framework bağımlılığı yoktur.
 */

export type FxCurrency = 'TRY' | 'USD' | 'EUR';
export type FxRateSource = 'manual' | 'tcmb';

export const FX_CURRENCIES: readonly FxCurrency[] = ['TRY', 'USD', 'EUR'];
export const FX_RATE_SOURCES: readonly FxRateSource[] = ['manual', 'tcmb'];

export function isFxCurrency(v: unknown): v is FxCurrency {
  return v === 'TRY' || v === 'USD' || v === 'EUR';
}

export function isFxRateSource(v: unknown): v is FxRateSource {
  return v === 'manual' || v === 'tcmb';
}

/** Bilinmeyen değeri güvenli para birimine indirger (varsayılan TRY). */
export function asFxCurrency(v: unknown): FxCurrency {
  return isFxCurrency(v) ? v : 'TRY';
}

/** Bilinmeyen değeri kur kaynağına indirger; geçersizse null. */
export function asFxRateSource(v: unknown): FxRateSource | null {
  return isFxRateSource(v) ? v : null;
}

export interface FxInfoProps {
  currency: FxCurrency;
  /** 1 birim döviz kaç TRY. TRY için 1; bilinmiyorsa null. */
  rate: number | null;
  source: FxRateSource | null;
  /** ISO gün (YYYY-MM-DD) ya da null. */
  rateDate: string | null;
}

/** DB satırından okunan ham fx kolonları (numeric string gelebilir). */
export interface FxRowFields {
  currency?: string | null;
  fx_rate?: string | number | null;
  fx_rate_source?: string | null;
  fx_rate_date?: string | Date | null;
}

function toPositiveNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Date | string → ISO gün. Ayrıştırılamazsa null. */
function toIsoDay(v: unknown): string | null {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}

/**
 * Dövizli kaydın kur bilgisi. Immutable.
 *
 * `TRY` için kanonik biçim: rate = 1, source = null, rateDate = null.
 */
export class FxInfo {
  private constructor(private readonly props: Readonly<FxInfoProps>) {}

  /** TRY (dövizsiz) kayıt — kur 1, kaynak yok. */
  static none(): FxInfo {
    return new FxInfo({ currency: 'TRY', rate: 1, source: null, rateDate: null });
  }

  static create(props: FxInfoProps): FxInfo {
    if (props.currency === 'TRY') return FxInfo.none();
    if (props.rate !== null && !(Number.isFinite(props.rate) && props.rate > 0)) {
      throw new Error(`FxInfo.rate pozitif olmalı veya null: ${String(props.rate)}`);
    }
    return new FxInfo(props);
  }

  /** HTTP gövdesi / use-case girdisinden kurar (gevşek tipler tolere edilir). */
  static fromInput(input: {
    currency?: unknown;
    fxRate?: unknown;
    fxRateSource?: unknown;
    fxRateDate?: unknown;
  }): FxInfo {
    const currency = asFxCurrency(input.currency);
    if (currency === 'TRY') return FxInfo.none();
    return FxInfo.create({
      currency,
      rate: toPositiveNumber(input.fxRate),
      source: asFxRateSource(input.fxRateSource),
      rateDate: toIsoDay(input.fxRateDate),
    });
  }

  /** DB satırından kurar (051 kolon adları). */
  static fromRow(row: FxRowFields): FxInfo {
    const currency = asFxCurrency(row.currency);
    if (currency === 'TRY') return FxInfo.none();
    return FxInfo.create({
      currency,
      rate: toPositiveNumber(row.fx_rate),
      source: asFxRateSource(row.fx_rate_source),
      rateDate: toIsoDay(row.fx_rate_date),
    });
  }

  get currency(): FxCurrency {
    return this.props.currency;
  }
  get rate(): number | null {
    return this.props.rate;
  }
  get source(): FxRateSource | null {
    return this.props.source;
  }
  get rateDate(): string | null {
    return this.props.rateDate;
  }

  /** Kayıt dövizli mi (TRY değil). */
  get isForeign(): boolean {
    return this.props.currency !== 'TRY';
  }

  /** Kur biliniyor mu — bilinmiyorsa TRY karşılığı türetilemez. */
  get hasRate(): boolean {
    return this.props.rate !== null;
  }

  /**
   * Verilen tutarın TRY karşılığı (2 ondalığa yuvarlanır).
   * Kur bilinmiyorsa null — çağıran taraf `exchange_rate_history`'ye düşer.
   */
  toTRY(amount: number): number | null {
    if (!Number.isFinite(amount)) return null;
    if (!this.isForeign) return round2(amount);
    if (this.props.rate === null) return null;
    return round2(amount * this.props.rate);
  }

  /** INSERT/UPDATE parametreleri — 051 kolon sırasıyla. */
  toRow(): {
    currency: FxCurrency;
    fx_rate: number | null;
    fx_rate_source: FxRateSource | null;
    fx_rate_date: string | null;
  } {
    return {
      currency: this.props.currency,
      fx_rate: this.isForeign ? this.props.rate : null,
      fx_rate_source: this.props.source,
      fx_rate_date: this.props.rateDate,
    };
  }

  /** API yanıtı için düz nesne (frontend alan adları). */
  toJSON(): {
    currency: FxCurrency;
    fxRate: number | null;
    fxRateSource: FxRateSource | null;
    fxRateDate: string | null;
  } {
    return {
      currency: this.props.currency,
      fxRate: this.isForeign ? this.props.rate : null,
      fxRateSource: this.props.source,
      fxRateDate: this.props.rateDate,
    };
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
