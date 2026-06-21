/**
 * ReportDefinitionRepository portu — rapor tanımı kalıcılığı.
 * Concrete: infrastructure/persistence/PgReportDefinitionRepository.ts
 */
import type { ReportDefinition } from '../../domain/entities/ReportDefinition.js';
import type { ParamDef } from '../../domain/params/ParamBinder.js';
import type { ReportMode, ReportVisibility } from '../../domain/valueObjects/ReportEnums.js';

export interface NewReportDefinition {
  companyId: number;
  folderId: number | null;
  name: string;
  description: string | null;
  groupLabel: string | null;
  mode: ReportMode;
  sqlText: string | null;
  querySpec: unknown;
  params: ParamDef[];
  vizConfig: Record<string, unknown>;
  layoutConfig: Record<string, unknown>;
  visibility: ReportVisibility;
  ownerUserId: number | null;
  createdBy: number | null;
}

export type UpdateReportDefinitionFields = Partial<
  Omit<NewReportDefinition, 'companyId' | 'createdBy'>
>;

export interface ReportDefinitionRepository {
  insert(input: NewReportDefinition): Promise<ReportDefinition>;
  update(
    id: number,
    companyId: number,
    fields: UpdateReportDefinitionFields,
  ): Promise<ReportDefinition | null>;
  remove(id: number, companyId: number): Promise<void>;
  findById(id: number, companyId: number): Promise<ReportDefinition | null>;
  listByCompany(companyId: number): Promise<ReadonlyArray<ReportDefinition>>;
  existsByName(companyId: number, name: string, excludeId?: number): Promise<boolean>;
}
