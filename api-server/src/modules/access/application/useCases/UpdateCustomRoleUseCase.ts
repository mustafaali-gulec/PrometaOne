/**
 * UpdateCustomRoleUseCase — mevcut bir özel rolün adı/açıklaması ve izin setini günceller.
 *
 * Rol yoksa CustomRoleNotFoundError (→ 404). İsim başka bir role çakışırsa
 * DuplicateRoleNameError (→ 409). İzinler katalog'a karşı doğrulanır (→ 400).
 */
import { toCustomRoleDto, type CustomRoleDto } from '../dto/CustomRoleDto.js';
import { CustomRoleNotFoundError, DuplicateRoleNameError } from '../errors/AccessErrors.js';
import type { AccessRepository } from '../ports/AccessRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface UpdateCustomRoleInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  roleId: number;
  name: string;
  description?: string | null;
  permissions: ReadonlyArray<string>;
}

export class UpdateCustomRoleUseCase {
  constructor(
    private readonly repo: AccessRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: UpdateCustomRoleInput): Promise<CustomRoleDto> {
    const role = await this.repo.findRoleById(input.roleId, input.companyId);
    if (role === null) {
      throw new CustomRoleNotFoundError(input.roleId);
    }

    // İsim değiştiyse çakışma kontrolü
    if (input.name !== role.name) {
      const clash = await this.repo.findRoleByName(input.name, input.companyId);
      if (clash !== null && clash.id !== role.id) {
        throw new DuplicateRoleNameError(input.name);
      }
    }

    const now = this.clock.now();
    // replacePermissions + rename katalog doğrulamasını da yapar (InvalidPermissionError → 400)
    const renamed = role.rename(input.name, input.description ?? null, now);
    const updated = renamed.replacePermissions(input.permissions, now);

    await this.repo.updateRole(updated);

    await this.audit.log({
      at: now,
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'access.role.updated',
      details: {
        id: updated.id,
        name: updated.name,
        permissionCount: updated.permissions.length,
      },
    });

    return toCustomRoleDto(updated);
  }
}
