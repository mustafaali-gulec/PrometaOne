/**
 * CreateRoleGrantUseCase — bir özel rolü bir özneye atar.
 *
 * Rol yoksa CustomRoleNotFoundError (→ 404). Geçerlilik penceresi tutarsızsa
 * domain entity Error fırlatır (→ 400 InvalidPermissionInput haricinde generic).
 */
import type { SubjectType } from '../../domain/valueObjects/SubjectType.js';
import { toRoleGrantDto, type RoleGrantDto } from '../dto/RoleGrantDto.js';
import { CustomRoleNotFoundError } from '../errors/AccessErrors.js';
import type { AccessRepository } from '../ports/AccessRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface CreateRoleGrantInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  roleId: number;
  subjectType: SubjectType;
  subjectId: string;
  cascade?: boolean;
  validFrom?: Date | null;
  validUntil?: Date | null;
}

export class CreateRoleGrantUseCase {
  constructor(
    private readonly repo: AccessRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: CreateRoleGrantInput): Promise<RoleGrantDto> {
    const role = await this.repo.findRoleById(input.roleId, input.companyId);
    if (role === null) {
      throw new CustomRoleNotFoundError(input.roleId);
    }

    const created = await this.repo.createGrant({
      companyId: input.companyId,
      roleId: input.roleId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      cascade: input.cascade ?? true,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
    });

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'access.grant.created',
      details: {
        id: created.id,
        roleId: created.roleId,
        subjectType: created.subjectType,
        subjectId: created.subjectId,
      },
    });

    return toRoleGrantDto(created);
  }
}
