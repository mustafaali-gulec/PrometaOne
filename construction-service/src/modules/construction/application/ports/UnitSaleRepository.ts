/**
 * UnitSaleRepository — konut satış kalıcılık portu (FAZ 10).
 * Concrete: infrastructure/persistence/PgUnitSaleRepository.ts
 */
import type { UnitChangeRequest } from '../../domain/entities/UnitChangeRequest.js';
import type {
  UnitSale,
  UnitSaleSource,
  UnitSaleStatus,
  UnitPaymentKind,
  UnitPaymentMethod,
} from '../../domain/entities/UnitSale.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';

export interface NewUnitSaleInput {
  companyId: number;
  projectId: number;
  locationId: number;
  status: UnitSaleStatus;
  source: UnitSaleSource;
  refNo: string | null;
  buyerName: string | null;
  vendorId: number | null;
  listPrice: number;
  salePrice: number;
  currency: CurrencyCode;
  reservedAt: string | null;
  soldAt: string | null;
  note: string | null;
  createdBy: number | null;
}

export interface UnitSaleFilter {
  projectId?: number | undefined;
  locationId?: number | undefined;
  status?: UnitSaleStatus | undefined;
  source?: UnitSaleSource | undefined;
  search?: string | undefined;
}

export interface UnitInventoryRow {
  locationId: number;
  projectId: number;
  code: string;
  name: string;
  path: string;
  unitType: string | null;
  grossArea: number | null;
  netArea: number | null;
  facade: string | null;
  /** Defterdeki güncel liste fiyatı (girilmemişse null). */
  bookListPrice: number | null;
  saleId: number | null;
  /** 'available' türetilir — satışsız daire. */
  saleStatus: string;
  source: string | null;
  refNo: string | null;
  buyerName: string | null;
  vendorId: number | null;
  saleListPrice: number | null;
  salePrice: number | null;
  /** Satış anındaki liste − satış; liste donuğu 0 ise null (iskonto bilinmiyor). */
  discount: number | null;
  reservedAt: string | null;
  soldAt: string | null;
  changeOrderTotal: number | null;
  collected: number | null;
  /** satış + onaylı değişiklik − tahsilat; satışsız dairede null. */
  remaining: number | null;
  openChangeRequests: number;
}

export interface ProjectSalesSummaryRow {
  projectId: number;
  unitCount: number;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  barterCount: number;
  soldValue: number;
  reservedValue: number;
  /** İş karşılığı verilen dairelerin bedeli — nakit DEĞİL, taşeron mahsubu. */
  barterValue: number;
  changeOrderTotal: number;
  collectedTotal: number;
  remainingTotal: number;
  /** Fiyatlanmış boş dairelerin liste değeri; hiç fiyat yoksa null. */
  availableListValue: number | null;
  /** Liste fiyatı girilmemiş boş daire — veri kalitesi göstergesi. */
  unpricedAvailableCount: number;
  openChangeRequests: number;
  cancelledCount: number;
  /** İptal edilmiş satışlarda iade edilmemiş tahsilat. */
  refundLiability: number;
}

export interface UnitPaymentRow {
  id: number;
  saleId: number;
  kind: UnitPaymentKind;
  paidAt: string;
  amount: number;
  method: UnitPaymentMethod | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
}

export interface NewUnitPaymentInput {
  companyId: number;
  saleId: number;
  kind: UnitPaymentKind;
  paidAt: string;
  amount: number;
  method: UnitPaymentMethod | null;
  note: string | null;
  createdBy: number | null;
}

export interface NewChangeRequestInput {
  companyId: number;
  saleId: number;
  code: string;
  title: string;
  description: string | null;
  cost: number;
  requestedAt: string;
  note: string | null;
  createdBy: number | null;
}

export interface UnitSaleRepository {
  insert(input: NewUnitSaleInput): Promise<UnitSale>;
  findById(id: number, companyId: number): Promise<UnitSale | null>;
  /** Senkron anahtarıyla arama (source + refNo). */
  findByRef(companyId: number, source: UnitSaleSource, refNo: string): Promise<UnitSale | null>;
  /** Dairedeki aktif (iptal edilmemiş) satış. */
  findActiveByLocation(locationId: number, companyId: number): Promise<UnitSale | null>;
  list(companyId: number, filter?: UnitSaleFilter): Promise<ReadonlyArray<UnitSale>>;
  update(sale: UnitSale): Promise<UnitSale>;

  inventory(companyId: number, projectId: number): Promise<ReadonlyArray<UnitInventoryRow>>;
  projectSummary(companyId: number, projectId: number): Promise<ProjectSalesSummaryRow | null>;

  upsertListPrice(input: {
    companyId: number;
    projectId: number;
    locationId: number;
    listPrice: number;
    note: string | null;
    updatedBy: number | null;
  }): Promise<{ locationId: number; listPrice: number }>;
  getListPrice(locationId: number, companyId: number): Promise<number | null>;

  insertPayment(input: NewUnitPaymentInput): Promise<UnitPaymentRow>;
  deletePayment(id: number, companyId: number): Promise<boolean>;
  listPayments(saleId: number, companyId: number): Promise<ReadonlyArray<UnitPaymentRow>>;
  /** Net tahsilat = Σcollection − Σrefund. */
  collectedFor(saleId: number): Promise<number>;

  insertChangeRequest(input: NewChangeRequestInput): Promise<UnitChangeRequest>;
  findChangeRequestById(id: number, companyId: number): Promise<UnitChangeRequest | null>;
  listChangeRequests(saleId: number, companyId: number): Promise<ReadonlyArray<UnitChangeRequest>>;
  updateChangeRequest(cr: UnitChangeRequest): Promise<UnitChangeRequest>;
  nextChangeRequestCode(companyId: number): Promise<string>;
}
