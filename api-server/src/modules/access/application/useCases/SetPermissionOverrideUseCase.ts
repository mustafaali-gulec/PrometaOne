/**
 * SetPermissionOverrideUseCase — bir kullanıcı için tekil `resource.action`
 * allow/deny override'ı upsert eder. (company_id, username, resource, action)
 * UNIQUE olduğundan tekrarlı çağrı mevcut kaydı günceller.
 *
 * resource.action katalog'a karşı doğrulanır (geçersizse InvalidPermissionError → 400).
 */
import { parsePermission } from '../../domain/valueObjects/Permission.js';
import {
  toPermissionOverrideDto,
  type PermissionOverrideDto,
} from '../dto/PermissionOverrideDto.js';
import type { AccessRepository } from '../ports/AccessRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface SetPermissionOverrideInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expiresAt?: Date | null;
}

export class SetPermissionOverrideUseCase {
  constructor(
    private readonly repo: AccessRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: SetPermissionOverrideInput): Promise<PermissionOverrideDto> {
    // resource.action katalog'a karşı doğrula (InvalidPermissionError → 400)
    parsePermission(`${input.resource}.${input.action}`);

    const saved = await this.repo.upsertOverride({
      companyId: input.companyId,
      username: input.username,
      resource: input.resource,
      action: input.action,
      allow: input.allow,
      expiresAt: input.expiresAt ?? null,
    });

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'access.override.created',
      details: {
        id: saved.id,
        username: saved.username,
        resource: saved.resource,
        action: saved.action,
        allow: saved.allow,
      },
    });

    return toPermissionOverrideDto(saved);
  }
}
