/**
 * ListRoleGrantsUseCase — şirketin tüm rol atamalarını listeler (read-only).
 */
import { toRoleGrantDto, type RoleGrantDto } from '../dto/RoleGrantDto.js';
import type { AccessRepository } from '../ports/AccessRepository.js';

export interface ListRoleGrantsInput {
  companyId: number;
}

export class ListRoleGrantsUseCase {
  constructor(private readonly repo: AccessRepository) {}

  async execute(input: ListRoleGrantsInput): Promise<RoleGrantDto[]> {
    const grants = await this.repo.listGrantsByCompany(input.companyId);
    return grants.map(toRoleGrantDto);
  }
}
