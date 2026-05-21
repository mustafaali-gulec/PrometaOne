/**
 * OrgTreeNodeDto — `GET /v1/hr/org-tree` response için ağaç düğümü.
 * OrgTreeBuilder çıktısını DTO'ya dönüştürür.
 */
import type { OrgUnitTreeNode } from '../../domain/services/OrgTreeBuilder.js';

import { toOrgUnitDto } from './OrgUnitDto.js';
import type { OrgUnitDto } from './OrgUnitDto.js';

export interface OrgTreeNodeDto {
  unit: OrgUnitDto;
  children: ReadonlyArray<OrgTreeNodeDto>;
}

export function toOrgTreeNodeDto(node: OrgUnitTreeNode): OrgTreeNodeDto {
  return {
    unit: toOrgUnitDto(node.unit),
    children: node.children.map(toOrgTreeNodeDto),
  };
}
