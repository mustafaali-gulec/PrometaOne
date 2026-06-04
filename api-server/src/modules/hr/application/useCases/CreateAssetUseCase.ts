/**
 * CreateAssetUseCase — yeni varlık (zimmet kalemi) oluşturur (status 'in_stock').
 *
 * Yeni varlık daima havuza (in_stock) eklenir, atanmamış olarak.
 */
import type { AssetType } from '../../domain/valueObjects/AssetType.js';
import { toAssetDto, type AssetDto } from '../dto/AssetDto.js';
import type { AssetRepository } from '../ports/AssetRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface CreateAssetInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  assetType: AssetType;
  name: string;
  brand?: string | null;
  model?: string | null;
  serialNo?: string | null;
  notes?: string | null;
}

export class CreateAssetUseCase {
  constructor(
    private readonly assets: AssetRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: CreateAssetInput): Promise<AssetDto> {
    const created = await this.assets.createAsset({
      companyId: input.companyId,
      assetType: input.assetType,
      name: input.name,
      brand: input.brand ?? null,
      model: input.model ?? null,
      serialNo: input.serialNo ?? null,
      status: 'in_stock',
      assignedEmployeeId: null,
      notes: input.notes ?? null,
    });

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.asset.created',
      details: {
        id: created.id,
        assetType: created.assetType,
        name: created.name,
      },
    });

    return toAssetDto(created);
  }
}
