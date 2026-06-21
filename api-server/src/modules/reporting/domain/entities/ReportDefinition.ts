/**
 * ReportDefinition — rapor tanımı entity'si (sql | visual).
 *
 * Davranış az; asıl invariant mode ↔ sql_text/query_spec uyumudur
 * (036_reporting.sql CHECK ile aynı). assertValidShape use-case'lerden çağrılır.
 */
import { InvalidReportDefinitionError } from '../errors/ReportingErrors.js';
import type { ParamDef } from '../params/ParamBinder.js';
import type { ReportMode, ReportVisibility } from '../valueObjects/ReportEnums.js';

export interface ReportDefinition {
  id: number;
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
  createdAt: Date;
  updatedAt: Date;
}

/**
 * mode='sql' → sql_text dolu olmalı; mode='visual' → query_spec dolu olmalı.
 * Aksi halde InvalidReportDefinitionError fırlatır.
 */
export function assertValidShape(
  mode: ReportMode,
  sqlText: string | null | undefined,
  querySpec: unknown,
): void {
  if (mode === 'sql') {
    if (typeof sqlText !== 'string' || sqlText.trim().length === 0) {
      throw new InvalidReportDefinitionError("mode='sql' için sql_text zorunlu");
    }
  } else if (mode === 'visual') {
    if (querySpec === null || querySpec === undefined) {
      throw new InvalidReportDefinitionError("mode='visual' için query_spec zorunlu");
    }
  } else {
    throw new InvalidReportDefinitionError(`geçersiz mode: ${String(mode)}`);
  }
}
