/**
 * CreateOrgUnitUseCase — yeni bir organizasyon birimi oluşturur.
 *
 * Validasyonlar:
 *   - parentId verilirse var olmalı + aynı şirkete ait olmalı
 *   - name boş olamaz (entity invariant'ı)
 *   - code verilirse OrgUnitCode formatına uymalı (entity validate eder)
 */
import { OrgUnitCode } from '../../domain/valueObjects/OrgUnitCode.js';
import { toOrgUnitDto, type OrgUnitDto } from '../dto/OrgUnitDto.js';
import { OrgUnitCompanyMismatchError, OrgUnitNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { OrgUnitRepository } from '../ports/OrgUnitRepository.js';

export interface CreateOrgUnitInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  parentId: number | null;
  name: string;
  code: string | null;
  sortOrder?: number;
}

export class CreateOrgUnitUseCase {
  constructor(
    private readonly orgUnits: OrgUnitRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: CreateOrgUnitInput): Promise<OrgUnitDto> {
    if (input.parentId !== null) {
      const parent = await this.orgUnits.findById(input.parentId, input.companyId);
      if (!parent) {
        // parentId verildi ama bulunamadı — eğer DB'de var ama farklı şirketse
        // OrgUnitCompanyMismatchError, yoksa OrgUnitNotFoundError olabilir.
        // Sade ve güvenli: NotFound (silinmiş veya yanlış şirket).
        throw new OrgUnitNotFoundError(input.parentId);
      }
      if (parent.companyId !== input.companyId) {
        throw new OrgUnitCompanyMismatchError(input.parentId, input.companyId);
      }
    }

    // OrgUnitCode validation (eğer verilirse)
    if (input.code !== null) {
      OrgUnitCode.create(input.code); // throws if invalid
    }

    const created = await this.orgUnits.insert({
      companyId: input.companyId,
      parentId: input.parentId,
      name: input.name,
      code: input.code,
      sortOrder: input.sortOrder ?? 0,
      active: true,
    });

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.org_unit.created',
      details: { id: created.id, name: created.name, parentId: created.parentId },
    });

    return toOrgUnitDto(created);
  }
}
