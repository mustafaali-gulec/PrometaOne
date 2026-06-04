/**
 * ReturnAssetUseCase — zimmetli bir varlığı iade alır.
 *
 * Akış:
 *   1. Varlık var mı? (yoksa AssetNotFoundError)
 *   2. Varlık assigned mı? (değilse AssetNotAssignedError)
 *   3. Açık ledger satırı varsa kapat (returnedAt, returnNote)
 *   4. Asset.unassign → status=in_stock + assignedEmployeeId=null
 *   5. Audit log
 */
import { toAssetDto, type AssetDto } from '../dto/AssetDto.js';
import { AssetNotAssignedError, AssetNotFoundError } from '../errors/HrErrors.js';
import type { AssetRepository } from '../ports/AssetRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface ReturnAssetInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  assetId: number;
  returnNote?: string | null;
}

export class ReturnAssetUseCase {
  constructor(
    private readonly assets: AssetRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: ReturnAssetInput): Promise<AssetDto> {
    const asset = await this.assets.findAssetById(input.assetId, input.companyId);
    if (!asset) {
      throw new AssetNotFoundError(input.assetId);
    }
    if (!asset.isAssigned()) {
      throw new AssetNotAssignedError(input.assetId);
    }

    const now = this.clock.now();
    const previousEmployeeId = asset.assignedEmployeeId;

    // Açık atama varsa kapat (ledger izi).
    const open = await this.assets.findOpenAssignmentForAsset(input.assetId, input.companyId);
    if (open) {
      const closed = open.close(now, input.actorUserId, input.returnNote ?? null);
      await this.assets.closeAssignment(closed);
    }

    const returned = asset.unassign(now);
    await this.assets.updateAsset(returned);

    await this.audit.log({
      at: now,
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.asset.returned',
      details: {
        id: returned.id,
        employeeId: previousEmployeeId,
      },
    });

    return toAssetDto(returned);
  }
}
