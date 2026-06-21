/**
 * Reporting DTO'ları — API sınırında dönen şekiller (camelCase, tarih ISO).
 */
import type { ReportDefinition } from '../../domain/entities/ReportDefinition.js';
import type { ReportRun } from '../ports/ReportRunRepository.js';
import type { ScheduledReport } from '../ports/ScheduledReportRepository.js';

export interface ReportDefinitionDto {
  id: number;
  companyId: number;
  folderId: number | null;
  name: string;
  description: string | null;
  groupLabel: string | null;
  mode: string;
  sqlText: string | null;
  querySpec: unknown;
  params: unknown[];
  vizConfig: Record<string, unknown>;
  layoutConfig: Record<string, unknown>;
  visibility: string;
  ownerUserId: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export function toReportDefinitionDto(d: ReportDefinition): ReportDefinitionDto {
  return {
    id: d.id,
    companyId: d.companyId,
    folderId: d.folderId,
    name: d.name,
    description: d.description,
    groupLabel: d.groupLabel,
    mode: d.mode,
    sqlText: d.sqlText,
    querySpec: d.querySpec,
    params: d.params,
    vizConfig: d.vizConfig,
    layoutConfig: d.layoutConfig,
    visibility: d.visibility,
    ownerUserId: d.ownerUserId,
    createdBy: d.createdBy,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export interface ReportRunDto {
  id: number;
  reportId: number | null;
  mode: string;
  status: string;
  rowCount: number | null;
  durationMs: number | null;
  truncated: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  runBy: number | null;
  createdAt: string;
}

export interface ScheduledReportDto {
  id: number;
  reportId: number;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  recipients: string[];
  paramValues: Record<string, unknown>;
  format: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  createdAt: string;
}

export function toScheduledReportDto(s: ScheduledReport): ScheduledReportDto {
  return {
    id: s.id,
    reportId: s.reportId,
    frequency: s.frequency,
    dayOfWeek: s.dayOfWeek,
    dayOfMonth: s.dayOfMonth,
    timeOfDay: s.timeOfDay,
    recipients: s.recipients,
    paramValues: s.paramValues,
    format: s.format,
    enabled: s.enabled,
    lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
    lastStatus: s.lastStatus,
    createdAt: s.createdAt.toISOString(),
  };
}

export function toReportRunDto(r: ReportRun): ReportRunDto {
  return {
    id: r.id,
    reportId: r.reportId,
    mode: r.mode,
    status: r.status,
    rowCount: r.rowCount,
    durationMs: r.durationMs,
    truncated: r.truncated,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    runBy: r.runBy,
    createdAt: r.createdAt.toISOString(),
  };
}
