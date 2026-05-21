/**
 * UpdateOrgUnitUseCase — bir OrgUnit'in name/code/sortOrder/active alanlarını günceller.
 * parent değişimi MoveOrgUnitUseCase'de — burada yapılmaz.
 */
import { OrgUnit } from '../../domain/entities/OrgUnit.js';
import { OrgUnitCode } from '../../domain/valueObjects/OrgUnitCode.js';
import { toOrgUnitDto, type OrgUnitDto } from '../dto/OrgUnitDto.js';
import { OrgUnitNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { OrgUnitRepository } from '../ports/OrgUnitRepository.js';

export interface UpdateOrgUnitInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
  name?: string;
  code?: string | null;
  sortOrder?: number;
}

export class UpdateOrgUnitUseCase {
  constructor(
    private readonly orgUnits: OrgUnitRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: UpdateOrgUnitInput): Promise<OrgUnitDto> {
    const existing = await this.orgUnits.findById(input.id, input.companyId);
    if (!existing) {
      throw new OrgUnitNotFoundError(input.id);
    }

    let updated: OrgUnit = existing;
    const now = this.clock.now();
    const changes: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== existing.name) {
      updated = updated.rename(input.name, now);
      changes.name = { from: existing.name, to: updated.name };
    }
    if (input.code !== undefined) {
      const newCode = input.code === null ? null : OrgUnitCode.create(input.code);
      const currentCodeValue = existing.code?.value ?? null;
      const newCodeValue = newCode?.value ?? null;
      if (newCodeValue !== currentCodeValue) {
        // OrgUnit entity'sinde code update method yok — yeni instance manuel kur.
        // Bunu temiz tutmak için entity'ye `withCode` ekleyebiliriz; şimdilik
        // toJSON'dan yeniden inşa yöntemi yeterli.
        updated = rebuildOrgUnitWithCode(updated, newCode, now);
        changes.code = { from: currentCodeValue, to: newCodeValue };
      }
    }
    if (input.sortOrder !== undefined && input.sortOrder !== existing.sortOrder) {
      updated = rebuildOrgUnitWithSortOrder(updated, input.sortOrder, now);
      changes.sortOrder = { from: existing.sortOrder, to: input.sortOrder };
    }

    if (updated === existing) {
      // Hiçbir alan değişmedi — no-op
      return toOrgUnitDto(existing);
    }

    await this.orgUnits.update(updated);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.org_unit.updated',
      details: { id: updated.id, changes },
    });

    return toOrgUnitDto(updated);
  }
}

// ---------------------------------------------------------------------------
// Helper: OrgUnit entity'sinde `withCode`/`withSortOrder` method'ları yok;
// `toJSON` ile prop'ları al, yeni instance kur. Saf domain — kötü değil.
// ---------------------------------------------------------------------------

function rebuildOrgUnitWithCode(u: OrgUnit, newCode: OrgUnitCode | null, now: Date): OrgUnit {
  return OrgUnit.create({
    ...u.toJSON(),
    code: newCode,
    updatedAt: now,
  });
}

function rebuildOrgUnitWithSortOrder(u: OrgUnit, newSortOrder: number, now: Date): OrgUnit {
  return OrgUnit.create({
    ...u.toJSON(),
    sortOrder: newSortOrder,
    updatedAt: now,
  });
}
