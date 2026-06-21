/**
 * Reporting modülü value object'leri (enum'lar) — 036_reporting.sql ile aynı.
 */
export const REPORT_MODES = ['sql', 'visual'] as const;
export type ReportMode = (typeof REPORT_MODES)[number];

export const REPORT_VISIBILITIES = ['private', 'company', 'public'] as const;
export type ReportVisibility = (typeof REPORT_VISIBILITIES)[number];

export const REPORT_RUN_STATUSES = ['success', 'error', 'timeout', 'blocked'] as const;
export type ReportRunStatus = (typeof REPORT_RUN_STATUSES)[number];

export function isReportMode(v: unknown): v is ReportMode {
  return typeof v === 'string' && (REPORT_MODES as readonly string[]).includes(v);
}
