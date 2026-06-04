/**
 * DeleteRoleGrantUseCase — bir rol atamasını siler. Yoksa RoleGrantNotFoundError (→ 404).
 */
import { RoleGrantNotFoundError } from '../errors/AccessErrors.js';
import type { AccessRepository } from '../ports/AccessRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface DeleteRoleGrantInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  grantId: number;
}

export class DeleteRoleGrantUseCase {
  constructor(
    private readonly repo: AccessRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: DeleteRoleGrantInput): Promise<void> {
    const grant = await this.repo.findGrantById(input.grantId, input.companyId);
    if (grant === null) {
      throw new RoleGrantNotFoundError(input.grantId);
    }

    await this.repo.deleteGrant(input.grantId, input.companyId);

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'access.grant.deleted',
      details: {
        id: grant.id,
        roleId: grant.roleId,
        subjectType: grant.subjectType,
        subjectId: grant.subjectId,
      },
    });
  }
}
