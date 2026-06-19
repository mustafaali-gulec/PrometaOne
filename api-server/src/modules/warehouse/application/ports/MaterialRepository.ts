/**
 * MaterialRepository — malzeme kalıcılık portu.
 * Concrete: infrastructure/persistence/PgMaterialRepository.ts.
 */
import type { Material, MaterialAltUnit, MaterialWhParam } from '../../domain/entities/Material.js';
import type {
  AbcClass,
  CostMethod,
  MaterialStatus,
  NegativeControl,
  TrackMethod,
} from '../../domain/valueObjects/MaterialEnums.js';

export interface NewMaterialInput {
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
  whParams: ReadonlyArray<MaterialWhParam>;
  status: MaterialStatus;
}

export interface MaterialRepository {
  insert(input: NewMaterialInput): Promise<Material>;
  update(material: Material): Promise<void>;
  remove(id: number, companyId: number): Promise<void>;
  findById(id: number, companyId: number): Promise<Material | null>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
  listByCompany(
    companyId: number,
    options?: { status?: MaterialStatus; groupId?: number; search?: string },
  ): Promise<ReadonlyArray<Material>>;
}
