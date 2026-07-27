/**
 * FxCurrencyFields — veri giriş ekranlarının ortak "dövizli kayıt" bloğu.
 *
 * Tek bir tikle açılır; açılınca para birimi + kur kaynağı (Merkez Bankası / Manuel)
 * sorar ve TL karşılığını canlı gösterir. Çözümlenen kur `onChange` ile draft'a
 * yazılır; kaydetmede `normalizeFxDraft()` bu kuru dondurur.
 *
 * Kullanım (App.jsx form'larında):
 *   <FxCurrencyFields
 *     value={draft} amount={draft.amount} date={draft.date}
 *     rateBook={rateBook} lang={lang}
 *     onChange={patch => setDraft(d => ({ ...d, ...patch }))}
 *   />
 * Kaydetmede:
 *   const fx = normalizeFxDraft({ ...draft, amount: draft.amount }, rateBook);
 *   save({ ...draft, ...fx });
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { RateInput } from '../ui/MoneyInput';

import {
  asCurrency,
  fmtFx,
  fmtRate,
  FX_FOREIGN_CURRENCIES,
  FX_SYMBOLS,
  resolveRate,
  toIsoDate,
  type CurrencyCode,
  type FxDraft,
  type RateBasis,
  type RateBook,
} from './fxCore';
import { fetchRateAt } from './fxRatesApi';
import { fxT } from './i18n';

export interface FxCurrencyFieldsProps {
  /** Draft'ın dövizli alanları: isFx, currency, fxRate, fxRateSource. */
  value: FxDraft | null | undefined;
  /** Değişen alanlar — çağıran draft'a birleştirir. */
  onChange: (patch: FxDraft) => void;
  /** Orijinal para birimindeki tutar (TL karşılığı önizlemesi için). */
  amount?: number | string | null;
  /** Belge tarihi (ISO) — tarihsel TCMB kuru bunun üzerinden aranır. */
  date?: string | null;
  rateBook?: RateBook | null;
  lang?: string;
  disabled?: boolean;
  /** Tik kilitli — para birimi bağlamdan gelir (örn. döviz hesabı), kur kaynağı yine seçilebilir. */
  lockToggle?: boolean;
  /** Seçilebilir dövizler (varsayılan USD, EUR). */
  currencies?: readonly CurrencyCode[];
  /** Backend'den (`/v1/finance/fx/rates/at`) tarihsel kur çekilsin mi. Varsayılan true. */
  useBackend?: boolean;
  /** Dış sarmalayıcı sınıfı. */
  className?: string;
  /** Dış sarmalayıcı satır içi stili. */
  style?: CSSProperties;
  /** Kompakt mod — satır içi formlar (yevmiye satırı vb.) için etiketleri kısaltır. */
  compact?: boolean;
}

const BASIS_TONE: Record<RateBasis, string> = {
  identity: 'var(--ink-mute)',
  record: 'var(--ink-mute)',
  history: 'var(--ink-mute)',
  current: '#b45309',
  missing: '#b91c1c',
};

export function FxCurrencyFields({
  value,
  onChange,
  amount,
  date,
  rateBook,
  lang = 'tr',
  disabled = false,
  lockToggle = false,
  currencies = FX_FOREIGN_CURRENCIES,
  useBackend = true,
  className,
  style,
  compact = false,
}: FxCurrencyFieldsProps): JSX.Element {
  const isFx = value?.isFx === true;
  const currency = asCurrency(value?.currency);
  const source = value?.fxRateSource === 'manual' ? 'manual' : 'tcmb';
  const isoDate = toIsoDate(date);

  /** Backend'den gelen tarihli kur (yerel geçmişten üstün). */
  const [serverRate, setServerRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // TCMB modunda belge tarihinin kurunu backend'den çek; yoksa yerel defter devrede kalır.
  useEffect(() => {
    if (!isFx || source !== 'tcmb' || !useBackend || currency === 'TRY') {
      setServerRate(null);
      return;
    }
    let cancelled = false;
    const target = isoDate ?? new Date().toISOString().slice(0, 10);
    setLoading(true);
    void fetchRateAt(currency, target).then((rate) => {
      if (cancelled) return;
      setServerRate(rate);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isFx, source, useBackend, currency, isoDate, reloadTick]);

  // TCMB modunda kur kayda otomatik yazılır (manuel modda kullanıcı yazar).
  const effective =
    source === 'tcmb'
      ? serverRate !== null
        ? { rate: serverRate, basis: 'history' as RateBasis, rateDate: isoDate }
        : resolveRate(currency, { date: isoDate, rateBook: rateBook ?? null })
      : resolveRate(currency, {
          date: isoDate,
          recordRate: value?.fxRate ?? null,
          rateBook: rateBook ?? null,
        });

  // Çözümlenen TCMB kurunu draft'a yaz — kaydetmede donması için.
  const lastPushed = useRef<number | null>(null);
  useEffect(() => {
    if (!isFx || source !== 'tcmb' || loading) return;
    if (effective.basis === 'missing') return;
    if (lastPushed.current === effective.rate && Number(value?.fxRate) === effective.rate) return;
    lastPushed.current = effective.rate;
    onChange({ fxRate: effective.rate, fxRateDate: effective.rateDate ?? isoDate });
    // onChange kimliği çağıran tarafta sabit olmayabilir; bağımlılığa alınmaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFx, source, loading, effective.rate, effective.rateDate, effective.basis, isoDate]);

  const toggle = (next: boolean): void => {
    if (next) {
      onChange({
        isFx: true,
        currency: currencies[0] ?? 'USD',
        fxRateSource: 'tcmb',
        fxRate: null,
        fxRateDate: isoDate,
      });
    } else {
      lastPushed.current = null;
      onChange({
        isFx: false,
        currency: 'TRY',
        fxRate: null,
        fxRateSource: null,
        fxRateDate: null,
      });
    }
  };

  const amountNum = Number(String(amount ?? '').replace(',', '.'));
  const tryEquivalent = Number.isFinite(amountNum) ? amountNum * effective.rate : null;

  const basisNote =
    effective.basis === 'history'
      ? fxT('fx.basis.history', lang, { date: effective.rateDate ?? isoDate ?? '—' })
      : effective.basis === 'current'
        ? fxT('fx.basis.current', lang)
        : effective.basis === 'missing'
          ? fxT('fx.basis.missing', lang)
          : fxT('fx.basis.record', lang);

  return (
    <div className={className} style={style} data-testid="fx-currency-fields">
      <label
        className="flex items-center gap-2 text-xs cursor-pointer select-none"
        style={{ color: 'var(--ink)' }}
      >
        <input
          type="checkbox"
          checked={isFx}
          disabled={disabled || lockToggle}
          onChange={(e) => toggle(e.target.checked)}
          data-testid="fx-toggle"
        />
        <span className="font-medium">{fxT('fx.enable', lang)}</span>
      </label>

      {!isFx && !compact && (
        <p className="text-xs mt-1" style={{ color: 'var(--ink-mute)' }}>
          {fxT('fx.enableHint', lang)}
        </p>
      )}

      {isFx && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <div className="label mb-1">{fxT('fx.currency', lang)}</div>
            <select
              className="input"
              value={currency}
              disabled={disabled}
              data-testid="fx-currency"
              onChange={(e) => {
                lastPushed.current = null;
                onChange({ currency: e.target.value, fxRate: null });
              }}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {FX_SYMBOLS[c]} {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label mb-1">{fxT('fx.rateSource', lang)}</div>
            <select
              className="input"
              value={source}
              disabled={disabled}
              data-testid="fx-rate-source"
              onChange={(e) => {
                lastPushed.current = null;
                const next = e.target.value === 'manual' ? 'manual' : 'tcmb';
                // Manuele geçerken mevcut çözümlenen kuru başlangıç değeri yap.
                onChange({
                  fxRateSource: next,
                  fxRate: next === 'manual' ? effective.rate : null,
                });
              }}
            >
              <option value="tcmb">{fxT('fx.source.tcmb', lang)}</option>
              <option value="manual">{fxT('fx.source.manual', lang)}</option>
            </select>
          </div>

          <div>
            <div className="label mb-1">{fxT('fx.rateOne', lang, { cur: currency })} ₺</div>
            {source === 'manual' ? (
              <RateInput
                className="input num text-right"
                value={value?.fxRate ?? ''}
                disabled={disabled}
                data-testid="fx-rate-input"
                onChange={(v) => onChange({ fxRate: v === '' ? null : v, fxRateDate: isoDate })}
              />
            ) : (
              <div className="flex items-center gap-1">
                <div
                  className="input num text-right flex-1"
                  style={{ background: 'var(--bg-alt)', color: 'var(--ink)' }}
                  data-testid="fx-rate-readonly"
                >
                  {loading ? fxT('fx.loading', lang) : fmtRate(effective.rate)}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  title={fxT('fx.refresh', lang)}
                  disabled={disabled || loading}
                  onClick={() => setReloadTick((n) => n + 1)}
                >
                  ↻
                </button>
              </div>
            )}
          </div>

          <div className="sm:col-span-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
            <span style={{ color: 'var(--ink-mute)' }}>{fxT('fx.tryEquivalent', lang)}:</span>
            <strong className="mono" data-testid="fx-try-equivalent">
              {tryEquivalent === null ? '—' : `${fmtFx(tryEquivalent)} ₺`}
            </strong>
            <span style={{ color: BASIS_TONE[effective.basis] }}>
              {source === 'manual' ? fxT('fx.manualHint', lang) : basisNote}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default FxCurrencyFields;
