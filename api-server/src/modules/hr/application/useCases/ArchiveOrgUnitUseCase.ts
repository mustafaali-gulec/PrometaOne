/**
 * ArchiveOrgUnitUseCase — bir OrgUnit'i arşivler (active=false).
 * Alt birimi varsa OrgUnitHasChildrenError fırlatır (önce alt birimleri taşı/arşivle).
 */
import { toOrgUnitDto, type OrgUnitDto } from '../dto/OrgUnitDto.js';
import { OrgUnitHasChildrenError, OrgUnitNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { OrgUnitRepository } from '../ports/OrgUnitRepository.js';

export interface ArchiveOrgUnitInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
}

export class ArchiveOrgUnitUseCase {
  constructor(
    private readonly orgUnits: OrgUnitRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: ArchiveOrgUnitInput): Promise<OrgUnitDto> {
    const existing = await this.orgUnits.findById(input.id, input.companyId);
    if (!existing) {
      throw new OrgUnitNotFoundError(input.id);
    }

    const hasChildren = await this.orgUnits.hasChildren(existing.id, input.companyId);
    if (hasChildren) {
      throw new OrgUnitHasChildrenError(existing.id);
    }

    const archived = existing.archive(this.clock.now());
    if (archived === existing) {
      // zaten arşivli
      return toOrgUnitDto(existing);
    }

    await this.orgUnits.update(archived);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.org_unit.archived',
      details: { id: existing.id, name: existing.name },
    });

    return toOrgUnitDto(archived);
  }
}
