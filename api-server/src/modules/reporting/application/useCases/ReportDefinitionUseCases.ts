/**
 * ReportDefinition CRUD use-case'leri.
 *
 * Create/Update: mode↔sql/spec invariant (assertValidShape) + mode='sql' ise
 * SqlGuard (kayıtta da güvenlik) + ad bazında benzersizlik.
 */
import type { ReportDefinition } from '../../domain/entities/ReportDefinition.js';
import { assertValidShape } from '../../domain/entities/ReportDefinition.js';
import {
  DuplicateReportNameError,
  ReportDefinitionNotFoundError,
} from '../../domain/errors/ReportingErrors.js';
import type { ParamDef } from '../../domain/params/ParamBinder.js';
import { assertSafeSelect } from '../../domain/sql/SqlGuard.js';
import type { ReportMode, ReportVisibility } from '../../domain/valueObjects/ReportEnums.js';
import type {
  NewReportDefinition,
  ReportDefinitionRepository,
  UpdateReportDefinitionFields,
} from '../ports/ReportDefinitionRepository.js';

export interface CreateReportDefinitionInput {
  companyId: number;
  folderId?: number | null;
  name: string;
  description?: string | null;
  groupLabel?: string | null;
  mode: ReportMode;
  sqlText?: string | null;
  querySpec?: unknown;
  params?: ParamDef[];
  vizConfig?: Record<string, unknown>;
  layoutConfig?: Record<string, unknown>;
  visibility?: ReportVisibility;
  ownerUserId?: number | null;
  createdBy: number | null;
}

export class CreateReportDefinitionUseCase {
  constructor(private readonly repo: ReportDefinitionRepository) {}

  async execute(input: CreateReportDefinitionInput): Promise<ReportDefinition> {
    assertValidShape(input.mode, input.sqlText, input.querySpec);
    if (input.mode === 'sql') {
      assertSafeSelect(input.sqlText as string);
    }
    if (await this.repo.existsByName(input.companyId, input.name)) {
      throw new DuplicateReportNameError(input.name);
    }
    const row: NewReportDefinition = {
      companyId: input.companyId,
      folderId: input.folderId ?? null,
      name: input.name,
      description: input.description ?? null,
      groupLabel: input.groupLabel ?? null,
      mode: input.mode,
      sqlText: input.sqlText ?? null,
      querySpec: input.querySpec ?? null,
      params: input.params ?? [],
      vizConfig: input.vizConfig ?? {},
      layoutConfig: input.layoutConfig ?? {},
      visibility: input.visibility ?? 'private',
      ownerUserId: input.ownerUserId ?? input.createdBy,
      createdBy: input.createdBy,
    };
    return this.repo.insert(row);
  }
}

export interface UpdateReportDefinitionInput extends UpdateReportDefinitionFields {
  reportId: number;
  companyId: number;
}

export class UpdateReportDefinitionUseCase {
  constructor(private readonly repo: ReportDefinitionRepository) {}

  async execute(input: UpdateReportDefinitionInput): Promise<ReportDefinition> {
    const { reportId, companyId, ...fields } = input;
    const existing = await this.repo.findById(reportId, companyId);
    if (!existing) throw new ReportDefinitionNotFoundError(reportId);

    const mode = fields.mode ?? existing.mode;
    const sqlText = fields.sqlText !== undefined ? fields.sqlText : existing.sqlText;
    const querySpec = fields.querySpec !== undefined ? fields.querySpec : existing.querySpec;
    assertValidShape(mode, sqlText, querySpec);
    if (mode === 'sql' && (fields.sqlText !== undefined || fields.mode !== undefined)) {
      assertSafeSelect(sqlText as string);
    }
    if (fields.name !== undefined && fields.name !== existing.name) {
      if (await this.repo.existsByName(companyId, fields.name, reportId)) {
        throw new DuplicateReportNameError(fields.name);
      }
    }
    const updated = await this.repo.update(reportId, companyId, fields);
    if (!updated) throw new ReportDefinitionNotFoundError(reportId);
    return updated;
  }
}

export class DeleteReportDefinitionUseCase {
  constructor(private readonly repo: ReportDefinitionRepository) {}

  async execute(input: { reportId: number; companyId: number }): Promise<{ deleted: true }> {
    const existing = await this.repo.findById(input.reportId, input.companyId);
    if (!existing) throw new ReportDefinitionNotFoundError(input.reportId);
    await this.repo.remove(input.reportId, input.companyId);
    return { deleted: true };
  }
}

export class GetReportDefinitionUseCase {
  constructor(private readonly repo: ReportDefinitionRepository) {}

  async execute(input: { reportId: number; companyId: number }): Promise<ReportDefinition> {
    const def = await this.repo.findById(input.reportId, input.companyId);
    if (!def) throw new ReportDefinitionNotFoundError(input.reportId);
    return def;
  }
}

export class ListReportDefinitionsUseCase {
  constructor(private readonly repo: ReportDefinitionRepository) {}

  async execute(input: { companyId: number }): Promise<ReadonlyArray<ReportDefinition>> {
    return this.repo.listByCompany(input.companyId);
  }
}
