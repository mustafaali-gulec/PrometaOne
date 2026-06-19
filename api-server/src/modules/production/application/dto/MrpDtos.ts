/**
 * MRP DTO'ları — `/mrp/run` wire kontratı (frontend'in POST ettiği gövde +
 * dönen plan). MrpCalculator girdi/çıktı tipleri burada REST sınırına yansır.
 */
import type {
  InventoryLevel,
  MrpBomInput,
  MrpDemandItem,
  MrpMaterialInput,
  MrpParams,
  MrpResult,
  MrpWorkCenterInput,
} from '../../domain/services/MrpCalculator.js';
import type { MrpRunRecord } from '../ports/MrpRunRepository.js';

/** POST /mrp/run istek gövdesi (companyId hariç — o ayrı validate edilir). */
export interface RunMrpRequestDto {
  companyId: number;
  params: MrpParams;
  materials: MrpMaterialInput[];
  inventory: InventoryLevel[];
  boms: MrpBomInput[];
  workCenters: MrpWorkCenterInput[];
  demand: MrpDemandItem[];
}

/** POST /mrp/run yanıtı. */
export interface RunMrpResponseDto extends MrpResult {
  runAt: string;
  no: string;
}

export interface MrpRunSummaryDto {
  id: number;
  no: string;
  runAt: string;
  params: MrpParams;
  result: MrpResult;
  createdAt: string;
}

export function toMrpRunSummaryDto(r: MrpRunRecord): MrpRunSummaryDto {
  return {
    id: r.id,
    no: r.no,
    runAt: r.runAt.toISOString(),
    params: r.params,
    result: r.result,
    createdAt: r.createdAt.toISOString(),
  };
}
