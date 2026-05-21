/**
 * ListOrgTreeForCompanyUseCase — bir şirketin OrgUnit ağacını döner.
 * Default: sadece aktif birimler. `includeInactive` opsiyonel.
 *
 * OrgTreeBuilder kullanarak flat liste → nested ağaç dönüşümü yapar.
 */
import { OrgTreeBuilder } from '../../domain/services/OrgTreeBuilder.js';
import { toOrgTreeNodeDto, type OrgTreeNodeDto } from '../dto/OrgTreeNodeDto.js';
import type { OrgUnitRepository } from '../ports/OrgUnitRepository.js';

export interface ListOrgTreeForCompanyInput {
  companyId: number;
  includeInactive?: boolean;
}

export class ListOrgTreeForCompanyUseCase {
  constructor(private readonly orgUnits: OrgUnitRepository) {}

  async execute(input: ListOrgTreeForCompanyInput): Promise<ReadonlyArray<OrgTreeNodeDto>> {
    const units = await this.orgUnits.listByCompany(input.companyId, {
      includeInactive: input.includeInactive ?? false,
    });
    const tree = OrgTreeBuilder.build(units);
    return tree.map(toOrgTreeNodeDto);
  }
}
