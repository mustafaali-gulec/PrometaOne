/**
 * AdoptBlobFinanceKasaUseCase — blob (promet:data) kasa çekirdeğinin
 * (kasaAccounts + kasaEntries) TEK SEFERLİK, İDEMPOTENT devralınması.
 * Emsal: AdoptBlobHrRecruitingUseCase (işe alım yazma-cutover'ı).
 *
 * Girdi blob alan adlarıyla GEVŞEK gelir; bu use-case blob kayıtlarını
 * savunmacı coercion ile NormalizedAdoptKasa* satırlara çevirir ve
 * AdoptFinanceKasaRepository.adoptAll'a (tek transaction) verir. Kimliksiz
 * (id'siz) ve adsız kasa kayıtları atlanır — client_id idempotens anahtarıdır
 * ve name NOT NULL'dır. kasaAccountId OLMAYAN hareketler düşer
 * (kasa_account_id NOT NULL).
 *
 * Şema uyum kuralları FinanceProjection ile aynı (TEK KAYNAK:
 * currencyOrNull + flowDirectionOrNull; sayaç adları da birebir):
 *   - currency bilinmeyen → hesap düşer (kasaAccounts.currency).
 *   - tarih bozuk → hareket düşer (kasaEntries.date).
 *   - type in/out dışı → düşer (kasaEntries.type).
 *   - tutar <= 0 / sayısal değil → düşer (kasaEntries.amount) — CHECK amount > 0.
 *   - kasaRef repo'da çözülemezse düşer (kasaEntries.kasaAccount).
 * kasaCategories BLOB'DA KALIR — entries.category kategori ADI serbest
 * metniyle taşınır (doğrulama yok).
 */
import { currencyOrNull, flowDirectionOrNull } from '../../../appstate/domain/FinanceProjection.js';
import type {
  AdoptFinanceKasaInput,
  AdoptFinanceKasaResultDto,
  NormalizedAdoptKasaAccount,
  NormalizedAdoptKasaEntry,
} from '../dto/AdoptFinanceKasaDtos.js';
import type { AdoptFinanceKasaRepository } from '../ports/AdoptFinanceKasaRepository.js';

// ===== yardımcı coercion'lar (FinanceProjection kalıbı) =====================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function idString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function text(value: unknown, max?: number): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (t === '') return null;
  return max !== undefined ? t.slice(0, max) : t;
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

class DropCounter {
  readonly counts: Record<string, number> = {};
  add(reason: string, n = 1): void {
    if (n <= 0) return;
    this.counts[reason] = (this.counts[reason] ?? 0) + n;
  }
}

// ===== normalizasyon ========================================================

function normalizeAccount(
  raw: Record<string, unknown>,
  dropped: DropCounter,
): NormalizedAdoptKasaAccount | null {
  const clientId = idString(raw['id']);
  if (clientId === null) return null; // id'siz — idempotens anahtarı yok, atla
  const name = text(raw['name'], 200);
  if (name === null) {
    dropped.add('kasaAccounts.name');
    return null;
  }
  const currency = currencyOrNull(raw['currency']);
  if (currency === null) {
    dropped.add('kasaAccounts.currency');
    return null;
  }
  return {
    clientId,
    name,
    currency,
    openingBalance: round2(finiteOrNull(raw['openingBalance']) ?? 0),
    active: raw['active'] !== false,
  };
}

function normalizeEntry(
  raw: Record<string, unknown>,
  dropped: DropCounter,
): NormalizedAdoptKasaEntry | null {
  const clientId = idString(raw['id']);
  if (clientId === null) return null; // id'siz — atla
  const kasaRef = idString(raw['kasaAccountId']);
  if (kasaRef === null) {
    dropped.add('kasaEntries.kasaAccount'); // kasa_account_id NOT NULL — düşür
    return null;
  }
  const date = isoDateOrNull(raw['date']);
  if (date === null) {
    dropped.add('kasaEntries.date'); // date NOT NULL — düşür
    return null;
  }
  const type = flowDirectionOrNull(raw['type']);
  if (type === null) {
    dropped.add('kasaEntries.type');
    return null;
  }
  const amountRaw = finiteOrNull(raw['amount']);
  const amount = amountRaw !== null ? round2(amountRaw) : null;
  if (amount === null || amount <= 0) {
    dropped.add('kasaEntries.amount'); // CHECK amount > 0 — düşür
    return null;
  }
  return {
    clientId,
    kasaRef,
    date,
    type,
    amount,
    description: text(raw['description']),
    category: text(raw['category'], 200),
    cashflowCatRef: idString(raw['cashflowCatId']),
  };
}

/** clientId çakışmasında SON kazanır (aynı batch'te dupe upsert hedefi olmasın). */
function dedupeByClientId<T extends { clientId: string }>(rows: ReadonlyArray<T>): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(row.clientId, row);
  return [...map.values()];
}

// ===== use case =============================================================

export class AdoptBlobFinanceKasaUseCase {
  constructor(private readonly repo: AdoptFinanceKasaRepository) {}

  async execute(input: AdoptFinanceKasaInput): Promise<AdoptFinanceKasaResultDto> {
    const dropped = new DropCounter();

    const accounts = dedupeByClientId(
      (input.accounts ?? []).filter(isPlainObject).flatMap((raw) => {
        const a = normalizeAccount(raw, dropped);
        return a ? [a] : [];
      }),
    );
    const entries = dedupeByClientId(
      (input.entries ?? []).filter(isPlainObject).flatMap((raw) => {
        const e = normalizeEntry(raw, dropped);
        return e ? [e] : [];
      }),
    );

    if (accounts.length === 0 && entries.length === 0) {
      // Boş gövde — DB'ye hiç gitmeden boş sonuç (idempotent no-op).
      return {
        adopted: { accounts: 0, entries: 0 },
        idMap: { accounts: {}, entries: {} },
        dropped: dropped.counts,
      };
    }

    const outcome = await this.repo.adoptAll(input.companyId, { accounts, entries });
    dropped.add('kasaEntries.kasaAccount', outcome.unresolvedEntries);

    return {
      adopted: {
        accounts: Object.keys(outcome.accountIdByClient).length,
        entries: Object.keys(outcome.entryIdByClient).length,
      },
      idMap: {
        accounts: outcome.accountIdByClient,
        entries: outcome.entryIdByClient,
      },
      dropped: dropped.counts,
    };
  }
}
