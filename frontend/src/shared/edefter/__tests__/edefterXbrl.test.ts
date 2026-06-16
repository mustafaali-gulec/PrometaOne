/* edefterXbrl.js bilinçli olarak saf JS (framework-agnostik); test, tipsiz
   modülü tükettiği için type-aware "no-unsafe-*" kuralları bu dosyada kapalı. */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect } from 'vitest';

// @ts-expect-error - plain JS module, no type declarations
import {
  buildYevmiyeXbrl,
  buildKebirXbrl,
  gibDefterFileName,
  selectPeriodEntries,
  missingProfileFields,
} from '../edefterXbrl.js';

const profile = {
  vkn: '1234567890',
  unvan: 'Test Anonim Şirketi',
  isPerson: false,
  phone: '03121111111',
  email: 'info@test.com.tr',
  address: {
    buildingNumber: '10',
    street: 'Atatürk Cd',
    city: 'Ankara',
    zip: '06100',
    country: 'Türkiye',
  },
  accountant: { name: 'SMMM Ali Veli', engagement: 'Sözleşme 2026' },
  creator: 'Mustafa',
};

const accounts = [
  { code: '100', name: 'KASA' },
  { code: '100.01', name: 'TL Kasası' },
  { code: '120', name: 'ALICILAR' },
  { code: '600', name: 'YURTİÇİ SATIŞLAR' },
  { code: '391', name: 'HESAPLANAN KDV' },
];

const entries = [
  {
    voucherNo: 'TAH-2026-00001',
    voucherType: 'receipt',
    status: 'posted',
    date: '2026-06-15',
    entryTime: '10:30',
    yevmiyeMaddeNo: '',
    description: 'Peşin satış',
    createdBy: 'admin',
    approvedByName: 'Sistem Yöneticisi',
    lines: [
      { accountCode: '100.01', description: 'Kasa girişi', debit: 1200, credit: 0 },
      { accountCode: '600', description: 'Satış', debit: 0, credit: 1000 },
      { accountCode: '391', description: 'KDV', debit: 0, credit: 200 },
    ],
  },
  {
    voucherNo: 'MAH-2026-00001',
    voucherType: 'compound',
    status: 'posted',
    date: '2026-06-10',
    entryTime: '09:00',
    yevmiyeMaddeNo: '',
    description: 'Devir',
    createdBy: 'admin',
    approvedByName: 'Sistem Yöneticisi',
    lines: [
      { accountCode: '100', description: 'Kasa', debit: 500, credit: 0 },
      { accountCode: '120', description: 'Alıcı', debit: 0, credit: 500 },
    ],
  },
  // Farklı aya ait — defterde olmamalı
  {
    voucherNo: 'MAH-2026-00099',
    voucherType: 'compound',
    status: 'posted',
    date: '2026-05-01',
    entryTime: '09:00',
    description: 'Mayıs',
    lines: [
      { accountCode: '100', description: 'x', debit: 10, credit: 0 },
      { accountCode: '120', description: 'y', debit: 0, credit: 10 },
    ],
  },
  // Taslak — defterde olmamalı
  {
    voucherNo: 'MAH-2026-00100',
    voucherType: 'compound',
    status: 'draft',
    date: '2026-06-20',
    entryTime: '09:00',
    description: 'taslak',
    lines: [
      { accountCode: '100', description: 'x', debit: 10, credit: 0 },
      { accountCode: '120', description: 'y', debit: 0, credit: 10 },
    ],
  },
];

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}
function tags(doc: Document, name: string): Element[] {
  return Array.from(doc.getElementsByTagName(name));
}

describe('gibDefterFileName', () => {
  it('formats {vkn}-{YYYYMM}-{type}-{part}.xml', () => {
    expect(gibDefterFileName('1234567890', 2026, 6, 'Y', 0)).toBe('1234567890-202606-Y-000000.xml');
    expect(gibDefterFileName('1234567890', 2026, 12, 'K', 3)).toBe(
      '1234567890-202612-K-000003.xml',
    );
  });
});

describe('selectPeriodEntries', () => {
  it('only posted entries of the given month, sorted by date', () => {
    const sel = selectPeriodEntries(entries, 2026, 6);
    expect(sel.map((e: any) => e.voucherNo)).toEqual(['MAH-2026-00001', 'TAH-2026-00001']);
  });
});

describe('buildYevmiyeXbrl', () => {
  const xml = buildYevmiyeXbrl({ profile, year: 2026, month: 6, entries, accounts });
  const doc = parse(xml);

  it('is well-formed XML rooted at edefter:defter', () => {
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    expect(tags(doc, 'edefter:defter').length).toBe(1);
    expect(tags(doc, 'xbrli:xbrl').length).toBe(1);
    expect(tags(doc, 'gl-cor:accountingEntries').length).toBe(1);
  });

  it('documentInfo: journal type, 15-char uniqueID starting YEV, matching period', () => {
    expect(tags(doc, 'gl-cor:entriesType')[0].textContent).toBe('journal');
    const uid = tags(doc, 'gl-cor:uniqueID')[0].textContent;
    expect(uid).toMatch(/^YEV/);
    expect(uid.length).toBe(15);
    expect(uid).toContain('202606');
    expect(tags(doc, 'gl-cor:periodCoveredStart')[0].textContent).toBe('2026-06-01');
    expect(tags(doc, 'gl-cor:periodCoveredEnd')[0].textContent).toBe('2026-06-30');
  });

  it('has one entryHeader per posted entry, in date order', () => {
    const headers = tags(doc, 'gl-cor:entryHeader');
    expect(headers.length).toBe(2);
    const dates = tags(doc, 'gl-cor:enteredDate').map((e) => e.textContent);
    expect(dates).toEqual(['2026-06-10', '2026-06-15']);
  });

  it('each entry: totalDebit == totalCredit == sum of side amounts', () => {
    tags(doc, 'gl-cor:entryHeader').forEach((h) => {
      const td = Number(h.getElementsByTagName('gl-bus:totalDebit')[0].textContent);
      const tc = Number(h.getElementsByTagName('gl-bus:totalCredit')[0].textContent);
      expect(td).toBe(tc);
      let d = 0,
        c = 0;
      Array.from(h.getElementsByTagName('gl-cor:entryDetail')).forEach((det) => {
        const amt = Number(det.getElementsByTagName('gl-cor:amount')[0].textContent);
        expect(amt).toBeGreaterThan(0);
        const code = det.getElementsByTagName('gl-cor:debitCreditCode')[0].textContent;
        if (code === 'D') d += amt;
        else c += amt;
      });
      expect(d).toBe(td);
      expect(c).toBe(tc);
    });
  });

  it('lineNumber is gapless sequential across the whole defter', () => {
    const nums = tags(doc, 'gl-cor:lineNumber').map((e) => Number(e.textContent));
    expect(nums).toEqual([1, 2, 3, 4, 5]); // 2 + 3 lines
  });

  it('lineNumberCounter equals parent entryNumberCounter', () => {
    tags(doc, 'gl-cor:entryHeader').forEach((h) => {
      const ec = h.getElementsByTagName('gl-cor:entryNumberCounter')[0].textContent;
      Array.from(h.getElementsByTagName('gl-cor:lineNumberCounter')).forEach((lc) => {
        expect(lc.textContent).toBe(ec);
      });
    });
  });

  it('entryNumberCounter is müteselsil (1..N)', () => {
    const counters = tags(doc, 'gl-cor:entryNumberCounter').map((e) => Number(e.textContent));
    expect(counters).toEqual([1, 2]);
  });

  it('accountSubID starts with accountMainID', () => {
    tags(doc, 'gl-cor:accountSub').forEach((sub) => {
      const subId = sub.getElementsByTagName('gl-cor:accountSubID')[0].textContent;
      const main = sub.parentElement!.getElementsByTagName('gl-cor:accountMainID')[0].textContent;
      expect(subId.startsWith(main)).toBe(true);
    });
  });

  it('postingDate == enteredDate and documentReference == entryNumber within each entry', () => {
    tags(doc, 'gl-cor:entryHeader').forEach((h) => {
      const ed = h.getElementsByTagName('gl-cor:enteredDate')[0].textContent;
      const en = h.getElementsByTagName('gl-cor:entryNumber')[0].textContent;
      Array.from(h.getElementsByTagName('gl-cor:entryDetail')).forEach((det) => {
        expect(det.getElementsByTagName('gl-cor:postingDate')[0].textContent).toBe(ed);
        expect(det.getElementsByTagName('gl-cor:documentReference')[0].textContent).toBe(en);
      });
    });
  });

  it('mandatory entityInformation fields present', () => {
    expect(tags(doc, 'gl-bus:phoneNumber')[0].textContent).toBe('03121111111');
    expect(tags(doc, 'gl-bus:entityEmailAddress')[0].textContent).toBe('info@test.com.tr');
    expect(tags(doc, 'gl-bus:accountantName')[0].textContent).toBe('SMMM Ali Veli');
    expect(tags(doc, 'gl-bus:organizationDescription')[0].textContent).toBe('Kurum Unvanı');
  });

  it('all decimals attributes are INF', () => {
    Array.from(doc.getElementsByTagName('*')).forEach((node) => {
      const dec = node.getAttribute && node.getAttribute('decimals');
      if (dec != null) expect(dec).toBe('INF');
    });
  });
});

describe('buildKebirXbrl', () => {
  const xml = buildKebirXbrl({ profile, year: 2026, month: 6, entries, accounts });
  const doc = parse(xml);

  it('is well-formed, ledger type, KEB uniqueID', () => {
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    expect(tags(doc, 'gl-cor:entriesType')[0].textContent).toBe('ledger');
    expect(tags(doc, 'gl-cor:uniqueID')[0].textContent).toMatch(/^KEB/);
  });

  it('groups movements by account (one entryHeader per account)', () => {
    // accounts hit in June: 100.01, 600, 391, 100, 120 → 5 distinct codes
    const headers = tags(doc, 'gl-cor:entryHeader');
    expect(headers.length).toBe(5);
  });

  it('global debit total equals global credit total', () => {
    const d = tags(doc, 'gl-bus:totalDebit').reduce((s, e) => s + Number(e.textContent), 0);
    const c = tags(doc, 'gl-bus:totalCredit').reduce((s, e) => s + Number(e.textContent), 0);
    expect(d).toBe(c);
    expect(d).toBe(1700); // 1200 + 500
  });
});

describe('missingProfileFields', () => {
  it('flags missing GİB-required fields', () => {
    expect(missingProfileFields(profile)).toEqual([]);
    expect(missingProfileFields({ vkn: '1', unvan: 'X', address: {}, accountant: {} })).toEqual(
      expect.arrayContaining(['Telefon', 'E-posta', 'Bina no', 'Muhasebeci adı (SMMM)']),
    );
  });
});
