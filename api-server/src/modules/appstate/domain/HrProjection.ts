/**
 * HrProjection — app-state blob'unun HR çekirdeğini MEVCUT normalize hr
 * tablolarının satırlarına projeksiyonlar (047_hr_projection.sql).
 *
 * SAF fonksiyon: IO yok, birim testlenebilir. PUT /v1/app-state/promet:data
 * sonrası SetAppStateUseCase bunu çağırıp PgHrProjectionRepository.replaceAll'a
 * verir (access projeksiyonu ile aynı fire-and-forget kalıbı).
 *
 * Blob kaynak şekilleri (frontend/src/App.jsx'ten hedefli grep ile DOĞRULANDI):
 *   hrOrgUnits[]     = MEZUN (bkz. GRADUATED_COLLECTIONS) — yansıtılmaz.
 *   hrDepartments[]  = MEZUN (bkz. GRADUATED_COLLECTIONS) — yansıtılmaz.
 *   hrJobTitles[]    = { id:"jt_...", title, departmentId, headcount?,
 *                        standardBrutSalary? }  → TABLO KARŞILIĞI YOK, ATLANIR;
 *                        yalnız çalışan→departman zinciri için okunur.
 *   hrPositions[]    = MEZUN (bkz. GRADUATED_COLLECTIONS) — yansıtılmaz.
 *   hrEmployees[]    = { id:"emp_...", firstName, lastName, email?, phone?,
 *                        tcNo?, sgkNo?, sicilNo?, brutSalary?, status
 *                        (EMPLOYEE_STATUS), jobTitleId, departmentId?,
 *                        startDate?, endDate?, employmentType?, createdAt }
 *   hrCandidates[]   = MEZUN (bkz. GRADUATED_COLLECTIONS) — yansıtılmaz.
 *   hrApplications[] = MEZUN (bkz. GRADUATED_COLLECTIONS) — yansıtılmaz.
 *   hrLeaveRequests[]= { id:"lr_...", employeeId, leaveType (LEAVE_TYPES,
 *                        bazen "leave_" önekli), startDate, endDate, totalDays,
 *                        reason?, status (pending|approved|rejected|cancelled),
 *                        approvedAt/approverNote | rejectedAt/rejectionReason }
 *   hrPayrollRuns[]  = { id:"pr_...", period:{year,month}, status
 *                        (draft|confirmed), confirmedAt?, results:[
 *                        { employee:{id,...}, totals:{gross,net,
 *                          totalDeductions}, taxes:{sgkEmployee,unempEmployee,
 *                          incomeTax,stampDuty} } ] }
 *   hrAssets[]       = { id, assetType? (ASSET_TYPES), name?, brand?, model?,
 *                        serialNo?, status (ASSET_STATUS), assignedEmployeeId?,
 *                        assignedDate?, notes? }
 *
 * ŞİRKET AYRIMI: access projeksiyonuyla aynı yerleşik kalıp — Number(cid)
 * pozitif tamsayıysa o, değilse DEFAULT (1). companies'te olmayan company_id
 * repository'de düşürülür (projeksiyon saf kalır).
 *
 * ENUM EŞLEME TABLOLARI (blob → DB; birebir olmayanlar en yakın anlamlıya).
 * position_status/candidate_source/recruitment_stage haritaları artık yalnız
 * işe alım yazma-cutover devralması (AdoptBlobHrRecruitingUseCase) tarafından
 * kullanılır — TEK KAYNAK burada kalır:
 *   employee_status : active→active, probation→probation, on_leave→on_leave,
 *                     maternity→on_leave, military→on_leave,
 *                     suspended→on_leave, terminated→terminated; ?→active
 *   employment_type : full_time/part_time/contract/intern→aynı,
 *                     freelance→contract; ?→full_time
 *   position_status : open→open, on_hold→draft, filled→closed, closed→closed;
 *                     ?→draft
 *   candidate_source: linkedin→linkedin, referral→referral, direct→direct,
 *                     agency→agency, kariyer_net/secretcv/yenibiris→jobboard,
 *                     university/social/other→other; ?→direct
 *   recruitment_stage: cv_review→screening, phone_screen→screening,
 *                     technical→interview, hr_interview→interview,
 *                     reference→interview, offer→offer, hired→hired,
 *                     rejected→rejected, withdrawn→withdrawn, new→new; ?→new
 *   hr_leave_type   : ("leave_" öneki soyulur) annual/sick/unpaid/maternity→
 *                     aynı; paternity/marriage/bereavement/excused/diğer→other
 *   hr_leave_status : pending/approved/rejected/cancelled→aynı; ?→pending
 *   hr_payroll_run_status: draft→draft, confirmed→finalized; ?→draft
 *   hr_asset_type   : 14 DB değeri birebir; ?→other
 *   hr_asset_status : 5 DB değeri birebir; ?→in_stock
 *
 * ŞEMA UYUM KURALLARI:
 *   - employees.department_id NOT NULL: önce emp.departmentId, yoksa
 *     hrJobTitles[jobTitleId].departmentId zinciri; hiç referans yoksa ÇALIŞAN
 *     DÜŞER (sayaç employees.department). hrDepartments MEZUN olduğundan
 *     referansın kendisi (client-id "dept_..." VEYA önbellekten gelen SAYISAL
 *     sunucu id'si) olduğu gibi taşınır; DB'deki geçerli departman kümesiyle
 *     doğrulama REPOSITORY'de yapılır (çözülemeyen çalışan orada düşer).
 *   - employees.hire_date NOT NULL: startDate → createdAt(ilk 10) → yoksa DÜŞER
 *     (sayaç employees.hireDate). endDate < hireDate ise hireDate'e kırpılır.
 *     status=terminated + endDate yoksa termination_date=hire_date (CHECK
 *     employees_terminated_has_date).
 *   - employees.employee_no NOT NULL + UNIQUE(company): sicilNo → clientId;
 *     şirket içi çift sicilNo'da sonraki clientId'ye düşer.
 *   - employees.tc_kimlik: tam 11 karakter değilse NULL; şirket içi çiftte
 *     SON kazanır, öncekiler NULL'lanır (partial unique).
 *   - hr_payroll_runs UNIQUE (company, year, month): SON kazanır.
 *   - Şemada kolonu olmayan blob alanları atlanır: employees.brutSalary
 *     (employees tablosunda maaş kolonu YOK — v_hr_employees view'u zaten
 *     sunar), departments.parentDeptId, org_units.type/description,
 *     authorizedUsers, sgkNo...
 */

import { resolveAccessCompanyId } from './AccessProjection.js';

export const DEFAULT_HR_COMPANY_ID = 1;

/**
 * YAZMA-CUTOVER'LANAN (MEZUN) KOLEKSİYONLAR — projeksiyondan çıkarıldı.
 *
 * org_units + departments artık SUNUCU-OTORİTERDİR: tek seferlik devralma
 * POST /v1/hr/org/adopt-blob ile yapıldı; FE blob'daki hrOrgUnits/hrDepartments
 * alanlarını sunucudan doldurulan SALT-OKUNUR önbellek olarak taşır ve önbellek
 * satırlarının id'si SUNUCU id'sidir (ör. "12").
 *
 * positions + candidates + applications da SUNUCU-OTORİTERDİR (işe alım
 * yazma-cutover'ı): tek seferlik devralma POST /v1/hr/recruiting/adopt-blob
 * ile yapılır; FE blob'daki hrPositions/hrCandidates/hrApplications alanları
 * aynı salt-okunur önbellek kalıbına geçer.
 *
 * Bu koleksiyonlar yansıtılmaya devam etseydi önbellek yankısı client_id='12'
 * gibi ÇİFT satırlar üretir ve prune, hr CRUD/adopt yazımlarını silerdi.
 * Bu yüzden projectHr bu koleksiyonlar için satır ÜRETMEZ ve
 * PgHrProjectionRepository bu tabloları upsert/prune ETMEZ.
 */
export const GRADUATED_COLLECTIONS = [
  'hrOrgUnits',
  'hrDepartments',
  'hrPositions',
  'hrCandidates',
  'hrApplications',
] as const;

// --- DB enum'ları ------------------------------------------------------------
export type DbEmployeeStatus = 'probation' | 'active' | 'on_leave' | 'terminated';
export type DbEmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type DbPositionStatus = 'draft' | 'open' | 'closed';
export type DbCandidateSource =
  | 'referral'
  | 'linkedin'
  | 'jobboard'
  | 'direct'
  | 'agency'
  | 'other';
export type DbRecruitmentStage =
  | 'new'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn';
export type DbLeaveType = 'annual' | 'sick' | 'unpaid' | 'maternity' | 'other';
export type DbLeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type DbPayrollRunStatus = 'draft' | 'finalized';
export type DbAssetType =
  | 'laptop'
  | 'desktop'
  | 'phone'
  | 'vehicle'
  | 'card'
  | 'monitor'
  | 'headset'
  | 'tablet'
  | 'printer'
  | 'furniture'
  | 'key_lock'
  | 'uniform'
  | 'ppe'
  | 'other';
export type DbAssetStatus = 'in_stock' | 'assigned' | 'maintenance' | 'retired' | 'lost';

// --- Eşleme tabloları (dışa açık: birim test + dokümantasyon) ---------------
export const EMPLOYEE_STATUS_MAP: Readonly<Record<string, DbEmployeeStatus>> = {
  active: 'active',
  probation: 'probation',
  on_leave: 'on_leave',
  maternity: 'on_leave',
  military: 'on_leave',
  suspended: 'on_leave',
  terminated: 'terminated',
};

export const EMPLOYMENT_TYPE_MAP: Readonly<Record<string, DbEmploymentType>> = {
  full_time: 'full_time',
  part_time: 'part_time',
  contract: 'contract',
  intern: 'intern',
  freelance: 'contract',
};

export const POSITION_STATUS_MAP: Readonly<Record<string, DbPositionStatus>> = {
  open: 'open',
  on_hold: 'draft',
  filled: 'closed',
  closed: 'closed',
};

export const CANDIDATE_SOURCE_MAP: Readonly<Record<string, DbCandidateSource>> = {
  linkedin: 'linkedin',
  kariyer_net: 'jobboard',
  secretcv: 'jobboard',
  yenibiris: 'jobboard',
  referral: 'referral',
  direct: 'direct',
  agency: 'agency',
  university: 'other',
  social: 'other',
  other: 'other',
};

export const APPLICATION_STAGE_MAP: Readonly<Record<string, DbRecruitmentStage>> = {
  new: 'new',
  cv_review: 'screening',
  phone_screen: 'screening',
  screening: 'screening',
  technical: 'interview',
  hr_interview: 'interview',
  reference: 'interview',
  interview: 'interview',
  offer: 'offer',
  hired: 'hired',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
};

export const LEAVE_TYPE_MAP: Readonly<Record<string, DbLeaveType>> = {
  annual: 'annual',
  sick: 'sick',
  unpaid: 'unpaid',
  maternity: 'maternity',
};

export const LEAVE_STATUS_MAP: Readonly<Record<string, DbLeaveStatus>> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

export const PAYROLL_RUN_STATUS_MAP: Readonly<Record<string, DbPayrollRunStatus>> = {
  draft: 'draft',
  confirmed: 'finalized',
  finalized: 'finalized',
};

const ASSET_TYPES: readonly DbAssetType[] = [
  'laptop',
  'desktop',
  'phone',
  'vehicle',
  'card',
  'monitor',
  'headset',
  'tablet',
  'printer',
  'furniture',
  'key_lock',
  'uniform',
  'ppe',
  'other',
];
const ASSET_STATUSES: readonly DbAssetStatus[] = [
  'in_stock',
  'assigned',
  'maintenance',
  'retired',
  'lost',
];

// --- Projeksiyon satır tipleri -----------------------------------------------
/** MEZUN — projectHr artık org unit satırı üretmez; tip geriye uyum için durur. */
export interface HrOrgUnitProjection {
  companyId: number;
  clientId: string;
  parentClientId: string | null;
  name: string;
  code: string | null;
}

/** MEZUN — projectHr artık departman satırı üretmez; tip geriye uyum için durur. */
export interface HrDepartmentProjection {
  companyId: number;
  clientId: string;
  orgUnitClientId: string | null;
  name: string;
  code: string | null;
  managerEmployeeClientId: string | null;
}

/** MEZUN — projectHr artık pozisyon satırı üretmez; tip geriye uyum için durur. */
export interface HrPositionProjection {
  companyId: number;
  clientId: string;
  departmentClientId: string | null;
  title: string;
  description: string | null;
  status: DbPositionStatus;
  headcountTarget: number;
  minSalary: number | null;
  maxSalary: number | null;
}

export interface HrEmployeeProjection {
  companyId: number;
  clientId: string;
  /**
   * Departman referansı OLDUĞU GİBİ taşınır (hrDepartments MEZUN): eski
   * "dept_..." client-id'si VEYA önbellekten gelen sayısal sunucu id'si
   * ("12"). Repository DB'deki geçerli departman kümesiyle çözer/doğrular;
   * çözülemeyen çalışan orada düşer (department_id NOT NULL).
   */
  departmentClientId: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  tcKimlik: string | null;
  email: string | null;
  phone: string | null;
  hireDate: string;
  terminationDate: string | null;
  status: DbEmployeeStatus;
  employmentType: DbEmploymentType;
}

/** MEZUN — projectHr artık aday satırı üretmez; tip geriye uyum için durur. */
export interface HrCandidateProjection {
  companyId: number;
  clientId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: DbCandidateSource;
  cvUrl: string | null;
  notes: string | null;
}

/** MEZUN — projectHr artık başvuru satırı üretmez; tip geriye uyum için durur. */
export interface HrApplicationProjection {
  companyId: number;
  clientId: string;
  candidateClientId: string;
  positionClientId: string;
  stage: DbRecruitmentStage;
  stageChangedAt: string | null;
  rejectionReason: string | null;
  salaryExpectation: number | null;
  notes: string | null;
}

export interface HrLeaveRequestProjection {
  companyId: number;
  clientId: string;
  employeeClientId: string;
  leaveType: DbLeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: DbLeaveStatus;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface HrPayrollRunProjection {
  companyId: number;
  clientId: string;
  periodYear: number;
  periodMonth: number;
  status: DbPayrollRunStatus;
  finalizedAt: string | null;
}

export interface HrPayrollItemProjection {
  companyId: number;
  /** Bileşik projeksiyon anahtarı: "<runClientId>:<employeeClientId>". */
  clientId: string;
  runClientId: string;
  employeeClientId: string;
  grossSalary: number;
  sgkEmployee: number;
  unemployment: number;
  incomeTax: number;
  stampTax: number;
  otherDeductions: number;
  netSalary: number;
}

export interface HrAssetProjection {
  companyId: number;
  clientId: string;
  assetType: DbAssetType;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  status: DbAssetStatus;
  assignedEmployeeClientId: string | null;
  notes: string | null;
}

export interface HrAssetAssignmentProjection {
  companyId: number;
  /** Açık zimmet, asset başına en fazla 1 → asset clientId aynen kullanılır. */
  clientId: string;
  assetClientId: string;
  employeeClientId: string;
  assignedAt: string | null;
}

export interface HrProjection {
  /** MEZUN — her zaman boş (bkz. GRADUATED_COLLECTIONS). */
  orgUnits: HrOrgUnitProjection[];
  /** MEZUN — her zaman boş (bkz. GRADUATED_COLLECTIONS). */
  departments: HrDepartmentProjection[];
  /** MEZUN — her zaman boş (bkz. GRADUATED_COLLECTIONS). */
  positions: HrPositionProjection[];
  employees: HrEmployeeProjection[];
  /** MEZUN — her zaman boş (bkz. GRADUATED_COLLECTIONS). */
  candidates: HrCandidateProjection[];
  /** MEZUN — her zaman boş (bkz. GRADUATED_COLLECTIONS). */
  applications: HrApplicationProjection[];
  leaveRequests: HrLeaveRequestProjection[];
  payrollRuns: HrPayrollRunProjection[];
  payrollItems: HrPayrollItemProjection[];
  assets: HrAssetProjection[];
  assetAssignments: HrAssetAssignmentProjection[];
  /** Düşürülen/NULL'lanan satır sayaçları ("employees.department" → n). */
  dropped: Record<string, number>;
}

export interface ProjectHrOptions {
  /** Sayısal olmayan blob şirket anahtarlarının düşeceği company_id (öndeğer 1). */
  defaultCompanyId?: number;
}

// --- Küçük yardımcılar (AccessProjection kalıbı) -----------------------------
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function idString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function textOrNull(value: unknown, maxLen?: number): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (t === '') return null;
  return maxLen !== undefined ? t.slice(0, maxLen) : t;
}

/** Timestamp alanları: dolu string aynen taşınır (PG timestamptz'e cast eder). */
function timestampOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

const ISO_DATE_RE = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])/;

/** DATE kolonları: geçerli ISO önekli string'in ilk 10 karakteri; aksi null. */
function isoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return ISO_DATE_RE.test(t) ? t.slice(0, 10) : null;
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function mapEnum<T extends string>(
  map: Readonly<Record<string, T>>,
  value: unknown,
  fallback: T,
): T {
  if (typeof value === 'string') {
    const hit = map[value.trim()];
    if (hit !== undefined) return hit;
  }
  return fallback;
}

/** Dizi alanını obje elemanlara indirger; clientId'de SON kazanır. */
function collectItems(value: unknown): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(value)) return out;
  for (const item of value) {
    if (!isPlainObject(item)) continue;
    const clientId = idString(item['id']);
    if (clientId === null) continue;
    out.set(clientId, item);
  }
  return out;
}

interface CompanySlice {
  companyId: number;
  fields: Record<string, unknown>;
}

class DropCounter {
  readonly counts: Record<string, number> = {};
  add(reason: string, n = 1): void {
    if (n <= 0) return;
    this.counts[reason] = (this.counts[reason] ?? 0) + n;
  }
}

// --- Ana projeksiyon ---------------------------------------------------------
export function projectHr(blobValue: unknown, opts?: ProjectHrOptions): HrProjection {
  const defaultCompanyId = opts?.defaultCompanyId ?? DEFAULT_HR_COMPANY_ID;
  const dropped = new DropCounter();

  const slices: CompanySlice[] = [];
  if (isPlainObject(blobValue)) {
    const companyData = blobValue['companyData'];
    if (isPlainObject(companyData)) {
      for (const [cid, companyValue] of Object.entries(companyData)) {
        if (cid.trim() === '' || !isPlainObject(companyValue)) continue;
        slices.push({
          companyId: resolveAccessCompanyId(cid, defaultCompanyId),
          fields: companyValue,
        });
      }
    }
  }

  // clientId → projeksiyon satırı (SON kazanır; şirketler arası birleşim).
  // NOT: hrOrgUnits/hrDepartments/hrPositions/hrCandidates/hrApplications
  // MEZUN (GRADUATED_COLLECTIONS) — satır üretilmez.
  const employees = new Map<string, HrEmployeeProjection>();
  const leaveRequests = new Map<string, HrLeaveRequestProjection>();
  const payrollRuns = new Map<string, HrPayrollRunProjection>();
  const payrollItems = new Map<string, HrPayrollItemProjection>();
  const assets = new Map<string, HrAssetProjection>();
  /** hrJobTitles: tablo karşılığı yok — yalnız çalışan→departman zinciri için. */
  const jobTitleDept = new Map<string, string | null>();
  /** Ham blob elemanları (2. faz çözümlemeler için). */
  const rawEmployees = new Map<string, { companyId: number; item: Record<string, unknown> }>();
  const rawLeaves = new Map<string, { companyId: number; item: Record<string, unknown> }>();
  const rawRuns = new Map<string, { companyId: number; item: Record<string, unknown> }>();
  const rawAssets = new Map<string, { companyId: number; item: Record<string, unknown> }>();

  for (const { companyId, fields } of slices) {
    for (const [clientId, item] of collectItems(fields['hrJobTitles'])) {
      jobTitleDept.set(clientId, idString(item['departmentId']));
    }
    // hrOrgUnits + hrDepartments + hrPositions + hrCandidates + hrApplications:
    // MEZUN — okunmaz, satır üretilmez (bkz. GRADUATED_COLLECTIONS;
    // sunucu-otoriter, önbellek yankısı yasak).
    for (const [clientId, item] of collectItems(fields['hrEmployees'])) {
      rawEmployees.set(clientId, { companyId, item });
    }
    for (const [clientId, item] of collectItems(fields['hrLeaveRequests'])) {
      rawLeaves.set(clientId, { companyId, item });
    }
    for (const [clientId, item] of collectItems(fields['hrPayrollRuns'])) {
      rawRuns.set(clientId, { companyId, item });
    }
    for (const [clientId, item] of collectItems(fields['hrAssets'])) {
      rawAssets.set(clientId, { companyId, item });
    }
  }

  // --- Çalışanlar -------------------------------------------------------------
  const employeeNoSeen = new Set<string>(); // "companyId no"
  const tcOwner = new Map<string, HrEmployeeProjection>(); // "companyId tc" → önceki
  for (const [clientId, { companyId, item }] of rawEmployees) {
    const firstName = textOrNull(item['firstName'], 100);
    const lastName = textOrNull(item['lastName'], 100);
    if (firstName === null || lastName === null) {
      dropped.add('employees.name');
      continue;
    }

    // Departman zinciri: direkt departmentId → jobTitle.departmentId → düşür.
    // hrDepartments MEZUN — üyelik burada doğrulanamaz; referans (client-id
    // "dept_..." VEYA önbellekten gelen sayısal sunucu id'si) olduğu gibi
    // taşınır, repository DB'deki geçerli kümeyle çözer/doğrular.
    let deptClientId = idString(item['departmentId']);
    if (deptClientId === null) {
      const jtId = idString(item['jobTitleId']);
      deptClientId = jtId !== null ? (jobTitleDept.get(jtId) ?? null) : null;
    }
    if (deptClientId === null) {
      dropped.add('employees.department'); // department_id NOT NULL — düşür
      continue;
    }

    const hireDate = isoDateOrNull(item['startDate']) ?? isoDateOrNull(item['createdAt']);
    if (hireDate === null) {
      dropped.add('employees.hireDate'); // hire_date NOT NULL — düşür
      continue;
    }
    const status = mapEnum(EMPLOYEE_STATUS_MAP, item['status'], 'active');
    let terminationDate = isoDateOrNull(item['endDate']);
    if (terminationDate !== null && terminationDate < hireDate) terminationDate = hireDate;
    if (status === 'terminated' && terminationDate === null) terminationDate = hireDate;

    // employee_no: sicilNo → clientId; şirket içi çiftte clientId'ye düş.
    let employeeNo = textOrNull(item['sicilNo'], 40) ?? clientId.slice(0, 40);
    const noKey = `${companyId} ${employeeNo}`;
    if (employeeNoSeen.has(noKey)) {
      employeeNo = clientId.slice(0, 40);
      dropped.add('employees.duplicateEmployeeNo');
    }
    employeeNoSeen.add(`${companyId} ${employeeNo}`);

    // tc_kimlik: tam 11 karakter; şirket içi çiftte SON kazanır.
    let tcKimlik = textOrNull(item['tcNo']);
    if (tcKimlik !== null && tcKimlik.length !== 11) tcKimlik = null;
    if (tcKimlik !== null) {
      const tcKey = `${companyId} ${tcKimlik}`;
      const prev = tcOwner.get(tcKey);
      if (prev !== undefined) {
        prev.tcKimlik = null;
        dropped.add('employees.duplicateTcKimlik');
      }
    }

    const emp: HrEmployeeProjection = {
      companyId,
      clientId,
      departmentClientId: deptClientId,
      employeeNo,
      firstName,
      lastName,
      tcKimlik,
      email: textOrNull(item['email']),
      phone: textOrNull(item['phone'], 32),
      hireDate,
      terminationDate,
      status,
      employmentType: mapEnum(EMPLOYMENT_TYPE_MAP, item['employmentType'], 'full_time'),
    };
    if (tcKimlik !== null) tcOwner.set(`${companyId} ${tcKimlik}`, emp);
    employees.set(clientId, emp);
  }

  // --- İzin talepleri -----------------------------------------------------------
  for (const [clientId, { companyId, item }] of rawLeaves) {
    const employeeClientId = idString(item['employeeId']);
    if (employeeClientId === null || !employees.has(employeeClientId)) {
      dropped.add('leaveRequests.employee'); // employee_id NOT NULL — düşür
      continue;
    }
    const startDate = isoDateOrNull(item['startDate']);
    let endDate = isoDateOrNull(item['endDate']);
    if (startDate === null || endDate === null) {
      dropped.add('leaveRequests.dates');
      continue;
    }
    if (endDate < startDate) endDate = startDate; // CHECK date_order

    let days: number | null = null;
    const totalDays = finiteOrNull(item['totalDays']);
    if (totalDays !== null && Math.round(totalDays) > 0) days = Math.round(totalDays);
    if (days === null) {
      // Fallback: takvim günü farkı (dahil).
      const diff =
        (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000;
      if (Number.isFinite(diff) && diff >= 0) days = Math.round(diff) + 1;
    }
    if (days === null || days <= 0) {
      dropped.add('leaveRequests.days'); // CHECK days > 0
      continue;
    }

    const rawType =
      typeof item['leaveType'] === 'string' ? item['leaveType'].replace(/^leave_/, '') : '';
    leaveRequests.set(clientId, {
      companyId,
      clientId,
      employeeClientId,
      leaveType: mapEnum(LEAVE_TYPE_MAP, rawType, 'other'),
      startDate,
      endDate,
      days,
      reason: textOrNull(item['reason']),
      status: mapEnum(LEAVE_STATUS_MAP, item['status'], 'pending'),
      decidedAt:
        timestampOrNull(item['approvedAt']) ??
        timestampOrNull(item['rejectedAt']) ??
        timestampOrNull(item['cancelledAt']),
      decisionNote: textOrNull(item['approverNote']) ?? textOrNull(item['rejectionReason']),
    });
  }

  // --- Bordro koşuları + satırları -----------------------------------------------
  const runByPeriod = new Map<string, string>(); // "company y m" → clientId (SON)
  for (const [clientId, { companyId, item }] of rawRuns) {
    const period = isPlainObject(item['period']) ? item['period'] : {};
    const yearRaw = finiteOrNull(period['year']);
    const monthRaw = finiteOrNull(period['month']);
    const periodYear = yearRaw !== null ? Math.trunc(yearRaw) : null;
    const periodMonth = monthRaw !== null ? Math.trunc(monthRaw) : null;
    if (
      periodYear === null ||
      periodMonth === null ||
      periodMonth < 1 ||
      periodMonth > 12 ||
      periodYear < 2000 ||
      periodYear > 2200
    ) {
      dropped.add('payrollRuns.period'); // CHECK year/month range — düşür
      continue;
    }
    const periodKey = `${companyId} ${periodYear} ${periodMonth}`;
    const prevRun = runByPeriod.get(periodKey);
    if (prevRun !== undefined && prevRun !== clientId) {
      payrollRuns.delete(prevRun); // UNIQUE (company, year, month): SON kazanır
      for (const [itemKey, pi] of payrollItems) {
        if (pi.runClientId === prevRun) payrollItems.delete(itemKey);
      }
      dropped.add('payrollRuns.duplicatePeriod');
    }
    runByPeriod.set(periodKey, clientId);

    const status = mapEnum(PAYROLL_RUN_STATUS_MAP, item['status'], 'draft');
    payrollRuns.set(clientId, {
      companyId,
      clientId,
      periodYear,
      periodMonth,
      status,
      finalizedAt: status === 'finalized' ? timestampOrNull(item['confirmedAt']) : null,
    });

    // Koşu içi personel satırları (results[]) → hr_payroll_items.
    const results = item['results'];
    if (!Array.isArray(results)) continue;
    for (const r of results) {
      if (!isPlainObject(r)) continue;
      const empObj = isPlainObject(r['employee']) ? r['employee'] : {};
      const employeeClientId = idString(empObj['id']) ?? idString(r['employeeId']);
      if (employeeClientId === null || !employees.has(employeeClientId)) {
        dropped.add('payrollItems.employee'); // employee_id NOT NULL — düşür
        continue;
      }
      const totals = isPlainObject(r['totals']) ? r['totals'] : {};
      const taxes = isPlainObject(r['taxes']) ? r['taxes'] : {};
      const gross = finiteOrNull(totals['gross']) ?? 0;
      const net = finiteOrNull(totals['net']) ?? 0;
      const sgkEmployee = finiteOrNull(taxes['sgkEmployee']) ?? 0;
      const unemployment = finiteOrNull(taxes['unempEmployee']) ?? 0;
      const incomeTax = finiteOrNull(taxes['incomeTax']) ?? 0;
      const stampTax = finiteOrNull(taxes['stampDuty']) ?? 0;
      const totalDeductions = finiteOrNull(totals['totalDeductions']);
      const core = sgkEmployee + unemployment + incomeTax + stampTax;
      const otherDeductions =
        totalDeductions !== null ? Math.max(0, round2(totalDeductions - core)) : 0;
      const itemClientId = `${clientId}:${employeeClientId}`;
      payrollItems.set(itemClientId, {
        companyId,
        clientId: itemClientId, // UNIQUE (run_id, employee_id): SON kazanır (Map)
        runClientId: clientId,
        employeeClientId,
        grossSalary: gross,
        sgkEmployee,
        unemployment,
        incomeTax,
        stampTax,
        otherDeductions,
        netSalary: net,
      });
    }
  }

  // --- Zimmet varlıkları + açık atamalar ------------------------------------------
  const assetAssignments = new Map<string, HrAssetAssignmentProjection>();
  for (const [clientId, { companyId, item }] of rawAssets) {
    const assetTypeRaw = idString(item['assetType']) ?? idString(item['type']);
    const assetType = (ASSET_TYPES as readonly string[]).includes(assetTypeRaw ?? '')
      ? (assetTypeRaw as DbAssetType)
      : 'other';
    const statusRaw = idString(item['status']);
    const status = (ASSET_STATUSES as readonly string[]).includes(statusRaw ?? '')
      ? (statusRaw as DbAssetStatus)
      : 'in_stock';
    const brand = textOrNull(item['brand']);
    const model = textOrNull(item['model']);
    // name NOT NULL: name → "marka model" → assetType.
    const name =
      textOrNull(item['name']) ?? textOrNull(`${brand ?? ''} ${model ?? ''}`) ?? assetType;

    let assignedEmployeeClientId = idString(item['assignedEmployeeId']);
    if (assignedEmployeeClientId !== null && !employees.has(assignedEmployeeClientId)) {
      assignedEmployeeClientId = null; // nullable FK → NULL
      dropped.add('assets.assignedEmployee');
    }

    assets.set(clientId, {
      companyId,
      clientId,
      assetType,
      name,
      brand,
      model,
      serialNo: textOrNull(item['serialNo']) ?? textOrNull(item['serial']),
      status,
      assignedEmployeeClientId,
      notes: textOrNull(item['notes']),
    });

    // Blob'da atama defteri yok; MEVCUT açık zimmet sentezlenir (asset başına 1).
    if (status === 'assigned' && assignedEmployeeClientId !== null) {
      assetAssignments.set(clientId, {
        companyId,
        clientId,
        assetClientId: clientId,
        employeeClientId: assignedEmployeeClientId,
        assignedAt: timestampOrNull(item['assignedDate']),
      });
    }
  }

  return {
    orgUnits: [], // MEZUN (GRADUATED_COLLECTIONS)
    departments: [], // MEZUN (GRADUATED_COLLECTIONS)
    positions: [], // MEZUN (GRADUATED_COLLECTIONS)
    employees: [...employees.values()],
    candidates: [], // MEZUN (GRADUATED_COLLECTIONS)
    applications: [], // MEZUN (GRADUATED_COLLECTIONS)
    leaveRequests: [...leaveRequests.values()],
    payrollRuns: [...payrollRuns.values()],
    payrollItems: [...payrollItems.values()],
    assets: [...assets.values()],
    assetAssignments: [...assetAssignments.values()],
    dropped: dropped.counts,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
