/**
 * ListCustomRolesUseCase — şirketin tüm özel rollerini listeler (read-only).
 */
import { toCustomRoleDto, type CustomRoleDto } from '../dto/CustomRoleDto.js';
import type { AccessRepository } from '../ports/AccessRepository.js';

export interface ListCustomRolesInput {
  companyId: number;
}

export class ListCustomRolesUseCase {
  constructor(private readonly repo: AccessRepository) {}

  async execute(input: ListCustomRolesInput): Promise<CustomRoleDto[]> {
    const roles = await this.repo.listRolesByCompany(input.companyId);
    return roles.map(toCustomRoleDto);
  }
}
