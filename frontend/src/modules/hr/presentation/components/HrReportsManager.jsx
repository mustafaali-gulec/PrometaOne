/**
 * HR → RAPORLAR
 * =============
 * İnsan kaynakları rapor merkezi. İlk rapor: **Bordro Dökümü** — dönem bordrosunun
 * personel bazlı tam dökümü (kaynak bordro programındaki parametre ekranı ve çıktı
 * yerleşimiyle birebir).
 *
 * Mimari not: ekran app-state'i (`data`) okur ama bordro motoruna DOĞRUDAN bağlı
 * değildir; motor fonksiyonları `helpers` prop'uyla enjekte edilir (App.jsx seam'i).
 * Rapor yerleşimi/çıktısı saf `modules/hr/reports` çekirdeğinden gelir; ekran
 * önizlemesi, Excel ve yazdırma AYNI sayfa planından üretilir.
 */
import { useMemo, useState } from 'react';

import * as XLSX from 'xlsx';

import {
  buildPayrollDokumModel,
  buildPayrollDokumPlan,
  DEFAULT_PAYROLL_DOKUM_COLUMNS,
  dokumMonthName,
  dokumT,
  mergeMapsOf,
  PAYROLL_DOKUM_COLUMNS,
  planToHtml,
  planToWorkbook,
  SUMMARY_PAYROLL_DOKUM_COLUMNS,
} from '../../reports';

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

const CURRENCIES = [
  {
    code: 'TRY',
    label: {
      tr: 'TÜRK LİRASI (TL)',
      en: 'TURKISH LIRA (TRY)',
      de: 'TÜRKISCHE LIRA (TRY)',
      ar: 'الليرة التركية (TRY)',
    },
  },
  {
    code: 'USD',
    label: {
      tr: 'AMERİKAN DOLARI (USD)',
      en: 'US DOLLAR (USD)',
      de: 'US-DOLLAR (USD)',
      ar: 'الدولار الأمريكي (USD)',
    },
  },
  {
    code: 'EUR',
    label: { tr: 'EURO (EUR)', en: 'EURO (EUR)', de: 'EURO (EUR)', ar: 'اليورو (EUR)' },
  },
  {
    code: 'GBP',
    label: {
      tr: 'İNGİLİZ STERLİNİ (GBP)',
      en: 'BRITISH POUND (GBP)',
      de: 'BRITISCHES PFUND (GBP)',
      ar: 'الجنيه الإسترليني (GBP)',
    },
  },
];

const FONTS = ['Arial', 'Calibri', 'Times New Roman', 'Tahoma', 'Verdana'];

const L = (labels, lang) => labels?.[lang] || labels?.tr || '';

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyCompany = {
  name: '',
  address: '',
  taxOffice: '',
  taxNumber: '',
  mersisNo: '',
  sgkWorkplaceNo: '',
  sgkBranch: '',
};

/* ------------------------------------------------------------------ */
/* Küçük UI parçaları                                                  */
/* ------------------------------------------------------------------ */

/** Kaynak ekrandaki "etiket | kontrol" satırı. */
function ParamRow({ label, children, hint }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 190px) minmax(180px, 300px)',
        gap: 0,
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          padding: '5px 8px',
          fontSize: 11.5,
          fontWeight: 600,
          background: 'var(--bg-alt)',
          borderRight: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {label}
      </div>
      <div style={{ padding: '3px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        {children}
        {hint ? <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>{hint}</span> : null}
      </div>
    </div>
  );
}

const SELECT_STYLE = { fontSize: 11.5, padding: '3px 5px', width: '100%', minWidth: 0 };

function ParamSelect({ value, onChange, options }) {
  return (
    <select
      className="input"
      style={SELECT_STYLE}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Göster/Gösterme ikilisi. */
function ShowHide({ value, onChange, lang }) {
  return (
    <ParamSelect
      value={value ? '1' : '0'}
      onChange={(v) => onChange(v === '1')}
      options={[
        { value: '1', label: dokumT('optShow', lang) },
        { value: '0', label: dokumT('optHide', lang) },
      ]}
    />
  );
}

/** Evet/Hayır ikilisi. */
function YesNo({ value, onChange, lang }) {
  return (
    <ParamSelect
      value={value ? '1' : '0'}
      onChange={(v) => onChange(v === '1')}
      options={[
        { value: '1', label: dokumT('optYes', lang) },
        { value: '0', label: dokumT('optNo', lang) },
      ]}
    />
  );
}

/** Sütun seçim penceresi ("Sütunları seçmek için buraya tıklayınız."). */
function ColumnPicker({ selected, onApply, onClose, lang }) {
  const [keys, setKeys] = useState(() => selected.slice());
  const toggle = (k) =>
    setKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  // Sıra her zaman kanonik sütun sırasına göre normalize edilir.
  const ordered = PAYROLL_DOKUM_COLUMNS.filter((c) => keys.includes(c.key)).map((c) => c.key);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 'min(720px, 96vw)', maxHeight: '86vh', overflow: 'auto', padding: 14 }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          {dokumT('columnsModalTitle', lang)}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 4,
          }}
        >
          {PAYROLL_DOKUM_COLUMNS.map((c) => (
            <label
              key={c.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={keys.includes(c.key)}
                onChange={() => toggle(c.key)}
              />
              <span>{dokumT(c.labelKey, lang)}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11.5 }}
            onClick={() => setKeys(PAYROLL_DOKUM_COLUMNS.map((c) => c.key))}
          >
            {dokumT('btnSelectAll', lang)}
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11.5 }}
            onClick={() => setKeys(DEFAULT_PAYROLL_DOKUM_COLUMNS.slice())}
          >
            {dokumT('btnResetColumns', lang)}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-outline" style={{ fontSize: 11.5 }} onClick={onClose}>
            ✕
          </button>
          <button
            className="btn btn-primary"
            style={{ fontSize: 11.5 }}
            disabled={ordered.length === 0}
            onClick={() => {
              onApply(ordered);
              onClose();
            }}
          >
            ✓ {dokumT('optSelect', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sayfa planını ekranda tablo olarak render eder (Excel/PDF ile birebir). */
function PlanPreview({ plan }) {
  return (
    <div
      style={{
        overflowX: 'auto',
        border: '1px solid var(--line)',
        borderRadius: 4,
        background: '#fff',
      }}
    >
      {plan.sheets.map((sheet, si) => {
        const { skip, span } = mergeMapsOf(sheet);
        return (
          <table
            key={si}
            style={{
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              width: 'max-content',
              minWidth: '100%',
              fontFamily: `${plan.fontName}, Arial, sans-serif`,
              fontSize: 10,
              color: '#111',
              marginBottom: si < plan.sheets.length - 1 ? 12 : 0,
            }}
          >
            <colgroup>
              {Array.from({ length: sheet.colCount }, (_, i) => (
                <col key={i} style={{ width: `${Math.max(3, sheet.cols[i]?.wch || 9) * 8}px` }} />
              ))}
            </colgroup>
            <tbody>
              {sheet.rows.map((row, r) => {
                const tds = [];
                for (let c = 0; c < sheet.colCount; c++) {
                  if (skip.has(`${r}:${c}`)) continue;
                  const cell = row.cells[c] || null;
                  const sp = span.get(`${r}:${c}`);
                  const bg =
                    row.role === 'thead' || row.role === 'total'
                      ? '#dbe5f1'
                      : row.role === 'section'
                        ? '#c9d6e8'
                        : row.role === 'meta'
                          ? '#fbf9ee'
                          : row.role === 'detail'
                            ? '#fdfdf6'
                            : '#fff';
                  const isPlain =
                    row.role === 'spacer' || row.role === 'sign' || row.role === 'footer';
                  tds.push(
                    <td
                      key={c}
                      colSpan={sp?.colSpan || 1}
                      rowSpan={sp?.rowSpan || 1}
                      style={{
                        border: isPlain ? 'none' : '1px solid #b6b6b6',
                        padding: '2px 4px',
                        background: isPlain ? '#fff' : bg,
                        fontWeight: cell?.bold ? 700 : 400,
                        textAlign:
                          cell?.align === 'right'
                            ? 'right'
                            : cell?.align === 'center'
                              ? 'center'
                              : 'left',
                        whiteSpace: row.role === 'detail' ? 'normal' : 'nowrap',
                        fontStyle: row.role === 'detail' ? 'italic' : 'normal',
                        color: row.role === 'footer' ? '#555' : '#111',
                        height: row.role === 'spacer' ? 6 : undefined,
                      }}
                    >
                      {cell ? (cell.w ?? String(cell.v ?? '')) : ' '}
                    </td>,
                  );
                }
                return <tr key={r}>{tds}</tr>;
              })}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bordro Dökümü ekranı                                                */
/* ------------------------------------------------------------------ */

function PayrollDokumScreen({ data, lang, notify, company, helpers, onBack, canExport }) {
  const now = new Date();
  const orgUnits = data?.hrOrgUnits || [];
  const departments = data?.hrDepartments || [];
  const employees = useMemo(
    () =>
      (data?.hrEmployees || [])
        .slice()
        .sort((a, b) =>
          `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(
            `${b.firstName || ''} ${b.lastName || ''}`,
            'tr',
          ),
        ),
    [data?.hrEmployees],
  );

  // --- Parametreler (kaynak ekranla aynı sıra) ---
  const [workplaceId, setWorkplaceId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [employeeId, setEmployeeId] = useState('');
  const [source, setSource] = useState('auto'); // auto | saved | live
  const [wageBasis, setWageBasis] = useState('total'); // total | gross | hourly
  const [layout, setLayout] = useState('detailed'); // detailed | summary
  const [columns, setColumns] = useState(() => DEFAULT_PAYROLL_DOKUM_COLUMNS.slice());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lawNo, setLawNo] = useState('');
  const [showTotals, setShowTotals] = useState(true);
  const [showIcmal, setShowIcmal] = useState(false);
  const [showComponentTotals, setShowComponentTotals] = useState(false);
  const [pageBreak, setPageBreak] = useState('none');
  const [showPreparerSign, setShowPreparerSign] = useState(false);
  const [showCheckerSign, setShowCheckerSign] = useState(false);
  const [showApproverSign, setShowApproverSign] = useState(false);
  const [sgkGroup, setSgkGroup] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [rateBasis, setRateBasis] = useState('buying');
  const [rateDate, setRateDate] = useState(todayIso);
  const [rateInput, setRateInput] = useState('');
  const [missingDayMode, setMissingDayMode] = useState('single');
  const [tablePlacement, setTablePlacement] = useState('separate');
  const [employeesPerPage, setEmployeesPerPage] = useState(0);
  const [showFilterCriteria, setShowFilterCriteria] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  const [output, setOutput] = useState('excel'); // excel | pdf | screen
  const [emailMode, setEmailMode] = useState('none'); // none | send
  const [emailTo, setEmailTo] = useState('');
  const [fontName, setFontName] = useState('Arial');
  const [showFooter, setShowFooter] = useState(false);

  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);

  const opt = (v, label) => ({ value: v, label });

  // Kanun no / SSK grup seçenekleri org birimlerden türetilir.
  const lawNoOptions = useMemo(() => {
    const set = new Set();
    for (const o of orgUnits)
      set.add(String(o?.sgk?.lawNo || (o?.sgk?.has5510Discount ? '05510' : '00000')));
    if (set.size === 0) {
      set.add('05510');
      set.add('00000');
    }
    return [...set].sort();
  }, [orgUnits]);

  const sgkGroupOptions = useMemo(() => {
    const set = new Set();
    for (const o of orgUnits) if (o?.sgk?.workplaceCode) set.add(String(o.sgk.workplaceCode));
    return [...set].sort();
  }, [orgUnits]);

  /** Bir personelin org/departman/kanun bağlamını çözer. */
  const contextOf = (emp) => {
    const dept = helpers.getEmployeeDepartment?.(emp, data) || null;
    const unit = helpers.getEmployeeOrgUnit?.(emp, data) || null;
    const jt = helpers.getEmployeeJobTitle?.(emp, data) || null;
    const derivedLaw = unit?.sgk?.lawNo || (unit?.sgk?.has5510Discount ? '05510' : '00000');
    return {
      department: dept,
      orgUnit: unit,
      jobTitle: jt,
      lawNo: String(derivedLaw),
      sgkWorkplaceCode: String(unit?.sgk?.workplaceCode || ''),
    };
  };

  /** Seçili parametrelerin "Filtre" satırı metni. */
  const criteriaText = () => {
    const parts = [
      `${dokumT('pWorkplace', lang)}=${workplaceId ? orgUnits.find((o) => o.id === workplaceId)?.name || '?' : dokumT('optAll', lang)}`,
      `${dokumT('pDepartment', lang)}=${departmentId ? departments.find((d) => d.id === departmentId)?.name || '?' : dokumT('optAll', lang)}`,
      `${dokumT('pLawNo', lang)}=${lawNo || dokumT('optAll', lang)}`,
      `${dokumT('pSgkGroup', lang)}=${sgkGroup || dokumT('optAll', lang)}`,
      `${dokumT('pEmployee', lang)}=${
        employeeId
          ? (() => {
              const e = employees.find((x) => x.id === employeeId);
              return e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : '?';
            })()
          : dokumT('optAll', lang)
      }`,
    ];
    return parts.join(' · ');
  };

  /** Dönem sonuçlarını (kayıtlı bordro ya da anlık hesap) getirir. */
  const loadResults = () => {
    const runs = data?.hrPayrollRuns || [];
    const saved = runs.find(
      (r) => Number(r?.period?.year) === Number(year) && Number(r?.period?.month) === Number(month),
    );
    if (source === 'saved') {
      if (!saved) return { results: null, error: dokumT('msgNoSavedRun', lang) };
      return { results: saved.results || [], error: null };
    }
    if (source === 'auto' && saved) return { results: saved.results || [], error: null };
    const batch = helpers.runPayrollBatch?.(data, {
      year: Number(year),
      month: Number(month),
      date: `${year}-${String(month).padStart(2, '0')}-15`,
    });
    return { results: batch?.results || [], error: null };
  };

  const buildPlan = () => {
    const { results, error } = loadResults();
    if (error) {
      notify?.(error, 'err');
      return null;
    }

    const empById = new Map(employees.map((e) => [e.id, e]));
    const sheets = data?.hrAttendanceSheets || [];
    const rows = [];

    for (const result of results || []) {
      const emp = empById.get(result?.employee?.id);
      if (!emp) continue;
      const ctx = contextOf(emp);

      // --- Filtreler ---
      if (employeeId && emp.id !== employeeId) continue;
      if (workplaceId && ctx.orgUnit?.id !== workplaceId) continue;
      if (departmentId && ctx.department?.id !== departmentId) continue;
      if (lawNo && ctx.lawNo !== lawNo) continue;
      if (sgkGroup && ctx.sgkWorkplaceCode !== sgkGroup) continue;

      const sheet =
        sheets.find(
          (s) =>
            s.employeeId === emp.id &&
            Number(s.year) === Number(year) &&
            Number(s.month) === Number(month),
        ) || null;

      const salaryType = emp.salaryType === 'net' ? 'net' : 'gross';
      const netInput = Number(
        String(emp.netSalaryInput ?? '')
          .replace(/\./g, '')
          .replace(',', '.'),
      );
      const agreed =
        salaryType === 'net' && Number.isFinite(netInput) && netInput > 0
          ? netInput
          : Number(emp.brutSalary) || 0;

      rows.push({
        employeeId: emp.id,
        fullName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toLocaleUpperCase('tr-TR'),
        tcNo: String(emp.tcNo || ''),
        startDate: emp.startDate || null,
        exitDate: emp.exitDate || emp.endDate || null,
        lawNo: ctx.lawNo,
        sgkWorkplaceCode: ctx.sgkWorkplaceCode,
        workplaceName: ctx.orgUnit?.name || '',
        departmentName: ctx.department?.name || '',
        jobTitleName: ctx.jobTitle?.name || '',
        iban: String(emp.iban || emp.bankAccount?.iban || ''),
        salaryType,
        agreedSalary: agreed,
        days: {
          workedDays: Number(sheet?.workedDays) || 0,
          weekendDays: Number(sheet?.weekendDays) || 0,
          sickDays: Number(sheet?.leaveSickDays) || 0,
          annualLeaveDays: Number(sheet?.leaveAnnualDays) || 0,
          unpaidLeaveDays: Number(sheet?.leaveUnpaidDays) || 0,
          absentDays: Number(sheet?.absentDays) || 0,
          overtimeNormalHours: Number(sheet?.overtimeNormalHours) || 0,
          overtimeWeekendHours: Number(sheet?.overtimeWeekendHours) || 0,
          overtimeHolidayHours: Number(sheet?.overtimeHolidayHours) || 0,
        },
        result,
      });
    }

    if (rows.length === 0) {
      notify?.(dokumT('msgNoData', lang), 'err');
      return null;
    }

    const manualRate = Number(String(rateInput).replace(/\./g, '').replace(',', '.'));
    const fxRate =
      currency === 'TRY'
        ? 1
        : Number.isFinite(manualRate) && manualRate > 0
          ? manualRate
          : helpers.resolveFxRate?.(currency, data, rateDate) || 1;

    const options = {
      lang,
      columns: columns.slice(),
      layout,
      wageBasis,
      showFilterBlock: true,
      showFilterCriteria,
      showTotals,
      showIcmal,
      showComponentTotals,
      showPreparerSign,
      showCheckerSign,
      showApproverSign,
      showDate,
      showPageNumbers,
      showFooter,
      missingDayMode,
      tablePlacement,
      pageBreak,
      employeesPerPage: Number(employeesPerPage) || 0,
      currency,
      fxRate,
      rateBasis,
      rateDate: currency === 'TRY' ? null : rateDate,
      fontName,
      generatedAt: todayIso(),
    };

    const model = buildPayrollDokumModel(
      {
        company: company || emptyCompany,
        period: { year: Number(year), month: Number(month) },
        filterLabels: {
          workplace: workplaceId
            ? orgUnits.find((o) => o.id === workplaceId)?.name || ''
            : dokumT('optAll', lang),
          department: departmentId
            ? departments.find((d) => d.id === departmentId)?.name || ''
            : dokumT('optAll', lang),
        },
        criteria: criteriaText(),
        rows,
      },
      options,
    );
    return buildPayrollDokumPlan(model, options);
  };

  const downloadExcel = (p) => {
    XLSX.writeFile(planToWorkbook(p), `${p.fileName}.xlsx`);
  };

  const openPrint = (p) => {
    const win = window.open('', '_blank', 'width=1100,height=760');
    if (!win) {
      notify?.(dokumT('msgPopupBlocked', lang), 'err');
      return;
    }
    win.document.write(planToHtml(p));
    win.document.close();
  };

  const maybeSendEmail = async (p) => {
    if (emailMode !== 'send') return;
    if (!emailTo.trim()) {
      notify?.(dokumT('msgEmailNeeded', lang), 'err');
      return;
    }
    const res = await helpers.sendEmail?.({
      to: emailTo.trim(),
      subject: p.title,
      html: planToHtml(p),
      text: p.title,
      meta: { kind: 'hr_payroll_dokum', period: `${year}-${String(month).padStart(2, '0')}` },
    });
    if (res?.success) notify?.(dokumT('msgEmailSent', lang));
    else notify?.(`${dokumT('msgEmailFailed', lang)}${res?.error ? ` (${res.error})` : ''}`, 'err');
  };

  const run = async () => {
    setBusy(true);
    try {
      const p = buildPlan();
      if (!p) return;
      setPlan(p);
      if (output === 'excel') downloadExcel(p);
      else if (output === 'pdf') openPrint(p);
      notify?.(dokumT('msgReady', lang));
      await maybeSendEmail(p);
    } finally {
      setBusy(false);
    }
  };

  const fetchRate = () => {
    const r = helpers.resolveFxRate?.(currency, data, rateDate);
    if (r && r > 0) setRateInput(String(r));
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) =>
    opt(String(i + 1), dokumMonthName(i + 1, lang)),
  );

  const rowCount = plan ? plan.sheets[0]?.rows.filter((r) => r.role === 'data').length || 0 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" style={{ fontSize: 11.5 }} onClick={onBack}>
          {dokumT('backToList', lang)}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Başlık şeridi */}
        <div
          style={{
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.3,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          {dokumT('dokumTitle', lang)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 8px' }}>
          <div
            style={{
              border: '1px solid var(--line)',
              borderBottom: 'none',
              width: 'fit-content',
              minWidth: 320,
            }}
          >
            <ParamRow label={dokumT('pWorkplace', lang)}>
              <ParamSelect
                value={workplaceId}
                onChange={setWorkplaceId}
                options={[
                  opt('', dokumT('optAll', lang)),
                  ...orgUnits.map((o) => opt(o.id, o.name || o.id)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pDepartment', lang)}>
              <ParamSelect
                value={departmentId}
                onChange={setDepartmentId}
                options={[
                  opt('', dokumT('optAll', lang)),
                  ...departments.map((d) => opt(d.id, d.name || d.id)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pMonths', lang)}>
              <select
                className="input"
                style={{ ...SELECT_STYLE, flex: 1 }}
                value={String(month)}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {monthOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                className="input mono"
                type="number"
                min="2000"
                max="2100"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{ fontSize: 11.5, padding: '3px 5px', width: 62, textAlign: 'center' }}
              />
            </ParamRow>

            <ParamRow label={dokumT('pEmployee', lang)}>
              <ParamSelect
                value={employeeId}
                onChange={setEmployeeId}
                options={[
                  opt('', dokumT('optAll', lang)),
                  ...employees.map((e) =>
                    opt(e.id, `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.id),
                  ),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pPayrollSource', lang)}>
              <ParamSelect
                value={source}
                onChange={setSource}
                options={[
                  opt('auto', dokumT('optSourceAuto', lang)),
                  opt('saved', dokumT('optSourceSaved', lang)),
                  opt('live', dokumT('optSourceLive', lang)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pWageBasis', lang)}>
              <ParamSelect
                value={wageBasis}
                onChange={setWageBasis}
                options={[
                  opt('total', dokumT('optWageFromTotal', lang)),
                  opt('gross', dokumT('optWageFromGross', lang)),
                  opt('hourly', dokumT('optWageHourly', lang)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pLayout', lang)}>
              <ParamSelect
                value={layout}
                onChange={(v) => {
                  setLayout(v);
                  setColumns(
                    v === 'summary'
                      ? SUMMARY_PAYROLL_DOKUM_COLUMNS.slice()
                      : DEFAULT_PAYROLL_DOKUM_COLUMNS.slice(),
                  );
                }}
                options={[
                  opt('detailed', dokumT('optLayoutDetailed', lang)),
                  opt('summary', dokumT('optLayoutSummary', lang)),
                ]}
              />
            </ParamRow>

            {/* Sütun seçimi bağlantısı — kaynak ekrandaki satırın aynısı */}
            <div
              style={{ borderBottom: '1px solid var(--line)', padding: '4px 8px', fontSize: 11 }}
            >
              <button
                onClick={() => setPickerOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  textDecoration: 'underline',
                  fontSize: 11,
                }}
              >
                {dokumT('pColumnPicker', lang)}
              </button>
              <span style={{ color: 'var(--ink-mute)', marginLeft: 6 }}>({columns.length})</span>
            </div>

            <ParamRow label={dokumT('pLawNo', lang)}>
              <ParamSelect
                value={lawNo}
                onChange={setLawNo}
                options={[opt('', dokumT('optAll', lang)), ...lawNoOptions.map((k) => opt(k, k))]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pTotals', lang)}>
              <ShowHide value={showTotals} onChange={setShowTotals} lang={lang} />
            </ParamRow>

            <ParamRow label={dokumT('pIcmal', lang)}>
              <ShowHide value={showIcmal} onChange={setShowIcmal} lang={lang} />
            </ParamRow>

            <ParamRow label={dokumT('pComponentTotals', lang)}>
              <ShowHide value={showComponentTotals} onChange={setShowComponentTotals} lang={lang} />
            </ParamRow>

            <ParamRow label={dokumT('pPageBreak', lang)}>
              <ParamSelect
                value={pageBreak}
                onChange={setPageBreak}
                options={[
                  opt('none', dokumT('optPageBreakNone', lang)),
                  opt('per_employee', dokumT('optPageBreakPerEmployee', lang)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pPreparerSign', lang)}>
              <ShowHide value={showPreparerSign} onChange={setShowPreparerSign} lang={lang} />
            </ParamRow>

            <ParamRow label={dokumT('pCheckerSign', lang)}>
              <ShowHide value={showCheckerSign} onChange={setShowCheckerSign} lang={lang} />
            </ParamRow>

            <ParamRow label={dokumT('pApproverSign', lang)}>
              <ShowHide value={showApproverSign} onChange={setShowApproverSign} lang={lang} />
            </ParamRow>

            <ParamRow label={dokumT('pSgkGroup', lang)}>
              <ParamSelect
                value={sgkGroup}
                onChange={setSgkGroup}
                options={[
                  opt('', dokumT('optAll', lang)),
                  ...sgkGroupOptions.map((k) => opt(k, k)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pCurrency', lang)}>
              <ParamSelect
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES.map((c) => opt(c.code, L(c.label, lang)))}
              />
            </ParamRow>

            <ParamRow label={dokumT('pRateBasis', lang)}>
              <ParamSelect
                value={rateBasis}
                onChange={setRateBasis}
                options={[
                  opt('buying', dokumT('optBuying', lang)),
                  opt('selling', dokumT('optSelling', lang)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pRateDate', lang)}>
              <input
                className="input mono"
                type="date"
                value={rateDate}
                disabled={currency === 'TRY'}
                onChange={(e) => setRateDate(e.target.value)}
                style={{ ...SELECT_STYLE, textAlign: 'right' }}
              />
            </ParamRow>

            <ParamRow label={dokumT('pRate', lang)}>
              <input
                className="input mono"
                value={rateInput}
                disabled={currency === 'TRY'}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="0,0000"
                style={{ ...SELECT_STYLE, textAlign: 'right' }}
              />
              <button
                className="btn btn-outline"
                style={{ fontSize: 11, padding: '3px 8px' }}
                disabled={currency === 'TRY'}
                onClick={fetchRate}
              >
                {dokumT('btnFetchRate', lang)}
              </button>
            </ParamRow>

            <ParamRow label={dokumT('pMissingDays', lang)}>
              <ParamSelect
                value={missingDayMode}
                onChange={setMissingDayMode}
                options={[
                  opt('single', dokumT('optMissingSingleLine', lang)),
                  opt('separate', dokumT('optMissingSeparateLine', lang)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pTablePlacement', lang)}>
              <ParamSelect
                value={tablePlacement}
                onChange={setTablePlacement}
                options={[
                  opt('separate', dokumT('optTablesSeparate', lang)),
                  opt('same', dokumT('optTablesSame', lang)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pPerPage', lang)}>
              <ParamSelect
                value={String(employeesPerPage)}
                onChange={(v) => setEmployeesPerPage(Number(v))}
                options={[
                  opt('0', dokumT('optPerPageAuto', lang)),
                  ...[10, 15, 20, 25, 30, 50].map((n) => opt(String(n), String(n))),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pFilterBlock', lang)}>
              <ShowHide value={showFilterCriteria} onChange={setShowFilterCriteria} lang={lang} />
            </ParamRow>

            <ParamRow label={dokumT('pShowDate', lang)}>
              <YesNo value={showDate} onChange={setShowDate} lang={lang} />
            </ParamRow>

            <ParamRow label={dokumT('pPageNumbers', lang)}>
              <YesNo value={showPageNumbers} onChange={setShowPageNumbers} lang={lang} />
            </ParamRow>

            <ParamRow label={dokumT('pOutput', lang)}>
              <ParamSelect
                value={output}
                onChange={setOutput}
                options={[
                  opt('excel', dokumT('optOutputExcel', lang)),
                  opt('pdf', dokumT('optOutputPdf', lang)),
                  opt('screen', dokumT('optOutputScreen', lang)),
                ]}
              />
            </ParamRow>

            <ParamRow label={dokumT('pEmail', lang)}>
              <ParamSelect
                value={emailMode}
                onChange={setEmailMode}
                options={[
                  opt('none', dokumT('optEmailNone', lang)),
                  opt('send', dokumT('optEmailSend', lang)),
                ]}
              />
            </ParamRow>

            {emailMode === 'send' && (
              <ParamRow label={`→ ${dokumT('pEmail', lang)}`}>
                <input
                  className="input"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder={dokumT('emailToPlaceholder', lang)}
                  style={SELECT_STYLE}
                />
              </ParamRow>
            )}

            <ParamRow label={dokumT('pFont', lang)}>
              <ParamSelect
                value={fontName}
                onChange={setFontName}
                options={FONTS.map((f) => opt(f, f))}
              />
            </ParamRow>

            <ParamRow label={dokumT('pShowFooter', lang)}>
              <YesNo value={showFooter} onChange={setShowFooter} lang={lang} />
            </ParamRow>
          </div>
        </div>

        <div
          className="flex items-center justify-center gap-2"
          style={{ padding: '8px 10px 12px', flexWrap: 'wrap' }}
        >
          <button
            className="btn btn-primary"
            style={{ fontSize: 12 }}
            disabled={busy || !canExport}
            onClick={run}
          >
            {busy ? '…' : `▶ ${dokumT('btnRun', lang)}`}
          </button>
          {plan && (
            <>
              <button
                className="btn btn-outline"
                style={{ fontSize: 12 }}
                onClick={() => downloadExcel(plan)}
              >
                ⬇ {dokumT('btnExcel', lang)}
              </button>
              <button
                className="btn btn-outline"
                style={{ fontSize: 12 }}
                onClick={() => openPrint(plan)}
              >
                🖨 {dokumT('btnPrint', lang)}
              </button>
            </>
          )}
        </div>
      </div>

      {plan && (
        <div className="card" style={{ padding: 10 }}>
          <div
            style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-mute)' }}
          >
            {plan.title} · {rowCount} {dokumT('rowsCount', lang)}
          </div>
          <PlanPreview plan={plan} />
        </div>
      )}

      {pickerOpen && (
        <ColumnPicker
          selected={columns}
          lang={lang}
          onApply={setColumns}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rapor merkezi (liste + seçilen rapor)                               */
/* ------------------------------------------------------------------ */

const REPORTS = [
  { id: 'payroll_dokum', icon: '🧾', titleKey: 'dokumCardTitle', descKey: 'dokumCardDesc' },
];

export default function HrReportsManager({
  data,
  lang = 'tr',
  notify,
  company,
  helpers = {},
  canExport = true,
}) {
  const [active, setActive] = useState(null);

  if (active === 'payroll_dokum') {
    return (
      <PayrollDokumScreen
        data={data}
        lang={lang}
        notify={notify}
        company={company}
        helpers={helpers}
        canExport={canExport}
        onBack={() => setActive(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="card p-3">
        <div style={{ fontSize: 13, fontWeight: 700 }}>📊 {dokumT('reportsTitle', lang)}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 3 }}>
          {dokumT('reportsSubtitle', lang)}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 10,
        }}
      >
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => setActive(r.id)}
            className="card"
            style={{
              padding: 12,
              textAlign: 'left',
              cursor: 'pointer',
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{r.icon}</span>
            <span>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700 }}>
                {dokumT(r.titleKey, lang)}
              </span>
              <span
                style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', marginTop: 3 }}
              >
                {dokumT(r.descKey, lang)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
