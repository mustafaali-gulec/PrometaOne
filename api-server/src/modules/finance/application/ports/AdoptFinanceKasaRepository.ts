/**
 * AdoptFinanceKasaRepository PORT'u — normalize blob kasa satırlarının
 * (kasaAccounts + kasaEntries) TEK transaction'da devralınması.
 * Implementasyon: PgAdoptFinanceKasaRepository. Emsal: AdoptHrRecruitingRepository.
 *
 * Sözleşme:
 *   - kasa_accounts upsert anahtarı (company_id, client_id)
 *     (048_finance_projection.sql kolonları) → ikinci çağrı duplicate üretmez.
 *   - kasa_entries upsert anahtarı düz UNIQUE(client_id) (tabloda company_id
 *     kolonu yok — şirket üst FK'dan gelir).
 *   - entries.kasaRef önce BU çağrıda upsert edilen, sonra tabloda zaten var
 *     olan (önceki adopt / eski projeksiyon) client_id'ler, en son geçerli
 *     sayısal sunucu id'leri üzerinden çözülür; çözülemeyen hareket DÜŞER
 *     (kasa_account_id NOT NULL) — transaction bozulmaz, düşen sayısı döner.
 *   - entries.cashflowCatRef DB'deki geçerli kategori kümesiyle çözülür
 *     (client_id haritası + sayısal sunucu id doğrulaması); çözülemezse NULL
 *     (nullable FK).
 */
import type {
  NormalizedAdoptKasaAccount,
  NormalizedAdoptKasaEntry,
} from '../dto/AdoptFinanceKasaDtos.js';

export interface AdoptFinanceKasaPayload {
  accounts: ReadonlyArray<NormalizedAdoptKasaAccount>;
  entries: ReadonlyArray<NormalizedAdoptKasaEntry>;
}

export interface AdoptFinanceKasaOutcome {
  /** clientId → serverId (bu çağrıda upsert edilenler). */
  accountIdByClient: Record<string, number>;
  entryIdByClient: Record<string, number>;
  /** kasaRef'i çözülemediği için düşen hareket sayısı (kasa_account_id NOT NULL). */
  unresolvedEntries: number;
}

export interface AdoptFinanceKasaRepository {
  adoptAll(companyId: number, payload: AdoptFinanceKasaPayload): Promise<AdoptFinanceKasaOutcome>;
}
