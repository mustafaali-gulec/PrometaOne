/**
 * ListPermissionOverridesUseCase — şirketin tüm izin override'larını listeler (read-only).
 */
import {
  toPermissionOverrideDto,
  type PermissionOverrideDto,
} from '../dto/PermissionOverrideDto.js';
import type { AccessRepository } from '../ports/AccessRepository.js';

export interface ListPermissionOverridesInput {
  companyId: number;
}

export class ListPermissionOverridesUseCase {
  constructor(private readonly repo: AccessRepository) {}

  async execute(input: ListPermissionOverridesInput): Promise<PermissionOverrideDto[]> {
    const overrides = await this.repo.listOverridesByCompany(input.companyId);
    return overrides.map(toPermissionOverrideDto);
  }
}
