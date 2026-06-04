/**
 * DeleteCustomRoleUseCase — bir özel rolü siler. İlişkili grant'lar DB'de
 * ON DELETE CASCADE ile temizlenir. Rol yoksa CustomRoleNotFoundError (→ 404).
 */
import { CustomRoleNotFoundError } from '../errors/AccessErrors.js';
import type { AccessRepository } from '../ports/AccessRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface DeleteCustomRoleInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  roleId: number;
}

export class DeleteCustomRoleUseCase {
  constructor(
    private readonly repo: AccessRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: DeleteCustomRoleInput): Promise<void> {
    const role = await this.repo.findRoleById(input.roleId, input.companyId);
    if (role === null) {
      throw new CustomRoleNotFoundError(input.roleId);
    }

    await this.repo.deleteRole(input.roleId, input.companyId);

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'access.role.deleted',
      details: { id: role.id, name: role.name },
    });
  }
}
