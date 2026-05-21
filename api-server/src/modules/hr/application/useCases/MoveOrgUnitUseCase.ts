/**
 * MoveOrgUnitUseCase — bir OrgUnit'in parent'ını değiştirir.
 *
 * Cycle guard: yeni parent'a giderken bu node'a ulaşılabiliyor mu?
 *   - Domain'de OrgTreeBuilder.assertNoCycles benzer mantığı uygular
 *   - Burada yalnızca aktif (silinmemiş) node'lar üzerinden in-memory walk
 *
 * Aynı parent verilirse no-op.
 * parentId = null → root yapma.
 */
import { OrgTreeBuilder } from '../../domain/services/OrgTreeBuilder.js';
import { toOrgUnitDto, type OrgUnitDto } from '../dto/OrgUnitDto.js';
import { OrgCycleDetectedError, OrgUnitNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { OrgUnitRepository } from '../ports/OrgUnitRepository.js';

export interface MoveOrgUnitInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
  newParentId: number | null;
}

export class MoveOrgUnitUseCase {
  constructor(
    private readonly orgUnits: OrgUnitRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: MoveOrgUnitInput): Promise<OrgUnitDto> {
    const existing = await this.orgUnits.findById(input.id, input.companyId);
    if (!existing) {
      throw new OrgUnitNotFoundError(input.id);
    }
    if (input.newParentId === existing.parentId) {
      return toOrgUnitDto(existing);
    }

    if (input.newParentId !== null) {
      // Yeni parent var olmalı
      const newParent = await this.orgUnits.findById(input.newParentId, input.companyId);
      if (!newParent) {
        throw new OrgUnitNotFoundError(input.newParentId);
      }

      // Cycle check: newParent'tan başlayıp yukarı çıkarken `existing.id`'ye
      // ulaşıyor muyuz? Ulaşıyorsak cycle olur.
      const all = await this.orgUnits.listByCompany(input.companyId, {
        includeInactive: true,
      });
      const descendants = OrgTreeBuilder.descendantsOf(existing.id, all, {
        includeSelf: true,
      });
      if (descendants.some((u) => u.id === input.newParentId)) {
        throw new OrgCycleDetectedError(existing.id, input.newParentId);
      }
    }

    const moved = existing.setParent(input.newParentId, this.clock.now());
    await this.orgUnits.update(moved);

    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.org_unit.moved',
      details: {
        id: existing.id,
        fromParentId: existing.parentId,
        toParentId: input.newParentId,
      },
    });

    return toOrgUnitDto(moved);
  }
}
