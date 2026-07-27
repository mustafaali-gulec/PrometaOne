/**
 * Modüller arası döviz (FX) çekirdeği — tek giriş noktası.
 * Frontend karşılığı: frontend/src/shared/fx
 * Şema karşılığı: construction-service/migrations/004_fx_currency_fields.sql
 */
export {
  asFxCurrency,
  asFxRateSource,
  FX_CURRENCIES,
  FX_RATE_SOURCES,
  FxInfo,
  isFxCurrency,
  isFxRateSource,
} from './FxInfo.js';
export type { FxCurrency, FxInfoProps, FxRateSource, FxRowFields } from './FxInfo.js';
