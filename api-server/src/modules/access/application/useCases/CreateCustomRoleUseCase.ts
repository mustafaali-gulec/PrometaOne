/**
 * CreateCustomRoleUseCase — şirkete özel yeni bir rol oluşturur.
 *
 * İzinler katalog'a karşı doğrulanır (geçersizse InvalidPermissionError → 400).
 * Aynı şirkette aynı isimde rol varsa DuplicateRoleNameError (→ 409).
 */
import { parsePermission } from '../../domain/valueObjects/Permission.js';
import { toCustomRoleDto, type CustomRoleDto } from '../dto/CustomRoleDto.js';
import { DuplicateRoleNameError } from '../errors/AccessErrors.js';
import type { AccessRepository } from '../ports/AccessRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface CreateCustomRoleInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  name: string;
  description?: string | null;
  permissions: ReadonlyArray<string>;
}

export class CreateCustomRoleUseCase {
  constructor(
    private readonly repo: AccessRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: CreateCustomRoleInput): Promise<CustomRoleDto> {
    // İzinleri katalog'a karşı doğrula (geçersizse InvalidPermissionError fırlatır)
    for (const p of input.permissions) {
      parsePermission(p);
    }

    const existing = await this.repo.findRoleByName(input.name, input.companyId);
    if (existing !== null) {
      throw new DuplicateRoleNameError(input.name);
    }

    const created = await this.repo.createRole({
      companyId: input.companyId,
      name: input.name,
      description: input.description ?? null,
      permissions: input.permissions,
    });

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'access.role.created',
      details: {
        id: created.id,
        name: created.name,
        permissionCount: created.permissions.length,
      },
    });

    return toCustomRoleDto(created);
  }
}
