/**
 * Material DTO'ları.
 */
import type { Material, MaterialAltUnit, MaterialWhParam } from '../../domain/entities/Material.js';
import type {
  AbcClass,
  CostMethod,
  MaterialStatus,
  NegativeControl,
  TrackMethod,
} from '../../domain/valueObjects/MaterialEnums.js';

export interface MaterialDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  groupId: number | null;
  type: string | null;
  baseUnit: string;
  altUnits: ReadonlyArray<MaterialAltUnit>;
  brand: string | null;
  barcode: string | null;
  producerCode: string | null;
  gtip: string | null;
  abc: AbcClass | null;
  trackMethod: TrackMethod;
  costMethod: CostMethod;
  negativeControl: NegativeControl;
  minStock: number | null;
  maxStock: number | null;
  safetyStock: number | null;
  shelfLifeMonths: number | null;
  perishable: boolean;
  fragile: boolean;
  kdvPurchase: number | null;
  kdvSale: number | null;
  tevkifatCode: string | null;
  extraTaxRate: number | null;
  purchasePrice: number | null;
  salePrice: number | null;
  whParams: ReadonlyArray<MaterialWhParam>;
  status: MaterialStatus;
}

export function toMaterialDto(m: Material): MaterialDto {
  return m.toJSON();
}
