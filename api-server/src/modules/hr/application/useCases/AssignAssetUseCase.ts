/**
 * AssignAssetUseCase — bir varlığı bir çalışana zimmetler.
 *
 * Akış:
 *   1. Varlık var mı? (yoksa AssetNotFoundError)
 *   2. Varlık in_stock mı? (değilse AssetNotAvailableError)
 *   3. Çalışan aynı şirkette var mı? (yoksa EmployeeNotFoundError)
 *   4. Asset.assign → status=assigned + assignedEmployeeId
 *   5. Ledger satırı aç (createAssignment)
 *   6. Audit log
 */
import { toAssetDto, type AssetDto } from '../dto/AssetDto.js';
import {
  AssetNotAvailableError,
  AssetNotFoundError,
  EmployeeNotFoundError,
} from '../errors/HrErrors.js';
import type { AssetRepository } from '../ports/AssetRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';

export interface AssignAssetInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  assetId: number;
  employeeId: number;
}

export class AssignAssetUseCase {
  constructor(
    private readonly assets: AssetRepository,
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: AssignAssetInput): Promise<AssetDto> {
    const asset = await this.assets.findAssetById(input.assetId, input.companyId);
    if (!asset) {
      throw new AssetNotFoundError(input.assetId);
    }
    if (!asset.isInStock()) {
      throw new AssetNotAvailableError(input.assetId);
    }

    const employee = await this.employees.findById(input.employeeId, input.companyId);
    if (!employee) {
      throw new EmployeeNotFoundError(input.employeeId);
    }

    const now = this.clock.now();
    const assigned = asset.assign(input.employeeId, now);
    await this.assets.updateAsset(assigned);

    await this.assets.createAssignment({
      companyId: input.companyId,
      assetId: input.assetId,
      employeeId: input.employeeId,
      assignedAt: now,
      assignedByUserId: input.actorUserId,
    });

    await this.audit.log({
      at: now,
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.asset.assigned',
      details: {
        id: assigned.id,
        employeeId: input.employeeId,
      },
    });

    return toAssetDto(assigned);
  }
}
