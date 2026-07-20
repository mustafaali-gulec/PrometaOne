/**
 * Sabit Kıymet REST-sınır DTO'ları.
 *
 * Kaynak-of-truth UI tarafındaki app-state blob'u olduğundan (performance
 * modülü ile aynı model) DTO'lar blob şekliyle birebir camelCase yansımadır;
 * `id` alanı istemci-üretimi client_id'dir. FE tipleriyle el ile senkron
 * tutulur (paylaşılan paket yok).
 */

export type FixedAssetMethod = 'normal' | 'declining';
export type FixedAssetStatus = 'active' | 'sold' | 'scrapped' | 'inactive';
export type FixedAssetMovementType = 'transfer' | 'sale' | 'scrap';

export interface FixedAssetDto {
  id: string;
  companyId: number;
  code: string;
  name: string;
  category: string | null;
  location: string | null;
  departmentId: string | null;
  employeeId: string | null;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeYears: number;
  method: FixedAssetMethod;
  isPassengerCar: boolean;
  salvageValue: number;
  openingAccumulated: number;
  assetAccountCode: string | null;
  accumAccountCode: string | null;
  expenseAccountCode: string | null;
  status: FixedAssetStatus;
  disposalDate: string | null;
  disposalAmount: number | null;
  disposalJournalEntryId: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FixedAssetMovementDto {
  id: string;
  companyId: number;
  /** fixed_assets.client_id soft referansı. */
  assetId: string;
  type: FixedAssetMovementType | null;
  date: string;
  amount: number | null;
  vatRate: number | null;
  counterAccountCode: string | null;
  gainLoss: number | null;
  fromLocation: string | null;
  toLocation: string | null;
  notes: string | null;
  journalEntryId: string | null;
  createdAt: string | null;
}

export interface DepreciationRunLineDto {
  assetId: string;
  amount: number;
}

export interface DepreciationRunDto {
  id: string;
  companyId: number;
  periodStart: string;
  periodEnd: string;
  runDate: string | null;
  total: number;
  journalEntryId: string | null;
  voucherNo: string | null;
  status: string;
  lines: DepreciationRunLineDto[];
  createdAt: string | null;
  updatedAt: string | null;
}

// --- Sync payload (blob → SQL aynası) ---------------------------------------

export type FixedAssetSyncItem = Omit<FixedAssetDto, 'companyId'>;
export type FixedAssetMovementSyncItem = Omit<FixedAssetMovementDto, 'companyId'>;
export type DepreciationRunSyncItem = Omit<DepreciationRunDto, 'companyId'>;

export interface SyncFixedAssetsPayloadDto {
  companyId: number;
  assets: FixedAssetSyncItem[];
  movements: FixedAssetMovementSyncItem[];
  runs: DepreciationRunSyncItem[];
  prune?: boolean | undefined;
}

export interface SyncFixedAssetsResultDto {
  assetsUpserted: number;
  movementsUpserted: number;
  runsUpserted: number;
  assetsDeleted: number;
  movementsDeleted: number;
  runsDeleted: number;
}
