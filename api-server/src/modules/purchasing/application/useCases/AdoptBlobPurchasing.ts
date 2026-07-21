/**
 * AdoptBlobPurchasingUseCase — blob (promet:data) satınalma koleksiyonlarının
 * TEK SEFERLİK, İDEMPOTENT devralınması.
 *
 * Girdi blob alan adlarıyla GEVŞEK gelir; bu use-case blob kayıtlarını
 * savunmacı coercion ile Normalized* satırlara çevirir ve AdoptBlobRepository
 * .adoptAll'a (tek transaction) verir. Kimliksiz (id'siz) kayıtlar atlanır —
 * client_id idempotens anahtarıdır, onsuz devralma güvenli değildir.
 *
 * Alan eşlemesi (blob → tablo) ve statü haritası dosya sonundaki
 * sabitlerde/yardımcılarda; sapmalar:
 *   - PO 'sent'/'confirmed' blob statüleri po_status ENUM'unda yok →
 *     'ordered'a haritalanır.
 *   - PO expectedDelivery / paymentTerms / deliveryAddress kolon karşılığı
 *     olmadığından taşınmaz.
 *   - PR requesterUsername → users.username lookup'ı repository'de
 *     (requester_user_id INT FK users); bulunamazsa NULL.
 *   - departmentId blob'da string olabilir ("dept_...") → yalnız pozitif
 *     tamsayıya çevrilebilenler taşınır (kolon INT, gevşek bağ).
 */
import { isCurrencyCode, round2, type CurrencyCode } from '../../domain/valueObjects/Currency.js';
import { isPoStatus, type PoStatus } from '../../domain/valueObjects/PoStatus.js';
import { isPrStatus, type PrStatus } from '../../domain/valueObjects/PrStatus.js';
import type {
  AdoptBlobInput,
  AdoptBlobResultDto,
  NormalizedOrder,
  NormalizedPoLine,
  NormalizedPrItem,
  NormalizedRequest,
  NormalizedVendor,
} from '../dto/AdoptBlobDtos.js';
import type { AdoptBlobRepository } from '../ports/AdoptBlobRepository.js';

// ===== yardımcı coercion'lar ================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function idString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim().slice(0, max);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
  return null;
}

function numberOr(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return n;
  return fallback;
}

/** 'YYYY-MM-DD' (veya ISO'nun ilk 10 hanesi) → DATE string; aksi null. */
function dateOnlyOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const d = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** Parse edilebilir zaman damgası → ISO string; aksi null. */
function timestampOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function currencyOf(value: unknown): CurrencyCode {
  return isCurrencyCode(value) ? value : 'TRY';
}

// ===== statü haritaları =====================================================

/** Blob PO statüleri ('sent'/'confirmed' dahil) → po_status ENUM. */
const PO_STATUS_MAP: Readonly<Record<string, PoStatus>> = {
  draft: 'draft',
  sent: 'ordered', // ENUM'da yok → sipariş verildi
  confirmed: 'ordered', // ENUM'da yok → sipariş verildi
  ordered: 'ordered',
  partial: 'partial',
  received: 'received',
  invoiced: 'invoiced',
  closed: 'closed',
  cancelled: 'cancelled',
};

function poStatusOf(value: unknown): PoStatus {
  if (typeof value === 'string') {
    const mapped = PO_STATUS_MAP[value];
    if (mapped !== undefined) return mapped;
    if (isPoStatus(value)) return value;
  }
  return 'draft';
}

function prStatusOf(value: unknown): PrStatus {
  return isPrStatus(value) ? value : 'draft';
}

// ===== normalizasyon ========================================================

function normalizeVendor(raw: Record<string, unknown>): NormalizedVendor | null {
  const clientId = idString(raw['id']);
  const name = text(raw['name'], 300);
  if (clientId === null || name === null) return null;

  const accounting = isPlainObject(raw['accounting']) ? raw['accounting'] : {};
  const personType = raw['personType'] === 'real' ? 'real' : 'legal';
  const rawCariClass = accounting['cariClass'] ?? raw['cariClass'];
  const cariClass = rawCariClass === 'alici' ? 'alici' : 'satici'; // tedarikçi öndeğeri
  const accountCode =
    text(accounting[cariClass === 'satici' ? 'accountCode_satici' : 'accountCode_alici'], 40) ??
    text(raw['accountCode'], 40);
  const status = raw['status'];

  return {
    clientId,
    // vendors.code NOT NULL UNIQUE(company_id, code) — blob'da yoksa clientId'den türet.
    code: text(raw['code'], 40) ?? `V-${clientId}`.slice(0, 40),
    name,
    taxId: text(raw['taxId'], 20) ?? text(raw['taxNumber'], 20),
    personType,
    cariClass,
    accountCode,
    taxOffice: text(raw['vatOffice'], 120) ?? text(raw['taxOffice'], 120),
    address: text(raw['address'], 2000),
    active: typeof status === 'string' ? status === 'active' : raw['active'] !== false,
  };
}

function normalizePrItems(raw: unknown): NormalizedPrItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPlainObject).map((item, index) => ({
    lineNo: index + 1,
    description: text(item['description'], 500) ?? '-',
    quantity: numberOr(item['quantity'], 1),
    unitPrice: numberOr(item['unitPrice'], 0),
    note: text(item['note'], 2000),
  }));
}

function normalizeRequest(raw: Record<string, unknown>): NormalizedRequest | null {
  const clientId = idString(raw['id']);
  if (clientId === null) return null;

  const items = normalizePrItems(raw['items']);
  const computedTotal = round2(items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0));
  const deptNum = Number(raw['departmentId']);

  return {
    clientId,
    prNo: text(raw['prNo'], 40) ?? `PR-${clientId}`.slice(0, 40),
    requesterUsername: text(raw['requesterUsername'], 120),
    departmentId: Number.isInteger(deptNum) && deptNum > 0 ? deptNum : null,
    category: text(raw['category'], 40) ?? 'other',
    priority: text(raw['priority'], 20) ?? 'normal',
    status: prStatusOf(raw['status']),
    currency: currencyOf(raw['currency']),
    totalAmount: round2(numberOr(raw['totalAmount'], computedTotal)),
    justification: text(raw['justification'], 4000),
    requiredBy: dateOnlyOrNull(raw['requiredBy']),
    requestedAt: timestampOrNull(raw['requestedAt']),
    items,
  };
}

function normalizePoLines(raw: unknown): NormalizedPoLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPlainObject).map((item, index) => ({
    lineNo: index + 1,
    description: text(item['description'], 500) ?? '-',
    quantity: numberOr(item['quantity'], 1),
    receivedQty: numberOr(item['receivedQty'], 0),
    unitPrice: numberOr(item['unitPrice'], 0),
  }));
}

function normalizeOrder(raw: Record<string, unknown>): NormalizedOrder | null {
  const clientId = idString(raw['id']);
  if (clientId === null) return null;

  const lines = normalizePoLines(raw['items']);
  const computedTotal = round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));

  return {
    clientId,
    poNo: text(raw['poNo'], 40) ?? `PO-${clientId}`.slice(0, 40),
    vendorClientId: idString(raw['vendorId']),
    prClientId: idString(raw['sourcePRId']) ?? idString(raw['prId']),
    status: poStatusOf(raw['status']),
    currency: currencyOf(raw['currency']),
    totalAmount: round2(numberOr(raw['totalAmount'], computedTotal)),
    orderedAt: timestampOrNull(raw['orderedAt']),
    deliveredAt: timestampOrNull(raw['deliveredAt']),
    note: text(raw['notes'], 4000) ?? text(raw['note'], 4000),
    lines,
  };
}

/** clientId çakışmasında SON kazanır (aynı batch'te dupe upsert hedefi olmasın). */
function dedupeByClientId<T extends { clientId: string }>(rows: ReadonlyArray<T>): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(row.clientId, row);
  return [...map.values()];
}

// ===== use case =============================================================

export class AdoptBlobPurchasingUseCase {
  constructor(private readonly repo: AdoptBlobRepository) {}

  async execute(input: AdoptBlobInput): Promise<AdoptBlobResultDto> {
    const vendors = dedupeByClientId(
      (input.vendors ?? []).filter(isPlainObject).flatMap((raw) => {
        const v = normalizeVendor(raw);
        return v ? [v] : [];
      }),
    );
    const requests = dedupeByClientId(
      (input.requests ?? []).filter(isPlainObject).flatMap((raw) => {
        const r = normalizeRequest(raw);
        return r ? [r] : [];
      }),
    );
    const orders = dedupeByClientId(
      (input.orders ?? []).filter(isPlainObject).flatMap((raw) => {
        const o = normalizeOrder(raw);
        return o ? [o] : [];
      }),
    );

    if (vendors.length === 0 && requests.length === 0 && orders.length === 0) {
      // Boş gövde — DB'ye hiç gitmeden boş sonuç (idempotent no-op).
      return {
        adopted: { vendors: 0, requests: 0, orders: 0 },
        skipped: { orders: 0 },
        idMap: { vendors: {}, requests: {}, orders: {} },
      };
    }

    const outcome = await this.repo.adoptAll(input.companyId, { vendors, requests, orders });

    return {
      adopted: {
        vendors: Object.keys(outcome.vendorIdByClient).length,
        requests: Object.keys(outcome.requestIdByClient).length,
        orders: Object.keys(outcome.orderIdByClient).length,
      },
      skipped: { orders: outcome.skippedOrders },
      idMap: {
        vendors: outcome.vendorIdByClient,
        requests: outcome.requestIdByClient,
        orders: outcome.orderIdByClient,
      },
    };
  }
}
