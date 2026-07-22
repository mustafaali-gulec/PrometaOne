/**
 * AdoptFinanceKasa DTO'ları — blob (promet:data) kasa çekirdeğinin
 * (kasaAccounts + kasaEntries) tek seferlik, idempotent devralınması
 * (POST /v1/finance/kasa/adopt-blob). Emsal: AdoptHrRecruitingDtos.
 *
 * Girdi blob alan adlarıyla GEVŞEK gelir (appstate/domain/FinanceProjection.ts'te
 * doğrulanmış eşlemeden):
 *   accounts ← kasaAccounts = { id:"ksa_...", name, currency, openingBalance,
 *                               active }
 *   entries  ← kasaEntries  = { id:"kse_...", kasaAccountId, date, type(in|out),
 *                               amount, description, category (kategori ADI,
 *                               serbest metin — blob'da KALIR), cashflowCatId? }
 *
 * Enum/NOT NULL uyum kuralları FinanceProjection ile aynı (TEK KAYNAK:
 * CURRENCY_MAP üzerinden currencyOrNull + flowDirectionOrNull):
 *   - currency: TL→TRY, EURO→EUR, boş→TRY; bilinmeyen → hesap DÜŞER + sayaç.
 *   - type: in/out; bilinmeyen → hareket DÜŞER + sayaç.
 *   - amount: CHECK (amount > 0) — pozitif olmayan/bozuk DÜŞER + sayaç.
 *   - date: bozuk ISO olmayan → hareket DÜŞER + sayaç (date NOT NULL).
 *   - cashflowCatId: kategoriler MEZUN DEĞİL — referans olduğu gibi taşınır,
 *     repo DB categories kümesinden çözer (client_id + sayısal id);
 *     çözülemezse NULL (nullable FK).
 *
 * Şemada kolonu olmayan blob alanları taşınmaz (kasaEntries.paymentMethod/
 * invoiceNo...).
 */
import type { DbCurrency, DbFlowDirection } from '../../../appstate/domain/FinanceProjection.js';

// ===== Girdi (gevşek blob kayıtları) ========================================

export interface AdoptFinanceKasaInput {
  companyId: number;
  accounts?: ReadonlyArray<Record<string, unknown>> | undefined;
  entries?: ReadonlyArray<Record<string, unknown>> | undefined;
}

// ===== Normalize satırlar (repository sözleşmesi) ===========================

export interface NormalizedAdoptKasaAccount {
  clientId: string;
  name: string;
  currency: DbCurrency;
  openingBalance: number;
  active: boolean;
}

export interface NormalizedAdoptKasaEntry {
  clientId: string;
  /**
   * Blob kasaAccounts id'si — repo önce BU çağrının idMap'inden, sonra DB'deki
   * client_id'lerden (önceki adopt / eski projeksiyon satırı), en son geçerli
   * SAYISAL sunucu id'sinden çözer (işe alım emsalindeki üç kademe);
   * çözülemezse satır düşer (kasa_account_id NOT NULL) — transaction bozulmaz.
   */
  kasaRef: string;
  date: string; // YYYY-MM-DD
  type: DbFlowDirection;
  /** Pozitif, 2 haneye yuvarlanmış major tutar (CHECK amount > 0). */
  amount: number;
  description: string | null;
  /** Kategori ADI serbest metin — kasaCategories BLOB'DA KALIR. */
  category: string | null;
  /** Kategori referansı — repo DB categories kümesinden çözer; olmazsa NULL. */
  cashflowCatRef: string | null;
}

// ===== Sonuç ================================================================

export interface AdoptFinanceKasaResultDto {
  adopted: { accounts: number; entries: number };
  /** clientId → serverId (kasa_accounts/kasa_entries SERIAL id). */
  idMap: {
    accounts: Record<string, number>;
    entries: Record<string, number>;
  };
  /**
   * Düşürülen satır sayaçları — FinanceProjection sayaç adlarıyla
   * ("kasaAccounts.currency", "kasaEntries.amount", "kasaEntries.kasaAccount"...).
   */
  dropped: Record<string, number>;
}
