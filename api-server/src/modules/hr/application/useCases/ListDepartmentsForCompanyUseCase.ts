/**
 * ListDepartmentsForCompanyUseCase — bir şirketin departman listesini döner
 * (FE'nin sunucu-otoriter org önbelleği bu listeden dolar; yazma-cutover).
 * Default: sadece aktif departmanlar. `includeInactive` / `orgUnitId` opsiyonel.
 */
import { toDepartmentDto, type DepartmentDto } from '../dto/DepartmentDto.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';

export interface ListDepartmentsForCompanyInput {
  companyId: number;
  includeInactive?: boolean;
  orgUnitId?: number | null;
}

export class ListDepartmentsForCompanyUseCase {
  constructor(private readonly departments: DepartmentRepository) {}

  async execute(input: ListDepartmentsForCompanyInput): Promise<ReadonlyArray<DepartmentDto>> {
    const rows = await this.departments.listByCompany(input.companyId, {
      includeInactive: input.includeInactive ?? false,
      ...(input.orgUnitId !== undefined ? { orgUnitId: input.orgUnitId } : {}),
    });
    return rows.map(toDepartmentDto);
  }
}
