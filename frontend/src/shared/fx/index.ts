/**
 * Proje geneli döviz (FX) çekirdeği — tek giriş noktası.
 *
 * - `fxCore`          : saf kur/çevrim mantığı (kaydın kuru → tarihli TCMB → güncel kur)
 * - `FxCurrencyFields`: veri giriş ekranlarının ortak "dövizli kayıt" bloğu
 * - `fxRatesApi`      : backend TCMB uçları (`/v1/finance/fx`)
 * - `i18n`            : TR/EN/DE/AR etiketler
 */
export {
  asCurrency,
  blankFx,
  convertTRYForDisplay,
  displayAmount,
  findHistoryRate,
  fmtFx,
  fmtFxMoney,
  fmtFxSign,
  fmtRate,
  FX_CURRENCIES,
  FX_FOREIGN_CURRENCIES,
  FX_SYMBOLS,
  fxFromTRY,
  fxToTRY,
  isCurrencyCode,
  normalizeFxDraft,
  rateBookFromAppState,
  recordAmountTRY,
  resolveRate,
  sumTRY,
  toIsoDate,
  todayIso,
} from './fxCore';
export type {
  CurrencyCode,
  FxDraft,
  FxRateSource,
  FxRecord,
  RateBasis,
  RateBook,
  RateHistoryEntry,
  ResolvedRate,
} from './fxCore';

export { FxCurrencyFields } from './FxCurrencyFields';
export type { FxCurrencyFieldsProps } from './FxCurrencyFields';

export { clearFxRateCache, fetchCurrentRates, fetchRateAt } from './fxRatesApi';
export type { CurrentRates } from './fxRatesApi';

export { fxT } from './i18n';
export type { FxLabelKey, Lang as FxLang } from './i18n';
