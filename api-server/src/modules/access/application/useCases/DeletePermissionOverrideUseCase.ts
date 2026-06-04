/**
 * DeletePermissionOverrideUseCase — bir izin override'ını siler.
 * Yoksa OverrideNotFoundError (→ 404).
 */
import { OverrideNotFoundError } from '../errors/AccessErrors.js';
import type { AccessRepository } from '../ports/AccessRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface DeletePermissionOverrideInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  overrideId: number;
}

export class DeletePermissionOverrideUseCase {
  constructor(
    private readonly repo: AccessRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: DeletePermissionOverrideInput): Promise<void> {
    const override = await this.repo.findOverrideById(input.overrideId, input.companyId);
    if (override === null) {
      throw new OverrideNotFoundError(input.overrideId);
    }

    await this.repo.deleteOverride(input.overrideId, input.companyId);

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'access.override.deleted',
      details: {
        id: override.id,
        username: override.username,
        resource: override.resource,
        action: override.action,
      },
    });
  }
}
