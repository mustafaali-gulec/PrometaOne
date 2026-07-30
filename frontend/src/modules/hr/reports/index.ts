/**
 * İK raporları — tek giriş noktası.
 *
 * İlk rapor: **Bordro Dökümü** (`payrollDokumReport`). Rapor çekirdeği saf;
 * ekran/Excel/PDF çıktısı aynı "sayfa planından" üretilir.
 */
export {
  buildPayrollDokumModel,
  buildPayrollDokumPlan,
  DEFAULT_PAYROLL_DOKUM_COLUMNS,
  fmtDokumMoney,
  isoToExcelSerial,
  isoToTrDisplay,
  mergeMapsOf,
  PAYROLL_DOKUM_COLUMNS,
  payrollDokumFileName,
  planToHtml,
  planToWorkbook,
  planToWorksheet,
  SUMMARY_PAYROLL_DOKUM_COLUMNS,
} from './payrollDokumReport';
export type {
  PayrollDokumCell,
  PayrollDokumColumnDef,
  PayrollDokumCompany,
  PayrollDokumDayBreakdown,
  PayrollDokumInput,
  PayrollDokumLayout,
  PayrollDokumMissingDayMode,
  PayrollDokumModel,
  PayrollDokumOptions,
  PayrollDokumPageBreak,
  PayrollDokumPlan,
  PayrollDokumPlanRow,
  PayrollDokumSheetPlan,
  PayrollDokumSourceRow,
  PayrollDokumTablePlacement,
  PayrollDokumWageBasis,
  PayrollEngineResult,
} from './payrollDokumReport';

export { dokumMonthName, dokumT, PAYROLL_DOKUM_LABELS } from './payrollDokumI18n';
export type {
  PayrollDokumLabelKey,
  PayrollDokumLabels,
  PayrollDokumLang,
} from './payrollDokumI18n';
