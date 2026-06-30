import { describe, it, expect } from 'vitest';

import { reconcileAppState, computeRealScore, isValidBlob } from './reconcileAppState.js';

// DEFAULT_SEED imzasını taklit eden tohum blob (gerçek-veri dizileri boş, demo nakit-akış +
// tohum katalogları tam taban sayılarında). computeRealScore bunu 0 saymalı.
function seedCompany() {
  return {
    // gerçek-veri dizileri (tohumda boş)
    hrEmployees: [],
    invoices: [],
    accJournalEntries: [],
    accParties: [],
    kasaEntries: [],
    bankEntries: [],
    bankAccounts: [],
    checkAccounts: [],
    loans: [],
    checks: [],
    crmDeals: [],
    projects: [],
    hrJobTitles: [],
    hrPositions: [],
    taskTemplates: [],
    customDashboards: [],
    accFiscalPeriods: [],
    // tohum-katalog alanları (taban sayılarında)
    inflows: new Array(10).fill({ a: 1 }),
    outflows: new Array(23).fill({ a: 1 }),
    nonPnlOutflows: new Array(6).fill({ a: 1 }),
    accChartOfAccounts: new Array(326).fill({ a: 1 }),
    kasaCategories: new Array(12).fill({ a: 1 }),
    kasaAccounts: new Array(1).fill({ a: 1 }), // 1 varsayılan Merkez Kasa
    hrDepartments: new Array(8).fill({ a: 1 }),
    hrPayrollComponents: new Array(18).fill({ a: 1 }),
    hrQuestions: new Array(13).fill({ a: 1 }),
    hrInterviewKits: new Array(3).fill({ a: 1 }),
    hrCompPolicies: new Array(4).fill({ a: 1 }),
    hrOrgUnits: new Array(1).fill({ a: 1 }),
    cells: {},
    openingCash: 0,
  };
}
function seedBlob(extra = {}) {
  return {
    companies: [{ id: 'comp_promet', name: 'Promet AŞ' }],
    activeCompanyId: 'comp_promet',
    companyData: { comp_promet: seedCompany() },
    ...extra,
  };
}
// Tohum + belirli gerçek alanlar dolu
function blobWith(fields = {}, extra = {}) {
  const b = seedBlob();
  Object.assign(b.companyData.comp_promet, fields);
  return { ...b, ...extra };
}
// Eski (companyData'sız) DÜZ format blob
function legacyBlob(fields = {}) {
  return { activeCompanyId: 'comp_legacy', ...seedCompany(), ...fields };
}

describe('computeRealScore', () => {
  it('tohum blob → 0 (demo nakit-akış ve kataloglar taban düşülerek sayılmaz)', () => {
    expect(computeRealScore(seedBlob())).toBe(0);
  });
  it('işlem kayıtlarını sayar', () => {
    expect(
      computeRealScore(
        blobWith({ hrEmployees: new Array(5).fill({}), invoices: new Array(3).fill({}) }),
      ),
    ).toBe(8);
  });
  it('KATALOG alanlarını da sayar (bankAccounts/hrJobTitles/kasaAccounts taban-üstü)', () => {
    const b = blobWith({
      bankAccounts: new Array(8).fill({}),
      hrJobTitles: new Array(40).fill({}),
      kasaAccounts: new Array(4).fill({}), // taban 1 → +3
      checkAccounts: new Array(2).fill({}),
    });
    expect(computeRealScore(b)).toBe(8 + 40 + 3 + 2);
  });
  it('cells (hesap tablosu) ve openingCash sinyalini sayar', () => {
    expect(
      computeRealScore(
        blobWith({ cells: { '1-1': { v: 5 }, '2-3': { v: 9 } }, openingCash: 1000 }),
      ),
    ).toBe(3);
  });
  it('legacy düz-format (companyData yok) kökü tarar', () => {
    expect(
      computeRealScore(
        legacyBlob({ hrEmployees: new Array(80).fill({}), invoices: new Array(300).fill({}) }),
      ),
    ).toBe(380);
    expect(computeRealScore(legacyBlob())).toBe(0);
  });
  it('boş çoklu-şirket yapay puan vermez; gerçek veri varsa +1', () => {
    const empty2 = seedBlob({ companies: [{ id: 'a' }, { id: 'b' }] });
    expect(computeRealScore(empty2)).toBe(0);
    const real2 = blobWith(
      { invoices: new Array(2).fill({}) },
      { companies: [{ id: 'a' }, { id: 'b' }] },
    );
    expect(computeRealScore(real2)).toBe(3); // 2 fatura + 1 çoklu-şirket
  });
  it('null/garip girdi → 0', () => {
    expect(computeRealScore(null)).toBe(0);
    expect(computeRealScore(42)).toBe(0);
  });
});

describe('isValidBlob', () => {
  it('companyData/companies/activeCompanyId olan nesne geçerli', () => {
    expect(isValidBlob(seedBlob())).toBe(true);
    expect(isValidBlob({ activeCompanyId: 'x' })).toBe(true);
  });
  it('boş/null/ilgisiz → false', () => {
    expect(isValidBlob(null)).toBe(false);
    expect(isValidBlob({})).toBe(false);
    expect(isValidBlob({ foo: 1 })).toBe(false);
  });
});

describe('reconcileAppState — DEĞİŞMEZ GÜVENLİK (yerel otoriter, sessiz kayıp YOK)', () => {
  it('GERÇEK yerel (işlem) vs TOHUM uzak → push-local', () => {
    const d = reconcileAppState(
      blobWith({ hrEmployees: new Array(42).fill({}) }),
      seedBlob(),
      'ok',
    );
    expect(d.action).toBe('push-local');
    expect(d.localScore).toBeGreaterThan(0);
  });

  it('REGRESYON: yalnızca KATALOG verisi olan yerel (bankAccounts/hrJobTitles/kasaAccounts) vs TOHUM uzak → push-local (29 Haz kaybının asıl deliği)', () => {
    const local = blobWith({
      bankAccounts: new Array(8).fill({}),
      hrJobTitles: new Array(40).fill({}),
      kasaAccounts: new Array(5).fill({}),
    });
    const d = reconcileAppState(local, seedBlob(), 'ok');
    expect(d.action).toBe('push-local'); // ASLA adopt-remote olmamalı
  });

  it('GERÇEK yerel vs BOŞ/geçersiz uzak → keep-local', () => {
    const local = blobWith({ invoices: new Array(10).fill({}) });
    expect(reconcileAppState(local, {}, 'ok').action).toBe('keep-local');
    expect(reconcileAppState(local, null, 'ok').action).toBe('keep-local');
  });

  it('GERÇEK yerel vs FARKLI ama eşit-hacim uzak → push-local (yerel korunur, eşit-skor adopt YOK)', () => {
    const local = blobWith({ invoices: new Array(20).fill({}) });
    const remote = blobWith({ hrEmployees: new Array(20).fill({}) });
    expect(reconcileAppState(local, remote, 'ok').action).toBe('push-local');
  });

  it('GERÇEK yerel vs DAHA ZENGİN uzak → yine push-local (yerel otoriter; sync-siz yerel ezilmez)', () => {
    const local = blobWith({ invoices: new Array(3).fill({}) });
    const remote = blobWith({ hrEmployees: new Array(100).fill({}) });
    expect(reconcileAppState(local, remote, 'ok').action).toBe('push-local');
  });
});

describe('reconcileAppState — meşru cihazlar-arası senkron (yalnızca yerel boş/tohum iken adopt)', () => {
  it('backend 404 → seed-backend', () => {
    expect(reconcileAppState(blobWith({ hrEmployees: [{}] }), null, 'missing').action).toBe(
      'seed-backend',
    );
  });
  it('BOŞ/TOHUM yerel vs GERÇEK uzak → adopt-remote (yeni cihaz)', () => {
    expect(
      reconcileAppState(seedBlob(), blobWith({ hrEmployees: new Array(7).fill({}) }), 'ok').action,
    ).toBe('adopt-remote');
  });
  it('REGRESYON: TOHUM yerel vs GERÇEK ama LEGACY düz-format uzak → adopt-remote (legacy skoru 0 sayılmaz)', () => {
    const remote = legacyBlob({
      hrEmployees: new Array(80).fill({}),
      invoices: new Array(300).fill({}),
    });
    expect(computeRealScore(remote)).toBe(380);
    expect(reconcileAppState(seedBlob(), remote, 'ok').action).toBe('adopt-remote');
  });
  it('yerel geçersiz/null vs geçerli gerçek uzak → adopt-remote', () => {
    expect(reconcileAppState(null, blobWith({ invoices: [{}] }), 'ok').action).toBe('adopt-remote');
    expect(reconcileAppState({}, blobWith({ invoices: [{}] }), 'ok').action).toBe('adopt-remote');
  });
  it('yerel geçersiz vs uzak da tohum → keep-local (kayıp yok)', () => {
    expect(reconcileAppState({}, seedBlob(), 'ok').action).toBe('keep-local');
  });
});

describe('reconcileAppState — uzak erişilemez / iki taraf tohum', () => {
  it('offline → keep-local', () => {
    expect(reconcileAppState(blobWith({ invoices: [{}] }), null, 'offline').action).toBe(
      'keep-local',
    );
  });
  it('error → keep-local', () => {
    expect(reconcileAppState(seedBlob(), null, 'error').action).toBe('keep-local');
  });
  it('iki tohum → keep-local (sessiz ezme yok)', () => {
    expect(reconcileAppState(seedBlob(), seedBlob(), 'ok').action).toBe('keep-local');
  });
});
