/**
 * BORDRO DÖKÜMÜ — rapor çekirdeği (saf; DOM/app-state bağımlılığı yok).
 *
 * Tek bir "sayfa planı" (`PayrollDokumPlan`) üretir; ekran önizlemesi, Excel (xlsx)
 * ve yazdırma (PDF) çıktısı AYNI plandan türetilir — böylece üç çıktı birebir aynı
 * yerleşimi gösterir.
 *
 * Yerleşim, referans bordro dökümüyle birebir aynıdır:
 *   satır 1-7   : kurum/işyeri/dönem başlık bloğu (Filtre = Göster)
 *   satır 8-9   : boş ayırıcı
 *   satır 10    : sütun başlıkları (varsayılan 25 sütun)
 *   ardından    : her personel için 1 ana satır + N açıklama satırı
 *                 (Avans… / Normal Gün… / Fazla Mesai… / Net Kazanç…)
 *   sonda       : "Toplamlar:" satırı (SUM formülleriyle) + "Net Kazanç: …"
 *   opsiyonel   : imza blokları, İCMAL tablosu, KAZANÇ/KESİNTİ TOPLAMLARI tablosu
 *
 * Tutarlar rapor para biriminde yazılır (TRY dışı seçimde `fxRate`'e bölünür).
 */
import * as XLSX from 'xlsx';

import { dokumMonthName, dokumT, type PayrollDokumLabelKey } from './payrollDokumI18n';

/* ===================================================================== */
/* Girdi tipleri — bordro motorunun (calculatePayroll) çıktısı            */
/* ===================================================================== */

export interface PayrollEngineComponentRef {
  calc?: { method?: string; hourType?: string; dayType?: string } | null;
}

export interface PayrollEngineIncome {
  code?: string;
  name?: string;
  category?: string;
  amount?: number;
  _component?: PayrollEngineComponentRef | null;
}

export interface PayrollEngineDeduction {
  code?: string;
  name?: string;
  category?: string;
  amount?: number;
}

export interface PayrollEngineResult {
  period?: { year?: number; month?: number; sgkDays?: number; workdaysPerMonth?: number } | null;
  incomes?: PayrollEngineIncome[] | null;
  deductions?: PayrollEngineDeduction[] | null;
  bases?: {
    sgkBase?: number;
    sgkBaseCapped?: number;
    gvBase?: number;
    gvCumulative?: number;
    dvBase?: number;
  } | null;
  taxes?: {
    sgkEmployee?: number;
    unempEmployee?: number;
    sgkEmployer?: number;
    unempEmployer?: number;
    incomeTax?: number;
    incomeTaxBeforeExemption?: number;
    incomeTaxExempt?: number;
    stampDuty?: number;
    stampDutyExempt?: number;
  } | null;
  totals?: {
    gross?: number;
    net?: number;
    totalDeductions?: number;
    employerCostWithIncentives?: number;
  } | null;
}

/** Puantajdan gelen gün/saat kırılımı (açıklama satırları için). */
export interface PayrollDokumDayBreakdown {
  workedDays?: number;
  weekendDays?: number;
  sickDays?: number;
  annualLeaveDays?: number;
  unpaidLeaveDays?: number;
  absentDays?: number;
  overtimeNormalHours?: number;
  overtimeWeekendHours?: number;
  overtimeHolidayHours?: number;
}

/**
 * Rapora girecek bir personel satırının kaynağı. Org birim / departman / puantaj
 * çözümlemesi çağıran tarafta (app-state'i bilen katmanda) yapılır; bu modül saf kalır.
 */
export interface PayrollDokumSourceRow {
  employeeId: string;
  fullName: string;
  tcNo: string;
  startDate: string | null;
  exitDate: string | null;
  /** SGK kanun numarası (ör. "05510" / "00000"). */
  lawNo: string;
  /** SGK işyeri kodu — "SSK Grup" filtresi ve icmal gruplaması için. */
  sgkWorkplaceCode: string;
  workplaceName: string;
  departmentName: string;
  jobTitleName: string;
  iban: string;
  /** "gross" → açıklama satırında B, "net" → N eki. */
  salaryType: 'gross' | 'net';
  /** Sözleşmedeki anlaşılan ücret (net tipte net, brüt tipte brüt aylık). */
  agreedSalary: number;
  days: PayrollDokumDayBreakdown;
  result: PayrollEngineResult;
}

export interface PayrollDokumCompany {
  name: string;
  address: string;
  taxOffice: string;
  taxNumber: string;
  mersisNo: string;
  sgkWorkplaceNo: string;
  sgkBranch: string;
}

export type PayrollDokumWageBasis = 'total' | 'gross' | 'hourly';
export type PayrollDokumLayout = 'detailed' | 'summary';
export type PayrollDokumMissingDayMode = 'single' | 'separate';
export type PayrollDokumTablePlacement = 'separate' | 'same';
export type PayrollDokumPageBreak = 'none' | 'per_employee';

export interface PayrollDokumOptions {
  lang: string;
  /** Görünecek sütunlar (sıra korunur). Boş verilirse varsayılan 25 sütun. */
  columns?: string[];
  layout: PayrollDokumLayout;
  wageBasis: PayrollDokumWageBasis;
  /** Kurum/dönem başlık bloğu (referans dökümde her zaman açıktır). */
  showFilterBlock: boolean;
  /** "Filtre = Göster": seçilen parametreleri tek satırda başlığa ekler. */
  showFilterCriteria: boolean;
  showTotals: boolean;
  showIcmal: boolean;
  showComponentTotals: boolean;
  showPreparerSign: boolean;
  showCheckerSign: boolean;
  showApproverSign: boolean;
  showDate: boolean;
  showPageNumbers: boolean;
  showFooter: boolean;
  missingDayMode: PayrollDokumMissingDayMode;
  tablePlacement: PayrollDokumTablePlacement;
  pageBreak: PayrollDokumPageBreak;
  /** 0 = otomatik (sayfa başına personel sınırı yok). Yazdırma çıktısında uygulanır. */
  employeesPerPage: number;
  currency: string;
  /** 1 birim döviz = kaç TL. TRY için 1. */
  fxRate: number;
  rateBasis: 'buying' | 'selling';
  rateDate: string | null;
  fontName: string;
  /** Rapor tarihi (ISO) — saf kalması için çağıran verir. */
  generatedAt: string;
}

export interface PayrollDokumInput {
  company: PayrollDokumCompany;
  period: { year: number; month: number };
  /** Başlık bloğunda gösterilecek filtre etiketleri. */
  filterLabels: { workplace: string; department: string };
  /** "Filtre = Göster" satırında listelenecek seçili parametreler. */
  criteria?: string;
  rows: PayrollDokumSourceRow[];
}

/* ===================================================================== */
/* Sütun tanımları                                                       */
/* ===================================================================== */

export type PayrollDokumCellKind = 'text' | 'money' | 'days' | 'date' | 'blank';

export interface PayrollDokumColumnDef {
  key: string;
  labelKey: PayrollDokumLabelKey;
  kind: PayrollDokumCellKind;
  /** Excel sütun genişliği (karakter). */
  width: number;
  /** Toplamlar satırında SUM alınır mı? */
  sum: boolean;
  align: 'left' | 'right' | 'center';
  /** Varsayılan sütun setinde açık mı? */
  defaultOn: boolean;
}

/** Referans dökümdeki 25 sütun + isteğe bağlı ek sütunlar. */
export const PAYROLL_DOKUM_COLUMNS: readonly PayrollDokumColumnDef[] = [
  {
    key: 'seq',
    labelKey: 'cSeq',
    kind: 'text',
    width: 3,
    sum: false,
    align: 'left',
    defaultOn: true,
  },
  {
    key: 'name',
    labelKey: 'cName',
    kind: 'text',
    width: 18,
    sum: false,
    align: 'left',
    defaultOn: true,
  },
  {
    key: 'tcNo',
    labelKey: 'cTcNo',
    kind: 'text',
    width: 12,
    sum: false,
    align: 'left',
    defaultOn: true,
  },
  {
    key: 'missingDays',
    labelKey: 'cMissingDays',
    kind: 'text',
    width: 10,
    sum: false,
    align: 'left',
    defaultOn: true,
  },
  {
    key: 'startDate',
    labelKey: 'cStartDate',
    kind: 'date',
    width: 10,
    sum: false,
    align: 'center',
    defaultOn: true,
  },
  {
    key: 'exitDate',
    labelKey: 'cExitDate',
    kind: 'date',
    width: 10,
    sum: false,
    align: 'center',
    defaultOn: true,
  },
  {
    key: 'lawNo',
    labelKey: 'cLawNo',
    kind: 'text',
    width: 6,
    sum: false,
    align: 'center',
    defaultOn: true,
  },
  {
    key: 'wageBasis',
    labelKey: 'cWageBasis',
    kind: 'text',
    width: 9,
    sum: false,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'totalDays',
    labelKey: 'cTotalDays',
    kind: 'days',
    width: 6,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'leaveDays',
    labelKey: 'cLeaveDays',
    kind: 'days',
    width: 6,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'normalEarning',
    labelKey: 'cNormalEarning',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'agi',
    labelKey: 'cAgi',
    kind: 'money',
    width: 5,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'totalEarning',
    labelKey: 'cTotalEarning',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'otherEarning',
    labelKey: 'cOtherEarning',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'sgkBase',
    labelKey: 'cSgkBase',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'sgkEmployer',
    labelKey: 'cSgkEmployer',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'sgkEmployee',
    labelKey: 'cSgkEmployee',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'gvBase',
    labelKey: 'cGvBase',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'gvCumulative',
    labelKey: 'cGvCumulative',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'incomeTax',
    labelKey: 'cIncomeTax',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'remainingTax',
    labelKey: 'cRemainingTax',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'stampDuty',
    labelKey: 'cStampDuty',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'specialDeduction',
    labelKey: 'cSpecialDeduction',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'netPaid',
    labelKey: 'cNetPaid',
    kind: 'money',
    width: 9,
    sum: true,
    align: 'right',
    defaultOn: true,
  },
  {
    key: 'signature',
    labelKey: 'cSignature',
    kind: 'blank',
    width: 7,
    sum: false,
    align: 'left',
    defaultOn: true,
  },
  // --- Varsayılan kapalı ek sütunlar ---
  {
    key: 'unempEmployee',
    labelKey: 'cUnempEmployee',
    kind: 'money',
    width: 10,
    sum: true,
    align: 'right',
    defaultOn: false,
  },
  {
    key: 'unempEmployer',
    labelKey: 'cUnempEmployer',
    kind: 'money',
    width: 11,
    sum: true,
    align: 'right',
    defaultOn: false,
  },
  {
    key: 'grossSalary',
    labelKey: 'cGrossSalary',
    kind: 'money',
    width: 10,
    sum: true,
    align: 'right',
    defaultOn: false,
  },
  {
    key: 'gvExempt',
    labelKey: 'cGvExempt',
    kind: 'money',
    width: 12,
    sum: true,
    align: 'right',
    defaultOn: false,
  },
  {
    key: 'dvExempt',
    labelKey: 'cDvExempt',
    kind: 'money',
    width: 12,
    sum: true,
    align: 'right',
    defaultOn: false,
  },
  {
    key: 'employerCost',
    labelKey: 'cEmployerCost',
    kind: 'money',
    width: 12,
    sum: true,
    align: 'right',
    defaultOn: false,
  },
  {
    key: 'workedDays',
    labelKey: 'cWorkedDays',
    kind: 'days',
    width: 8,
    sum: true,
    align: 'right',
    defaultOn: false,
  },
  {
    key: 'overtimeHours',
    labelKey: 'cOvertimeHours',
    kind: 'days',
    width: 8,
    sum: true,
    align: 'right',
    defaultOn: false,
  },
  {
    key: 'department',
    labelKey: 'cDepartment',
    kind: 'text',
    width: 16,
    sum: false,
    align: 'left',
    defaultOn: false,
  },
  {
    key: 'workplace',
    labelKey: 'cWorkplace',
    kind: 'text',
    width: 16,
    sum: false,
    align: 'left',
    defaultOn: false,
  },
  {
    key: 'jobTitle',
    labelKey: 'cJobTitle',
    kind: 'text',
    width: 16,
    sum: false,
    align: 'left',
    defaultOn: false,
  },
  {
    key: 'iban',
    labelKey: 'cIban',
    kind: 'text',
    width: 26,
    sum: false,
    align: 'left',
    defaultOn: false,
  },
];

/** Varsayılan (referans dökümle birebir) sütun anahtarları. */
export const DEFAULT_PAYROLL_DOKUM_COLUMNS: readonly string[] = PAYROLL_DOKUM_COLUMNS.filter(
  (c) => c.defaultOn,
).map((c) => c.key);

/** "Özet Bordro" yerleşiminde kullanılan daraltılmış sütun seti. */
export const SUMMARY_PAYROLL_DOKUM_COLUMNS: readonly string[] = [
  'seq',
  'name',
  'tcNo',
  'totalDays',
  'totalEarning',
  'sgkBase',
  'sgkEmployee',
  'incomeTax',
  'stampDuty',
  'specialDeduction',
  'netPaid',
];

const COLUMN_BY_KEY: Record<string, PayrollDokumColumnDef> = Object.fromEntries(
  PAYROLL_DOKUM_COLUMNS.map((c) => [c.key, c]),
);

/* ===================================================================== */
/* Model                                                                 */
/* ===================================================================== */

export interface PayrollDokumRow {
  seq: number;
  employeeId: string;
  values: Record<string, string | number | null>;
  detailLines: string[];
}

export interface PayrollDokumIcmalRow {
  group: string;
  lawNo: string;
  headcount: number;
  totalDays: number;
  totalEarning: number;
  sgkBase: number;
  sgkEmployee: number;
  sgkEmployer: number;
  incomeTax: number;
  stampDuty: number;
  netPaid: number;
}

export interface PayrollDokumComponentTotal {
  kind: 'earning' | 'deduction';
  code: string;
  name: string;
  count: number;
  total: number;
}

export interface PayrollDokumModel {
  company: PayrollDokumCompany;
  period: { year: number; month: number };
  filterLabels: { workplace: string; department: string };
  criteria: string;
  columns: PayrollDokumColumnDef[];
  rows: PayrollDokumRow[];
  totals: Record<string, number>;
  totalNet: number;
  icmal: PayrollDokumIcmalRow[];
  componentTotals: PayrollDokumComponentTotal[];
  currency: string;
  fxRate: number;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const LOCALE_BY_LANG: Record<string, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  de: 'de-DE',
  ar: 'en-US',
};

/** Rapor dilinin para biçimi (2 ondalık, binlik ayraçlı). */
export function fmtDokumMoney(value: number, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? 'tr-TR';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(num(value)));
}

/** ISO tarih → Excel seri numarası (1899-12-30 tabanlı). */
export function isoToExcelSerial(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const ms = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 86400000) + 25569;
}

/** ISO tarih → "dd.MM.yyyy" (ekran/HTML gösterimi). */
export function isoToTrDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

const sumBy = <T>(list: readonly T[], pick: (item: T) => number): number =>
  list.reduce((acc, item) => acc + num(pick(item)), 0);

/** Bir motor sonucundaki normal (kök) ücret bileşeni. */
function normalEarningOf(result: PayrollEngineResult): number {
  const incomes = result.incomes ?? [];
  const brut = incomes.find((i) => i.code === 'BRUT');
  if (brut) return num(brut.amount);
  // BRUT bileşeni yoksa: brüt toplam eksi diğer kazançlar (yani hepsi "diğer" sayılır)
  return 0;
}

function agiOf(result: PayrollEngineResult): number {
  const incomes = result.incomes ?? [];
  const agi = incomes.find((i) => i.code === 'AGI' || i.code === 'AGİ');
  return agi ? num(agi.amount) : 0;
}

function specialDeductionOf(result: PayrollEngineResult): number {
  return sumBy(
    (result.deductions ?? []).filter((d) => d.category === 'special_deduction'),
    (d) => num(d.amount),
  );
}

/** Motor sonucundan "eksik gün" (30 - SGK günü). */
function missingDaysOf(row: PayrollDokumSourceRow): number {
  const sgkDays = num(row.result.period?.sgkDays ?? 30);
  return Math.max(0, round2(30 - sgkDays));
}

/** Eksik gün nedeni (ücretsiz izin / devamsızlık / rapor) — kısa metin. */
function missingReasonOf(row: PayrollDokumSourceRow, lang: string): string {
  const d = row.days;
  const parts: string[] = [];
  if (num(d.unpaidLeaveDays) > 0)
    parts.push(`${dokumT('rowUnpaid', lang)} ${num(d.unpaidLeaveDays)}G`);
  if (num(d.absentDays) > 0)
    parts.push(`${dokumT('cMissingDays', lang).trim()} ${num(d.absentDays)}G`);
  return parts.join(' + ');
}

function hoursForIncome(
  income: PayrollEngineIncome,
  days: PayrollDokumDayBreakdown,
): number | null {
  const calc = income._component?.calc;
  if (!calc || calc.method !== 'per_hour') return null;
  switch (calc.hourType) {
    case 'overtime_hours':
      return num(days.overtimeNormalHours);
    case 'weekend_hours':
      return num(days.overtimeWeekendHours);
    case 'holiday_hours':
      return num(days.overtimeHolidayHours);
    default:
      return null;
  }
}

/**
 * Personel açıklama satırlarını üretir (referans dökümdeki sıra):
 *   1) Özel kesintiler  → "Avans: 5.000,00 N"
 *   2) Gün kırılımı     → "Normal Gün (30G): 45.000,00 N  Rapor (3G): 0,00"
 *   3) Diğer kazançlar  → "Fazla Mesai (20S): 5.625,00 N  Yemek: 4.000,00 N"
 *   4) Net              → "Net Kazanç: 49.625,00"
 */
function buildDetailLines(
  row: PayrollDokumSourceRow,
  opts: PayrollDokumOptions,
  toReportCurrency: (n: number) => number,
): string[] {
  const lang = opts.lang;
  const money = (n: number) => fmtDokumMoney(toReportCurrency(n), lang);
  // N/B eki YALNIZ kök ücret satırına konur: sözleşmedeki ücretin net mi brüt mü
  // anlaşıldığını yalnız personel kartı bilir. Yan hak / kesinti bileşenlerinde
  // böyle bir bilgi olmadığı için ek yazılmaz (yanlış işaret koymamak için).
  const suffix = row.salaryType === 'net' ? ' N' : ' B';
  const lines: string[] = [];

  // 1) Özel kesintiler
  const specials = (row.result.deductions ?? []).filter(
    (d) => d.category === 'special_deduction' && num(d.amount) > 0,
  );
  if (specials.length > 0) {
    lines.push(
      specials.map((d) => `${d.name || d.code || ''}: ${money(num(d.amount))}`).join('  '),
    );
  }

  // 2) Gün kırılımı — "Normal Gün (30G): <anlaşılan ücret>"
  const sgkDays = num(row.result.period?.sgkDays ?? 30);
  const agreed = row.agreedSalary > 0 ? row.agreedSalary : normalEarningOf(row.result);
  const dayParts: string[] = [
    `${dokumT('rowNormalDays', lang)} (${sgkDays}G): ${money(agreed)}${suffix}`,
  ];
  const d = row.days;
  if (num(d.weekendDays) > 0)
    dayParts.push(`${dokumT('rowWeekend', lang)} (${num(d.weekendDays)}G)`);
  if (num(d.annualLeaveDays) > 0)
    dayParts.push(`${dokumT('rowAnnualLeave', lang)} (${num(d.annualLeaveDays)}G)`);
  if (num(d.sickDays) > 0)
    dayParts.push(`${dokumT('rowSick', lang)} (${num(d.sickDays)}G): ${money(0)}`);
  if (num(d.unpaidLeaveDays) > 0)
    dayParts.push(`${dokumT('rowUnpaid', lang)} (${num(d.unpaidLeaveDays)}G): ${money(0)}`);
  lines.push(dayParts.join('  '));

  // 2b) Eksik gün nedeni ayrı satırda isteniyorsa
  if (opts.missingDayMode === 'separate') {
    const reason = missingReasonOf(row, lang);
    if (reason) lines.push(`${dokumT('rowMissingReason', lang)}: ${reason}`);
  }

  // 3) Diğer kazançlar
  const others = (row.result.incomes ?? []).filter((i) => i.code !== 'BRUT' && num(i.amount) !== 0);
  if (others.length > 0) {
    lines.push(
      others
        .map((i) => {
          const hrs = hoursForIncome(i, row.days);
          const unit = hrs != null && hrs > 0 ? ` (${hrs}S)` : '';
          return `${i.name || i.code || ''}${unit}: ${money(num(i.amount))}`;
        })
        .join('  '),
    );
  }

  // 4) Net kazanç
  lines.push(`${dokumT('rowNetEarning', lang)}: ${money(num(row.result.totals?.net))}`);
  return lines;
}

/** Kaynak satırları rapor modeline dönüştürür (filtreleme çağıranda yapılmıştır). */
export function buildPayrollDokumModel(
  input: PayrollDokumInput,
  opts: PayrollDokumOptions,
): PayrollDokumModel {
  const rate = num(opts.fxRate) > 0 ? num(opts.fxRate) : 1;
  const toReportCurrency = (n: number) => round2(num(n) / rate);

  const requested =
    opts.columns && opts.columns.length > 0
      ? opts.columns
      : opts.layout === 'summary'
        ? SUMMARY_PAYROLL_DOKUM_COLUMNS
        : DEFAULT_PAYROLL_DOKUM_COLUMNS;
  const columns = requested
    .map((k) => COLUMN_BY_KEY[k])
    .filter((c): c is PayrollDokumColumnDef => c != null);

  const rows: PayrollDokumRow[] = input.rows.map((src, idx) => {
    const r = src.result;
    const sgkDays = num(r.period?.sgkDays ?? 30);
    const gross = num(r.totals?.gross);
    const normal = normalEarningOf(r);
    const other = round2(gross - normal);
    const missing = missingDaysOf(src);
    const reason = missingReasonOf(src, opts.lang);
    const wage =
      opts.wageBasis === 'gross'
        ? num(src.agreedSalary) / 30
        : opts.wageBasis === 'hourly'
          ? sgkDays > 0
            ? gross / sgkDays / 7.5
            : 0
          : sgkDays > 0
            ? gross / sgkDays
            : 0;
    const wageUnit = opts.wageBasis === 'hourly' ? 'S' : 'G';
    const overtime =
      num(src.days.overtimeNormalHours) +
      num(src.days.overtimeWeekendHours) +
      num(src.days.overtimeHolidayHours);

    const values: Record<string, string | number | null> = {
      seq: idx + 1,
      name: src.fullName,
      tcNo: src.tcNo,
      missingDays:
        missing > 0
          ? opts.missingDayMode === 'single' && reason
            ? `${missing} — ${reason}`
            : String(missing)
          : '',
      startDate: src.startDate,
      exitDate: src.exitDate,
      lawNo: src.lawNo,
      wageBasis: `${fmtDokumMoney(toReportCurrency(wage), opts.lang)}${wageUnit}`,
      totalDays: sgkDays,
      leaveDays: num(src.days.annualLeaveDays),
      normalEarning: toReportCurrency(normal),
      agi: toReportCurrency(agiOf(r)),
      totalEarning: toReportCurrency(gross),
      otherEarning: toReportCurrency(other),
      sgkBase: toReportCurrency(num(r.bases?.sgkBaseCapped)),
      sgkEmployer: toReportCurrency(num(r.taxes?.sgkEmployer) + num(r.taxes?.unempEmployer)),
      sgkEmployee: toReportCurrency(num(r.taxes?.sgkEmployee) + num(r.taxes?.unempEmployee)),
      gvBase: toReportCurrency(num(r.bases?.gvBase)),
      gvCumulative: toReportCurrency(num(r.bases?.gvCumulative)),
      incomeTax: toReportCurrency(num(r.taxes?.incomeTax)),
      remainingTax: toReportCurrency(num(r.taxes?.incomeTax)),
      stampDuty: toReportCurrency(num(r.taxes?.stampDuty)),
      specialDeduction: toReportCurrency(specialDeductionOf(r)),
      netPaid: toReportCurrency(num(r.totals?.net)),
      signature: '',
      unempEmployee: toReportCurrency(num(r.taxes?.unempEmployee)),
      unempEmployer: toReportCurrency(num(r.taxes?.unempEmployer)),
      grossSalary: toReportCurrency(num(src.agreedSalary)),
      gvExempt: toReportCurrency(num(r.taxes?.incomeTaxExempt)),
      dvExempt: toReportCurrency(num(r.taxes?.stampDutyExempt)),
      employerCost: toReportCurrency(num(r.totals?.employerCostWithIncentives)),
      workedDays: num(src.days.workedDays),
      overtimeHours: overtime,
      department: src.departmentName,
      workplace: src.workplaceName,
      jobTitle: src.jobTitleName,
      iban: src.iban,
    };

    return {
      seq: idx + 1,
      employeeId: src.employeeId,
      values,
      detailLines: opts.layout === 'detailed' ? buildDetailLines(src, opts, toReportCurrency) : [],
    };
  });

  // Toplamlar — SUM alınan her sütun için
  const totals: Record<string, number> = {};
  for (const col of columns) {
    if (!col.sum) continue;
    totals[col.key] = round2(sumBy(rows, (r) => num(r.values[col.key])));
  }
  const totalNet = round2(sumBy(input.rows, (r) => toReportCurrency(num(r.result.totals?.net))));

  // İcmal — işyeri + kanun no kırılımı
  const icmalMap = new Map<string, PayrollDokumIcmalRow>();
  for (const src of input.rows) {
    const group = src.workplaceName || src.sgkWorkplaceCode || '—';
    const key = `${group}|${src.lawNo}`;
    const acc = icmalMap.get(key) ?? {
      group,
      lawNo: src.lawNo,
      headcount: 0,
      totalDays: 0,
      totalEarning: 0,
      sgkBase: 0,
      sgkEmployee: 0,
      sgkEmployer: 0,
      incomeTax: 0,
      stampDuty: 0,
      netPaid: 0,
    };
    const r = src.result;
    acc.headcount += 1;
    acc.totalDays += num(r.period?.sgkDays ?? 30);
    acc.totalEarning += toReportCurrency(num(r.totals?.gross));
    acc.sgkBase += toReportCurrency(num(r.bases?.sgkBaseCapped));
    acc.sgkEmployee += toReportCurrency(num(r.taxes?.sgkEmployee) + num(r.taxes?.unempEmployee));
    acc.sgkEmployer += toReportCurrency(num(r.taxes?.sgkEmployer) + num(r.taxes?.unempEmployer));
    acc.incomeTax += toReportCurrency(num(r.taxes?.incomeTax));
    acc.stampDuty += toReportCurrency(num(r.taxes?.stampDuty));
    acc.netPaid += toReportCurrency(num(r.totals?.net));
    icmalMap.set(key, acc);
  }
  const icmal = [...icmalMap.values()].map((g) => ({
    ...g,
    totalDays: round2(g.totalDays),
    totalEarning: round2(g.totalEarning),
    sgkBase: round2(g.sgkBase),
    sgkEmployee: round2(g.sgkEmployee),
    sgkEmployer: round2(g.sgkEmployer),
    incomeTax: round2(g.incomeTax),
    stampDuty: round2(g.stampDuty),
    netPaid: round2(g.netPaid),
  }));

  // Kazanç / kesinti bileşen toplamları
  const compMap = new Map<string, PayrollDokumComponentTotal>();
  const bump = (kind: 'earning' | 'deduction', code: string, name: string, amount: number) => {
    if (amount === 0) return;
    const key = `${kind}|${code}`;
    const acc = compMap.get(key) ?? { kind, code, name, count: 0, total: 0 };
    acc.count += 1;
    acc.total += toReportCurrency(amount);
    compMap.set(key, acc);
  };
  for (const src of input.rows) {
    for (const i of src.result.incomes ?? [])
      bump('earning', i.code || '—', i.name || i.code || '—', num(i.amount));
    for (const dd of src.result.deductions ?? [])
      bump('deduction', dd.code || '—', dd.name || dd.code || '—', num(dd.amount));
  }
  const componentTotals = [...compMap.values()]
    .map((c) => ({ ...c, total: round2(c.total) }))
    .sort((a, b) => (a.kind === b.kind ? b.total - a.total : a.kind === 'earning' ? -1 : 1));

  return {
    company: input.company,
    period: input.period,
    filterLabels: input.filterLabels,
    criteria: input.criteria ?? '',
    columns,
    rows,
    totals,
    totalNet,
    icmal,
    componentTotals,
    currency: opts.currency,
    fxRate: rate,
  };
}

/* ===================================================================== */
/* Sayfa planı — ekran / Excel / yazdırma için tek kaynak                 */
/* ===================================================================== */

export type PayrollDokumRowRole =
  | 'meta'
  | 'spacer'
  | 'thead'
  | 'data'
  | 'detail'
  | 'total'
  | 'section'
  | 'sign'
  | 'footer';

export interface PayrollDokumCell {
  /** Değer — sayı, metin veya boş. */
  v: string | number | null;
  /** Excel hücre tipi. */
  t?: 's' | 'n';
  /** Excel biçim kodu (ör. "#,##0.00"). */
  z?: string;
  /** Excel formülü (ör. "SUM(K11:K79)"). */
  f?: string;
  /** Ekran/HTML gösterim metni (sayılar için biçimlenmiş). */
  w?: string;
  align?: 'left' | 'right' | 'center';
  bold?: boolean;
}

export interface PayrollDokumPlanRow {
  role: PayrollDokumRowRole;
  cells: (PayrollDokumCell | null)[];
  /** Yazdırma çıktısında bu satırdan ÖNCE sayfa sonu. */
  pageBreakBefore?: boolean;
}

export interface PayrollDokumSheetPlan {
  name: string;
  colCount: number;
  cols: { wch: number }[];
  rows: PayrollDokumPlanRow[];
  merges: XLSX.Range[];
}

export interface PayrollDokumPlan {
  title: string;
  fileName: string;
  fontName: string;
  sheets: PayrollDokumSheetPlan[];
  /** Yazdırma altbilgisi (Alt Bilgi Göster = Göster ise dolu). */
  footer: string | null;
  showPageNumbers: boolean;
}

const MONEY_FMT = '#,##0.00';
const DAYS_FMT = '###';
const DATE_FMT = 'dd.MM.yyyy';

const txt = (v: string, extra: Partial<PayrollDokumCell> = {}): PayrollDokumCell => ({
  v,
  t: 's',
  w: v,
  align: 'left',
  ...extra,
});

const moneyCell = (
  v: number,
  lang: string,
  extra: Partial<PayrollDokumCell> = {},
): PayrollDokumCell => ({
  v: round2(v),
  t: 'n',
  z: MONEY_FMT,
  w: fmtDokumMoney(v, lang),
  align: 'right',
  ...extra,
});

const daysCell = (v: number, extra: Partial<PayrollDokumCell> = {}): PayrollDokumCell => ({
  v: round2(v),
  t: 'n',
  z: DAYS_FMT,
  w: String(round2(v)),
  align: 'right',
  ...extra,
});

/** Bir veri hücresini sütun tipine göre üretir. */
function cellFor(
  col: PayrollDokumColumnDef,
  raw: string | number | null | undefined,
  lang: string,
): PayrollDokumCell | null {
  if (col.kind === 'blank') return null;
  if (col.kind === 'date') {
    const serial = isoToExcelSerial(typeof raw === 'string' ? raw : null);
    if (serial == null) return null;
    return { v: serial, t: 'n', z: DATE_FMT, w: isoToTrDisplay(String(raw)), align: 'center' };
  }
  if (col.kind === 'money') return moneyCell(num(raw), lang, { align: col.align });
  if (col.kind === 'days') return daysCell(num(raw), { align: col.align });
  const s = raw == null ? '' : String(raw);
  if (s === '') return null;
  return txt(s, { align: col.align });
}

/** Tüm satırı kaplayan birleştirilmiş metin satırı. */
function fullWidthRow(
  role: PayrollDokumRowRole,
  colCount: number,
  text: string,
  startCol: number,
  bold: boolean,
): PayrollDokumPlanRow {
  const cells: (PayrollDokumCell | null)[] = Array.from({ length: colCount }, () => null);
  cells[startCol] = txt(text, { bold });
  return { role, cells };
}

/**
 * Model → sayfa planı. `merges` Excel aralıkları; HTML/ekran render'ı da aynı
 * birleştirmeleri colspan olarak kullanır.
 */
export function buildPayrollDokumPlan(
  model: PayrollDokumModel,
  opts: PayrollDokumOptions,
): PayrollDokumPlan {
  const lang = opts.lang;
  const cols = model.columns;
  const colCount = Math.max(1, cols.length);
  const rows: PayrollDokumPlanRow[] = [];
  const merges: XLSX.Range[] = [];
  const push = (r: PayrollDokumPlanRow) => {
    rows.push(r);
    return rows.length - 1;
  };
  const emptyRow = (): (PayrollDokumCell | null)[] => Array.from({ length: colCount }, () => null);

  // ---- Başlık bloğu (Filtre = Göster) --------------------------------
  const lastCol = colCount - 1;
  const leftValEnd = Math.min(7, lastCol);
  const rightLabelCol = colCount > 12 ? 8 : -1;
  const rightValCol = colCount > 12 ? 11 : -1;

  const metaRow = (
    labelKey: PayrollDokumLabelKey,
    value: string,
    rightKey?: PayrollDokumLabelKey,
    rightValue?: string,
  ) => {
    const cells = emptyRow();
    cells[0] = txt(dokumT(labelKey, lang), { bold: true });
    if (leftValEnd >= 2) cells[2] = txt(value);
    else if (lastCol >= 1) cells[1] = txt(value);
    if (rightKey && rightLabelCol > 0) {
      cells[rightLabelCol] = txt(dokumT(rightKey, lang), { bold: true });
      if (rightValCol > 0) cells[rightValCol] = txt(rightValue ?? '');
    }
    const r = push({ role: 'meta', cells });
    if (lastCol >= 1) merges.push({ s: { r, c: 0 }, e: { r, c: 1 } });
    if (leftValEnd >= 3) merges.push({ s: { r, c: 2 }, e: { r, c: leftValEnd } });
    if (rightKey && rightLabelCol > 0) {
      merges.push({ s: { r, c: rightLabelCol }, e: { r, c: 10 } });
      merges.push({ s: { r, c: 11 }, e: { r, c: lastCol } });
    }
  };

  if (opts.showFilterBlock) {
    metaRow('hCompany', model.company.name, 'hAddress', model.company.address);
    metaRow('hWorkplace', model.filterLabels.workplace);
    metaRow('hDepartment', model.filterLabels.department);
    metaRow('hSgkNo', model.company.sgkWorkplaceNo);
    metaRow('hSgkBranch', model.company.sgkBranch);
    metaRow(
      'hTaxOffice',
      model.company.taxOffice,
      'hPeriod',
      `${dokumMonthName(model.period.month, lang)} / ${model.period.year}`,
    );
    metaRow('hTaxNumber', model.company.taxNumber, 'hMersis', model.company.mersisNo);
    if (model.currency !== 'TRY') {
      metaRow(
        'hCurrency',
        `${model.currency} — ${dokumT(opts.rateBasis === 'selling' ? 'optSelling' : 'optBuying', lang)} ${fmtDokumMoney(model.fxRate, lang)}` +
          (opts.rateDate ? ` (${isoToTrDisplay(opts.rateDate)})` : ''),
      );
    }
    if (opts.showDate) metaRow('hReportDate', isoToTrDisplay(opts.generatedAt));
    if (opts.showFilterCriteria && model.criteria) {
      const cells = emptyRow();
      cells[0] = txt(`${dokumT('pFilterBlock', lang)}: ${model.criteria}`);
      const r = push({ role: 'meta', cells });
      if (lastCol >= 1) merges.push({ s: { r, c: 0 }, e: { r, c: lastCol } });
    }
    // İki boş ayırıcı satır (referans dökümle aynı)
    for (let i = 0; i < 2; i++) {
      const r = push({ role: 'spacer', cells: emptyRow() });
      if (lastCol >= 1) merges.push({ s: { r, c: 0 }, e: { r, c: lastCol } });
    }
  } else {
    const cells = emptyRow();
    cells[0] = txt(dokumT('dokumTitle', lang), { bold: true });
    const r = push({ role: 'meta', cells });
    if (lastCol >= 1) merges.push({ s: { r, c: 0 }, e: { r, c: lastCol } });
    push({ role: 'spacer', cells: emptyRow() });
  }

  // ---- Sütun başlıkları ----------------------------------------------
  const headerRowIdx = push({
    role: 'thead',
    cells: cols.map((c) => txt(dokumT(c.labelKey, lang), { bold: true, align: c.align })),
  });
  const firstDataRow = headerRowIdx + 1;

  // ---- Personel satırları --------------------------------------------
  let placedOnPage = 0;
  model.rows.forEach((row, i) => {
    const breakBefore =
      i > 0 &&
      (opts.pageBreak === 'per_employee' ||
        (opts.employeesPerPage > 0 && placedOnPage >= opts.employeesPerPage));
    if (breakBefore) placedOnPage = 0;
    placedOnPage += 1;

    push({
      role: 'data',
      cells: cols.map((c) => cellFor(c, row.values[c.key], lang)),
      ...(breakBefore ? { pageBreakBefore: true } : {}),
    });
    for (const line of row.detailLines) {
      const r = push(fullWidthRow('detail', colCount, line, Math.min(1, lastCol), false));
      if (lastCol >= 2) merges.push({ s: { r, c: 1 }, e: { r, c: Math.max(1, lastCol - 1) } });
    }
  });

  const lastDataRow = rows.length - 1;

  // ---- Toplamlar ------------------------------------------------------
  if (opts.showTotals && model.rows.length > 0) {
    const cells = emptyRow();
    cells[Math.min(1, lastCol)] = txt(dokumT('rowTotals', lang), { bold: true });
    cols.forEach((c, idx) => {
      if (!c.sum) return;
      const colLetter = XLSX.utils.encode_col(idx);
      cells[idx] = {
        v: round2(num(model.totals[c.key])),
        t: 'n',
        z: c.kind === 'days' ? DAYS_FMT : MONEY_FMT,
        f: `SUM(${colLetter}${firstDataRow + 1}:${colLetter}${lastDataRow + 1})`,
        w:
          c.kind === 'days'
            ? String(round2(num(model.totals[c.key])))
            : fmtDokumMoney(num(model.totals[c.key]), lang),
        align: 'right',
        bold: true,
      };
    });
    push({ role: 'total', cells });

    const r = push(
      fullWidthRow(
        'total',
        colCount,
        `${dokumT('rowNetEarning', lang)}: ${fmtDokumMoney(model.totalNet, lang)}`,
        Math.min(1, lastCol),
        true,
      ),
    );
    if (lastCol >= 1) merges.push({ s: { r, c: 1 }, e: { r, c: lastCol } });
  }

  // ---- İmza blokları ---------------------------------------------------
  const signs: PayrollDokumLabelKey[] = [];
  if (opts.showPreparerSign) signs.push('signPreparer');
  if (opts.showCheckerSign) signs.push('signChecker');
  if (opts.showApproverSign) signs.push('signApprover');
  if (signs.length > 0) {
    push({ role: 'spacer', cells: emptyRow() });
    const cells = emptyRow();
    const step = Math.max(1, Math.floor(colCount / signs.length));
    signs.forEach((k, i) => {
      const c = Math.min(lastCol, i * step);
      cells[c] = txt(`${dokumT(k, lang)}: ______________________`, { bold: true });
    });
    push({ role: 'sign', cells });
  }

  // ---- İcmal + Kazanç/Kesinti tabloları --------------------------------
  const extraSheets: PayrollDokumSheetPlan[] = [];
  const icmalPlan = opts.showIcmal ? buildIcmalRows(model, lang) : null;
  const compPlan = opts.showComponentTotals ? buildComponentRows(model, lang) : null;

  const appendInline = (block: {
    cols: number;
    rows: PayrollDokumPlanRow[];
    merges: XLSX.Range[];
  }) => {
    push({ role: 'spacer', cells: emptyRow() });
    const offset = rows.length;
    for (const r of block.rows) {
      const cells = emptyRow();
      r.cells.forEach((c, i) => {
        if (i < colCount) cells[i] = c;
      });
      push({ role: r.role, cells });
    }
    for (const m of block.merges) {
      merges.push({
        s: { r: m.s.r + offset, c: Math.min(m.s.c, lastCol) },
        e: { r: m.e.r + offset, c: Math.min(m.e.c, lastCol) },
      });
    }
  };

  for (const block of [icmalPlan, compPlan]) {
    if (!block) continue;
    if (opts.tablePlacement === 'same') appendInline(block);
    else
      extraSheets.push({
        name: block.name,
        colCount: block.cols,
        cols: block.widths,
        rows: block.rows,
        merges: block.merges,
      });
  }

  // ---- Altbilgi --------------------------------------------------------
  if (opts.showFooter) {
    push({ role: 'spacer', cells: emptyRow() });
    const r = push(
      fullWidthRow(
        'footer',
        colCount,
        `${dokumT('footerNote', lang)} · ${model.company.name} · ${isoToTrDisplay(opts.generatedAt)}`,
        0,
        false,
      ),
    );
    if (lastCol >= 1) merges.push({ s: { r, c: 0 }, e: { r, c: lastCol } });
  }

  const main: PayrollDokumSheetPlan = {
    name: `${dokumMonthName(model.period.month, lang)} ${model.period.year}`.slice(0, 31),
    colCount,
    cols: cols.map((c) => ({ wch: c.width })),
    rows,
    merges,
  };

  return {
    title: `${model.company.name} — ${dokumT('dokumTitle', lang)} — ${dokumMonthName(model.period.month, lang)} / ${model.period.year}`,
    fileName: payrollDokumFileName(model),
    fontName: opts.fontName,
    sheets: [main, ...extraSheets],
    footer: opts.showFooter ? `${dokumT('footerNote', lang)} · ${model.company.name}` : null,
    showPageNumbers: opts.showPageNumbers,
  };
}

interface BlockPlan {
  name: string;
  cols: number;
  widths: { wch: number }[];
  rows: PayrollDokumPlanRow[];
  merges: XLSX.Range[];
}

function buildIcmalRows(model: PayrollDokumModel, lang: string): BlockPlan {
  const headers: PayrollDokumLabelKey[] = [
    'icmalGroup',
    'cLawNo',
    'icmalHeadcount',
    'cTotalDays',
    'cTotalEarning',
    'cSgkBase',
    'cSgkEmployee',
    'cSgkEmployer',
    'cIncomeTax',
    'cStampDuty',
    'cNetPaid',
  ];
  const widths = [
    { wch: 22 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 11 },
    { wch: 12 },
  ];
  const rows: PayrollDokumPlanRow[] = [];
  const merges: XLSX.Range[] = [];
  rows.push({ role: 'section', cells: [txt(dokumT('icmalTitle', lang), { bold: true })] });
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } });
  rows.push({
    role: 'thead',
    cells: headers.map((h, i) =>
      txt(dokumT(h, lang), { bold: true, align: i < 2 ? 'left' : 'right' }),
    ),
  });
  for (const g of model.icmal) {
    rows.push({
      role: 'data',
      cells: [
        txt(g.group),
        txt(g.lawNo, { align: 'center' }),
        daysCell(g.headcount),
        daysCell(g.totalDays),
        moneyCell(g.totalEarning, lang),
        moneyCell(g.sgkBase, lang),
        moneyCell(g.sgkEmployee, lang),
        moneyCell(g.sgkEmployer, lang),
        moneyCell(g.incomeTax, lang),
        moneyCell(g.stampDuty, lang),
        moneyCell(g.netPaid, lang),
      ],
    });
  }
  rows.push({
    role: 'total',
    cells: [
      txt(dokumT('rowTotals', lang), { bold: true }),
      null,
      daysCell(
        sumBy(model.icmal, (g) => g.headcount),
        { bold: true },
      ),
      daysCell(
        sumBy(model.icmal, (g) => g.totalDays),
        { bold: true },
      ),
      moneyCell(
        sumBy(model.icmal, (g) => g.totalEarning),
        lang,
        { bold: true },
      ),
      moneyCell(
        sumBy(model.icmal, (g) => g.sgkBase),
        lang,
        { bold: true },
      ),
      moneyCell(
        sumBy(model.icmal, (g) => g.sgkEmployee),
        lang,
        { bold: true },
      ),
      moneyCell(
        sumBy(model.icmal, (g) => g.sgkEmployer),
        lang,
        { bold: true },
      ),
      moneyCell(
        sumBy(model.icmal, (g) => g.incomeTax),
        lang,
        { bold: true },
      ),
      moneyCell(
        sumBy(model.icmal, (g) => g.stampDuty),
        lang,
        { bold: true },
      ),
      moneyCell(
        sumBy(model.icmal, (g) => g.netPaid),
        lang,
        { bold: true },
      ),
    ],
  });
  return {
    name: dokumT('icmalTitle', lang).slice(0, 31),
    cols: headers.length,
    widths,
    rows,
    merges,
  };
}

function buildComponentRows(model: PayrollDokumModel, lang: string): BlockPlan {
  const headers: PayrollDokumLabelKey[] = ['ctKind', 'ctCode', 'ctName', 'ctCount', 'ctTotal'];
  const widths = [{ wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 14 }];
  const rows: PayrollDokumPlanRow[] = [];
  const merges: XLSX.Range[] = [];
  rows.push({
    role: 'section',
    cells: [txt(dokumT('componentTotalsTitle', lang), { bold: true })],
  });
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } });
  rows.push({
    role: 'thead',
    cells: headers.map((h, i) =>
      txt(dokumT(h, lang), { bold: true, align: i >= 3 ? 'right' : 'left' }),
    ),
  });
  for (const c of model.componentTotals) {
    rows.push({
      role: 'data',
      cells: [
        txt(dokumT(c.kind === 'earning' ? 'ctEarning' : 'ctDeduction', lang)),
        txt(c.code),
        txt(c.name),
        daysCell(c.count),
        moneyCell(c.total, lang),
      ],
    });
  }
  const earn = sumBy(
    model.componentTotals.filter((c) => c.kind === 'earning'),
    (c) => c.total,
  );
  const ded = sumBy(
    model.componentTotals.filter((c) => c.kind === 'deduction'),
    (c) => c.total,
  );
  rows.push({
    role: 'total',
    cells: [
      txt(dokumT('ctEarning', lang), { bold: true }),
      null,
      null,
      null,
      moneyCell(earn, lang, { bold: true }),
    ],
  });
  rows.push({
    role: 'total',
    cells: [
      txt(dokumT('ctDeduction', lang), { bold: true }),
      null,
      null,
      null,
      moneyCell(ded, lang, { bold: true }),
    ],
  });
  return {
    name: dokumT('pComponentTotals', lang).slice(0, 31),
    cols: headers.length,
    widths,
    rows,
    merges,
  };
}

/** Dosya adı — "bordro-dokumu-2026-06.xlsx". */
export function payrollDokumFileName(model: PayrollDokumModel): string {
  const mm = String(model.period.month).padStart(2, '0');
  return `bordro-dokumu-${model.period.year}-${mm}`;
}

/* ===================================================================== */
/* Çıktılar                                                              */
/* ===================================================================== */

/** Bir sayfa planını SheetJS worksheet'ine çevirir. */
export function planToWorksheet(sheet: PayrollDokumSheetPlan): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  sheet.rows.forEach((row, r) => {
    row.cells.forEach((cell, c) => {
      if (!cell) return;
      if (cell.v == null || cell.v === '') {
        if (cell.f == null) return;
      }
      const addr = XLSX.utils.encode_cell({ r, c });
      const out: XLSX.CellObject =
        cell.t === 'n' ? { t: 'n', v: num(cell.v) } : { t: 's', v: String(cell.v ?? '') };
      if (cell.f != null) out.f = cell.f;
      if (cell.z != null) out.z = cell.z;
      ws[addr] = out;
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(0, sheet.rows.length - 1), c: Math.max(0, sheet.colCount - 1) },
  });
  if (sheet.merges.length > 0) ws['!merges'] = sheet.merges;
  if (sheet.cols.length > 0) ws['!cols'] = sheet.cols;
  return ws;
}

/** Plan → xlsx workbook. */
export function planToWorkbook(plan: PayrollDokumPlan): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const sheet of plan.sheets) {
    let name = (sheet.name || 'Rapor').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Rapor';
    let i = 2;
    while (used.has(name)) name = `${name.slice(0, 28)}_${i++}`;
    used.add(name);
    XLSX.utils.book_append_sheet(wb, planToWorksheet(sheet), name);
  }
  return wb;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Birleştirme aralıklarından "atlanacak hücre" ve "anchor span" haritaları. */
export function mergeMapsOf(sheet: PayrollDokumSheetPlan): {
  skip: Set<string>;
  span: Map<string, { colSpan: number; rowSpan: number }>;
} {
  const skip = new Set<string>();
  const span = new Map<string, { colSpan: number; rowSpan: number }>();
  for (const m of sheet.merges) {
    const colSpan = m.e.c - m.s.c + 1;
    const rowSpan = m.e.r - m.s.r + 1;
    if (colSpan <= 1 && rowSpan <= 1) continue;
    span.set(`${m.s.r}:${m.s.c}`, { colSpan, rowSpan });
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        skip.add(`${r}:${c}`);
      }
    }
  }
  return { skip, span };
}

/** Plan → yazdırılabilir/gösterilebilir HTML tablosu. */
export function planToHtml(plan: PayrollDokumPlan): string {
  const tables = plan.sheets.map((sheet) => {
    const { skip, span } = mergeMapsOf(sheet);
    const body = sheet.rows.map((row, r) => {
      const tds: string[] = [];
      for (let c = 0; c < sheet.colCount; c++) {
        if (skip.has(`${r}:${c}`)) continue;
        const cell = row.cells[c] ?? null;
        const sp = span.get(`${r}:${c}`);
        const attrs: string[] = [];
        if (sp && sp.colSpan > 1) attrs.push(`colspan="${sp.colSpan}"`);
        if (sp && sp.rowSpan > 1) attrs.push(`rowspan="${sp.rowSpan}"`);
        const cls = [`r-${row.role}`];
        if (cell?.align === 'right') cls.push('ta-r');
        else if (cell?.align === 'center') cls.push('ta-c');
        if (cell?.bold) cls.push('b');
        attrs.push(`class="${cls.join(' ')}"`);
        const text = cell ? escapeHtml(cell.w ?? String(cell.v ?? '')) : '';
        tds.push(`<td ${attrs.join(' ')}>${text || '&nbsp;'}</td>`);
      }
      const brk = row.pageBreakBefore ? ' class="pb"' : '';
      return `<tr${brk}>${tds.join('')}</tr>`;
    });
    return `<table>${body.join('')}</table>`;
  });

  const css = `
*{box-sizing:border-box}
body{margin:14px;color:#111;font-family:${JSON.stringify(plan.fontName || 'Arial')},Arial,sans-serif;font-size:9px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
td{border:1px solid #b6b6b6;padding:2px 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ta-r{text-align:right}.ta-c{text-align:center}.b{font-weight:700}
.r-thead{background:#dbe5f1;font-weight:700;text-align:center}
.r-meta{background:#fbf9ee}
.r-spacer{border:none;background:#fff;height:6px}
.r-detail{background:#fdfdf6;font-style:italic;white-space:normal}
.r-total{background:#dbe5f1;font-weight:700}
.r-section{background:#c9d6e8;font-weight:700;font-size:10px}
.r-sign,.r-footer{border:none;background:#fff}
.r-footer{color:#555;font-size:8px}
tr.pb{page-break-before:always}
@media print{body{margin:6mm}.noprint{display:none}@page{size:A4 landscape;margin:8mm}}
`;
  const pageNo = plan.showPageNumbers
    ? '<div class="r-footer" style="text-align:right;margin-top:6px">— <span class="pageno"></span> —</div>'
    : '';
  const footer = plan.footer
    ? `<div class="r-footer" style="margin-top:6px">${escapeHtml(plan.footer)}</div>`
    : '';
  return (
    `<html><head><meta charset="utf-8"><title>${escapeHtml(plan.title)}</title><style>${css}</style></head>` +
    `<body>${tables.join('<div style="height:10px"></div>')}${footer}${pageNo}` +
    `<div class="noprint" style="margin-top:14px;text-align:center">` +
    `<button onclick="window.print()" style="padding:8px 18px;font-size:13px;cursor:pointer">Yazdır / Print</button></div>` +
    `</body></html>`
  );
}
