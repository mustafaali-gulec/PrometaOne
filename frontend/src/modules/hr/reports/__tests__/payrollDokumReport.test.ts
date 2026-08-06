import { describe, expect, it } from 'vitest';

import {
  buildPayrollDokumModel,
  buildPayrollDokumPlan,
  DEFAULT_PAYROLL_DOKUM_COLUMNS,
  isoToExcelSerial,
  isoToTrDisplay,
  mergeMapsOf,
  payrollDokumFileName,
  planToWorkbook,
  planToWorksheet,
  SUMMARY_PAYROLL_DOKUM_COLUMNS,
} from '../payrollDokumReport';
import type {
  PayrollDokumCompany,
  PayrollDokumOptions,
  PayrollDokumSourceRow,
} from '../payrollDokumReport';

const company: PayrollDokumCompany = {
  name: 'GÜÇLÜ CİVATA MAKİNA LTD.ŞTİ',
  address: 'ALINTERİ BULVARI 9.SOKAK NO:17',
  taxOffice: '006271/OSTİM VERGİ DAİRESİ MÜDÜRLÜĞÜ',
  taxNumber: '4120152213',
  mersisNo: '',
  sgkWorkplaceNo: '',
  sgkBranch: '',
};

const baseOptions: PayrollDokumOptions = {
  lang: 'tr',
  layout: 'detailed',
  wageBasis: 'total',
  showFilterBlock: true,
  showFilterCriteria: false,
  showTotals: true,
  showIcmal: false,
  showComponentTotals: false,
  showPreparerSign: false,
  showCheckerSign: false,
  showApproverSign: false,
  showDate: false,
  showPageNumbers: false,
  showFooter: false,
  missingDayMode: 'single',
  tablePlacement: 'separate',
  pageBreak: 'none',
  employeesPerPage: 0,
  currency: 'TRY',
  fxRate: 1,
  rateBasis: 'buying',
  rateDate: null,
  fontName: 'Arial',
  generatedAt: '2026-07-29',
};

/** Referans dökümdeki "ABDULLAH ORDU" satırının motor karşılığı. */
function abdullah(): PayrollDokumSourceRow {
  return {
    employeeId: 'e1',
    fullName: 'ABDULLAH ORDU',
    tcNo: '42955603486',
    startDate: '2022-06-01',
    exitDate: null,
    lawNo: '05510',
    sgkWorkplaceCode: 'A1',
    workplaceName: 'MERKEZ',
    departmentName: 'ÜRETİM',
    jobTitleName: 'OPERATÖR',
    iban: '',
    salaryType: 'net',
    agreedSalary: 45000,
    days: {
      overtimeNormalHours: 20,
      weekendDays: 0,
      sickDays: 0,
      annualLeaveDays: 0,
      unpaidLeaveDays: 0,
      absentDays: 0,
      workedDays: 22,
    },
    result: {
      period: { year: 2026, month: 6, sgkDays: 30, workdaysPerMonth: 22 },
      incomes: [
        { code: 'BRUT', name: 'Brüt Ücret', category: 'legal_income', amount: 60287.59 },
        {
          code: 'FM',
          name: 'Fazla Mesai',
          category: 'special_income',
          amount: 8365.42,
          _component: { calc: { method: 'per_hour', hourType: 'overtime_hours' } },
        },
        { code: 'YEMEK', name: 'Yemek', category: 'special_income', amount: 4000 },
      ],
      deductions: [
        { code: 'SGK_ISCI', name: 'SGK İşçi', category: 'legal_deduction', amount: 9611.42 },
        {
          code: 'ISSIZLIK_ISCI',
          name: 'İşsizlik İşçi',
          category: 'legal_deduction',
          amount: 686.53,
        },
        { code: 'GV', name: 'Gelir Vergisi', category: 'legal_deduction', amount: 7459.68 },
        { code: 'DV', name: 'Damga Vergisi', category: 'legal_deduction', amount: 270.38 },
        { code: 'AVANS', name: 'Avans', category: 'special_deduction', amount: 5000 },
      ],
      bases: {
        sgkBase: 68653.01,
        sgkBaseCapped: 68653.01,
        gvBase: 58355.05,
        gvCumulative: 338121.3,
        dvBase: 68653.01,
      },
      taxes: {
        sgkEmployee: 9611.42,
        unempEmployee: 686.53,
        sgkEmployer: 14243.5,
        unempEmployer: 1373.06,
        incomeTax: 7459.68,
        incomeTaxBeforeExemption: 12000,
        incomeTaxExempt: 4540.32,
        stampDuty: 270.38,
        stampDutyExempt: 200,
      },
      totals: {
        gross: 72653.01,
        net: 49625,
        totalDeductions: 23028.01,
        employerCostWithIncentives: 88269.57,
      },
    },
  };
}

/** Kısmi ay + ücretsiz izinli ikinci personel. */
function partial(): PayrollDokumSourceRow {
  const row = abdullah();
  return {
    ...row,
    employeeId: 'e2',
    fullName: 'ARİF ÖZTÜRK',
    tcNo: '13192796378',
    lawNo: '00000',
    salaryType: 'gross',
    agreedSalary: 33030,
    days: { ...row.days, unpaidLeaveDays: 3, annualLeaveDays: 2, overtimeNormalHours: 0 },
    result: {
      ...row.result,
      period: { year: 2026, month: 6, sgkDays: 27, workdaysPerMonth: 20 },
      incomes: [{ code: 'BRUT', name: 'Brüt Ücret', category: 'legal_income', amount: 33030 }],
      deductions: [
        { code: 'GV', name: 'Gelir Vergisi', category: 'legal_deduction', amount: 1756 },
      ],
      totals: {
        gross: 33030,
        net: 30000,
        totalDeductions: 3030,
        employerCostWithIncentives: 40000,
      },
    },
  };
}

const makeModel = (rows: PayrollDokumSourceRow[], opts: Partial<PayrollDokumOptions> = {}) => {
  const options = { ...baseOptions, ...opts };
  const model = buildPayrollDokumModel(
    {
      company,
      period: { year: 2026, month: 6 },
      filterLabels: { workplace: 'Tümü', department: 'Tümü' },
      criteria: 'İşyeri=Tümü',
      rows,
    },
    options,
  );
  return { model, options };
};

describe('buildPayrollDokumModel — sütun eşlemesi', () => {
  it('referans dökümdeki değerleri birebir üretir', () => {
    const { model } = makeModel([abdullah()]);
    const v = model.rows[0]!.values;
    expect(v.name).toBe('ABDULLAH ORDU');
    expect(v.tcNo).toBe('42955603486');
    expect(v.lawNo).toBe('05510');
    expect(v.totalDays).toBe(30);
    expect(v.normalEarning).toBe(60287.59);
    expect(v.totalEarning).toBe(72653.01);
    expect(v.otherEarning).toBe(12365.42); // Top.Kazanç − Nor.Kazanç
    expect(v.agi).toBe(0);
    expect(v.sgkBase).toBe(68653.01);
    expect(v.gvBase).toBe(58355.05);
    expect(v.gvCumulative).toBe(338121.3);
    expect(v.incomeTax).toBe(7459.68);
    expect(v.remainingTax).toBe(7459.68);
    expect(v.stampDuty).toBe(270.38);
    expect(v.specialDeduction).toBe(5000);
    expect(v.netPaid).toBe(49625);
    expect(v.signature).toBe('');
  });

  it('SSK İşçi/İşveren sütunları işsizlik payını içerir (satır aritmetiği kapanır)', () => {
    const { model } = makeModel([abdullah()]);
    const v = model.rows[0]!.values;
    expect(v.sgkEmployee).toBe(10297.95); // 9.611,42 + 686,53
    expect(v.sgkEmployer).toBe(15616.56); // 14.243,50 + 1.373,06
    const net =
      Number(v.totalEarning) -
      Number(v.sgkEmployee) -
      Number(v.incomeTax) -
      Number(v.stampDuty) -
      Number(v.specialDeduction);
    expect(Math.round(net * 100) / 100).toBe(49625);
  });

  it('Ücret G/S sütununu Toplam Kazanç ÷ T.Gün olarak hesaplar', () => {
    const { model } = makeModel([abdullah()]);
    expect(model.rows[0]!.values.wageBasis).toBe('2.421,77G');
  });

  it('"Brüt Ücretten Hesapla" seçildiğinde anlaşılan brütü 30 güne böler', () => {
    const { model } = makeModel([partial()], { wageBasis: 'gross' });
    expect(model.rows[0]!.values.wageBasis).toBe('1.101,00G');
  });

  it('Saatlik seçiminde S eki kullanır', () => {
    const { model } = makeModel([abdullah()], { wageBasis: 'hourly' });
    expect(model.rows[0]!.values.wageBasis).toBe('322,90S');
  });

  it('eksik günü 30 − SGK günü olarak yazar ve nedenini tek satırda ekler', () => {
    const { model } = makeModel([partial()]);
    expect(String(model.rows[0]!.values.missingDays)).toContain('3');
    expect(String(model.rows[0]!.values.missingDays)).toContain('Ücretsiz İzin');
  });

  it('eksik gün nedeni ayrı satır modunda ana hücrede yalnız sayı kalır', () => {
    const { model } = makeModel([partial()], { missingDayMode: 'separate' });
    expect(model.rows[0]!.values.missingDays).toBe('3');
    expect(model.rows[0]!.detailLines.some((l) => l.startsWith('Eksik Gün Nedeni'))).toBe(true);
  });
});

describe('buildPayrollDokumModel — açıklama satırları', () => {
  it('Avans → Normal Gün → Diğer kazançlar → Net Kazanç sırasını korur', () => {
    const { model } = makeModel([abdullah()]);
    const lines = model.rows[0]!.detailLines;
    expect(lines[0]).toBe('Avans: 5.000,00');
    expect(lines[1]).toBe('Normal Gün (30G): 45.000,00 N');
    expect(lines[2]).toBe('Fazla Mesai (20S): 8.365,42  Yemek: 4.000,00');
    expect(lines[3]).toBe('Net Kazanç: 49.625,00');
  });

  it('N/B ekini yalnız kök ücret satırına koyar (yan hak/kesintide ek yazmaz)', () => {
    const { model } = makeModel([abdullah()]);
    const lines = model.rows[0]!.detailLines;
    expect(lines.filter((l) => / [NB]$/.test(l) || / [NB] /.test(l))).toEqual([
      'Normal Gün (30G): 45.000,00 N',
    ]);
  });

  it('brüt ücretli personelde B eki ve gün kırılımı kullanır', () => {
    const { model } = makeModel([partial()]);
    const lines = model.rows[0]!.detailLines;
    expect(lines[0]).toBe(
      'Normal Gün (27G): 33.030,00 B  Yıllık İzin (2G)  Ücretsiz İzin (3G): 0,00',
    );
    expect(lines[lines.length - 1]).toBe('Net Kazanç: 30.000,00');
  });

  it('Özet Bordro yerleşiminde açıklama satırı üretmez', () => {
    const { model } = makeModel([abdullah()], {
      layout: 'summary',
      columns: SUMMARY_PAYROLL_DOKUM_COLUMNS.slice(),
    });
    expect(model.rows[0]!.detailLines).toHaveLength(0);
    expect(model.columns.map((c) => c.key)).toEqual([...SUMMARY_PAYROLL_DOKUM_COLUMNS]);
  });
});

describe('buildPayrollDokumModel — toplamlar, icmal, bileşen toplamları', () => {
  it('sayısal sütunların toplamını ve net toplamı hesaplar', () => {
    const { model } = makeModel([abdullah(), partial()]);
    expect(model.totals.totalEarning).toBe(105683.01);
    expect(model.totals.netPaid).toBe(79625);
    expect(model.totals.totalDays).toBe(57);
    expect(model.totalNet).toBe(79625);
  });

  it('icmali işyeri + kanun kırılımında gruplar', () => {
    const { model } = makeModel([abdullah(), partial()]);
    expect(model.icmal).toHaveLength(2);
    const laws = model.icmal.map((g) => g.lawNo).sort();
    expect(laws).toEqual(['00000', '05510']);
    expect(model.icmal.every((g) => g.headcount === 1)).toBe(true);
  });

  it('aynı işyeri+kanun içindeki personelleri tek icmal satırında toplar', () => {
    const second = { ...abdullah(), employeeId: 'e3', fullName: 'BEKİR POYRAZ' };
    const { model } = makeModel([abdullah(), second]);
    expect(model.icmal).toHaveLength(1);
    expect(model.icmal[0]!.headcount).toBe(2);
    expect(model.icmal[0]!.netPaid).toBe(99250);
  });

  it('kazanç/kesinti bileşen toplamlarını kod bazında biriktirir', () => {
    const { model } = makeModel([abdullah(), partial()]);
    const brut = model.componentTotals.find((c) => c.code === 'BRUT');
    expect(brut).toBeDefined();
    expect(brut!.kind).toBe('earning');
    expect(brut!.count).toBe(2);
    expect(brut!.total).toBe(93317.59);
    const gv = model.componentTotals.find((c) => c.code === 'GV');
    expect(gv!.kind).toBe('deduction');
    expect(gv!.total).toBe(9215.68);
  });
});

describe('buildPayrollDokumModel — döviz', () => {
  it('tutarları rapor para birimine çevirir, net toplam tutarlı kalır', () => {
    const { model } = makeModel([abdullah()], { currency: 'USD', fxRate: 40 });
    expect(model.currency).toBe('USD');
    expect(model.rows[0]!.values.totalEarning).toBe(1816.33);
    expect(model.rows[0]!.values.netPaid).toBe(1240.63);
    expect(model.totalNet).toBe(1240.63);
  });

  it('geçersiz kuru 1 kabul eder (TL değerleri korunur)', () => {
    const { model } = makeModel([abdullah()], { currency: 'USD', fxRate: 0 });
    expect(model.fxRate).toBe(1);
    expect(model.rows[0]!.values.netPaid).toBe(49625);
  });
});

describe('buildPayrollDokumPlan — yerleşim', () => {
  it('başlık bloğu + sütun başlıkları + veri/açıklama satırlarını sıralar', () => {
    const { model, options } = makeModel([abdullah()]);
    const plan = buildPayrollDokumPlan(model, options);
    const sheet = plan.sheets[0]!;
    const roles = sheet.rows.map((r) => r.role);
    expect(roles.slice(0, 7)).toEqual(['meta', 'meta', 'meta', 'meta', 'meta', 'meta', 'meta']);
    expect(roles[7]).toBe('spacer');
    expect(roles[8]).toBe('spacer');
    expect(roles[9]).toBe('thead');
    expect(roles[10]).toBe('data');
    expect(roles.slice(11, 15)).toEqual(['detail', 'detail', 'detail', 'detail']);
    expect(roles.filter((r) => r === 'total')).toHaveLength(2);
    expect(sheet.colCount).toBe(DEFAULT_PAYROLL_DOKUM_COLUMNS.length);
  });

  it('başlık bloğunun ilk satırı kurum adı ve adresi taşır', () => {
    const { model, options } = makeModel([abdullah()]);
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    const row0 = sheet.rows[0]!;
    expect(row0.cells[0]!.v).toBe('Kurum Adı');
    expect(row0.cells[2]!.v).toBe(company.name);
    expect(row0.cells[8]!.v).toBe('Adres');
    expect(row0.cells[11]!.v).toBe(company.address);
  });

  it('sütun başlıkları referans dökümle aynı kısaltmaları kullanır', () => {
    const { model, options } = makeModel([abdullah()]);
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    const headers = sheet.rows[9]!.cells.map((c) => c!.v);
    expect(headers).toEqual([
      '#',
      'Adı Soyadı',
      'TCKN',
      'Eksik Gün ',
      'Giriş T',
      'Çıkış T',
      'Kanun',
      'Ücret G/S',
      'T.Gün',
      'İz.Gün',
      'Nor.Kazanç',
      'AGİ',
      'Top.Kazanç',
      'Diğ.Kazanç',
      'SSK M.',
      'SSK İşveren',
      'SSK İşçi',
      'G.V.M',
      'Top.GVM',
      'Gel.Ver.',
      'Kalan GV',
      'Damga V',
      'Öz.Kesinti',
      'N.Ödenen',
      'İmza',
    ]);
  });

  it('toplam satırında SUM formülleri veri aralığını kapsar', () => {
    const { model, options } = makeModel([abdullah(), partial()]);
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    const totalRow = sheet.rows.find((r) => r.role === 'total')!;
    // K = Nor.Kazanç (11. sütun); veri bloğu 11. satırda başlar, 18. satırda biter
    // (1. personel: 1 ana + 4 açıklama, 2. personel: 1 ana + 2 açıklama satırı)
    expect(totalRow.cells[10]!.f).toBe('SUM(K11:K18)');
    expect(totalRow.cells[10]!.v).toBe(93317.59);
  });

  it('tarih hücrelerini Excel seri numarası + dd.MM.yyyy biçimiyle yazar', () => {
    const { model, options } = makeModel([abdullah()]);
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    const dataRow = sheet.rows[10]!;
    expect(dataRow.cells[4]!.z).toBe('dd.MM.yyyy');
    expect(dataRow.cells[4]!.v).toBe(isoToExcelSerial('2022-06-01'));
    expect(dataRow.cells[4]!.w).toBe('01.06.2022');
    expect(dataRow.cells[5]).toBeNull(); // çıkış tarihi yok
  });

  it('Filtre = Göster seçildiğinde kriter satırı ekler', () => {
    const { model, options } = makeModel([abdullah()], { showFilterCriteria: true });
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    const criteria = sheet.rows.find((r) => String(r.cells[0]?.v || '').startsWith('Filtre:'));
    expect(criteria).toBeDefined();
    expect(String(criteria!.cells[0]!.v)).toContain('İşyeri=Tümü');
  });

  it('Toplamlar = Gösterme seçildiğinde toplam satırı üretmez', () => {
    const { model, options } = makeModel([abdullah()], { showTotals: false });
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    expect(sheet.rows.some((r) => r.role === 'total')).toBe(false);
  });

  it('imza seçenekleri açıkken imza satırı ekler', () => {
    const { model, options } = makeModel([abdullah()], {
      showPreparerSign: true,
      showCheckerSign: true,
      showApproverSign: true,
    });
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    const sign = sheet.rows.find((r) => r.role === 'sign')!;
    const texts = sign.cells.filter(Boolean).map((c) => String(c!.v));
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain('Düzenleyen');
    expect(texts[2]).toContain('Onaylayan');
  });

  it('icmal/bileşen tablolarını ayrı sayfa olarak ekler', () => {
    const { model, options } = makeModel([abdullah()], {
      showIcmal: true,
      showComponentTotals: true,
    });
    const plan = buildPayrollDokumPlan(model, options);
    expect(plan.sheets).toHaveLength(3);
    expect(plan.sheets[1]!.rows[0]!.cells[0]!.v).toBe('İCMAL');
    expect(plan.sheets[2]!.rows[0]!.cells[0]!.v).toBe('KAZANÇ / KESİNTİ TOPLAMLARI');
  });

  it('"Aynı Tabloda Yazdır" seçiminde tabloları ana sayfaya gömer', () => {
    const { model, options } = makeModel([abdullah()], {
      showIcmal: true,
      showComponentTotals: true,
      tablePlacement: 'same',
    });
    const plan = buildPayrollDokumPlan(model, options);
    expect(plan.sheets).toHaveLength(1);
    expect(plan.sheets[0]!.rows.filter((r) => r.role === 'section')).toHaveLength(2);
  });

  it('her personel yeni sayfa seçildiğinde 2. personelden itibaren sayfa sonu işaretler', () => {
    const { model, options } = makeModel([abdullah(), partial()], { pageBreak: 'per_employee' });
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    const dataRows = sheet.rows.filter((r) => r.role === 'data');
    expect(dataRows[0]!.pageBreakBefore).toBeUndefined();
    expect(dataRows[1]!.pageBreakBefore).toBe(true);
  });

  it('sayfa başına personel sınırı sayfa sonlarını tetikler', () => {
    const rows = [abdullah(), partial(), { ...abdullah(), employeeId: 'e9' }];
    const { model, options } = makeModel(rows, { employeesPerPage: 2 });
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    const flags = sheet.rows
      .filter((r) => r.role === 'data')
      .map((r) => Boolean(r.pageBreakBefore));
    expect(flags).toEqual([false, false, true]);
  });

  it('altbilgi seçildiğinde footer satırı ve plan altbilgisi dolar', () => {
    const { model, options } = makeModel([abdullah()], { showFooter: true });
    const plan = buildPayrollDokumPlan(model, options);
    expect(plan.footer).toContain(company.name);
    expect(plan.sheets[0]!.rows.some((r) => r.role === 'footer')).toBe(true);
  });
});

describe('planToWorksheet / planToWorkbook', () => {
  it("hücreleri tip, biçim ve formülleriyle worksheet'e yazar", () => {
    const { model, options } = makeModel([abdullah()]);
    const plan = buildPayrollDokumPlan(model, options);
    const ws = planToWorksheet(plan.sheets[0]!);
    expect(ws['A1']).toMatchObject({ t: 's', v: 'Kurum Adı' });
    expect(ws['B11']).toMatchObject({ t: 's', v: 'ABDULLAH ORDU' });
    expect(ws['K11']).toMatchObject({ t: 'n', v: 60287.59, z: '#,##0.00' });
    expect(ws['I11']).toMatchObject({ t: 'n', v: 30, z: '###' });
    expect(ws['E11']).toMatchObject({ t: 'n', z: 'dd.MM.yyyy' });
    expect(ws['!ref']).toBe('A1:Y17');
    expect(Array.isArray(ws['!merges'])).toBe(true);
    expect(ws['!cols']).toHaveLength(25);
  });

  it('workbook sayfa adlarını tekilleştirir', () => {
    const { model, options } = makeModel([abdullah()], {
      showIcmal: true,
      showComponentTotals: true,
    });
    const wb = planToWorkbook(buildPayrollDokumPlan(model, options));
    expect(wb.SheetNames).toHaveLength(3);
    expect(new Set(wb.SheetNames).size).toBe(3);
    expect(wb.SheetNames[0]).toBe('HAZİRAN 2026');
  });
});

describe('yardımcılar', () => {
  it('isoToExcelSerial bilinen tarihleri doğru çevirir', () => {
    expect(isoToExcelSerial('1900-01-01')).toBe(2);
    expect(isoToExcelSerial('2026-06-01')).toBe(46174);
    expect(isoToExcelSerial('')).toBeNull();
    expect(isoToExcelSerial('01.06.2026')).toBeNull();
  });

  it('isoToTrDisplay gün.ay.yıl döndürür', () => {
    expect(isoToTrDisplay('2026-06-01')).toBe('01.06.2026');
    expect(isoToTrDisplay(null)).toBe('');
  });

  it('payrollDokumFileName dönem eklenmiş ad üretir', () => {
    const { model } = makeModel([abdullah()]);
    expect(payrollDokumFileName(model)).toBe('bordro-dokumu-2026-06');
  });

  it('mergeMapsOf anchor span ve atlanacak hücreleri döndürür', () => {
    const { model, options } = makeModel([abdullah()]);
    const sheet = buildPayrollDokumPlan(model, options).sheets[0]!;
    const { skip, span } = mergeMapsOf(sheet);
    expect(span.get('0:0')).toEqual({ colSpan: 2, rowSpan: 1 });
    expect(skip.has('0:1')).toBe(true);
    expect(skip.has('0:0')).toBe(false);
  });
});
