/**
 * BudgetMatrix domain servis testleri.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Category } from '../../domain/entities/Category.js';
import { Cell } from '../../domain/entities/Cell.js';
import { BudgetMatrix } from '../../domain/services/BudgetMatrix.js';
import type { CategorySection } from '../../domain/valueObjects/CategorySection.js';
import { FiscalYear } from '../../domain/valueObjects/FiscalYear.js';
import { Money } from '../../domain/valueObjects/Money.js';
import { MonthIndex } from '../../domain/valueObjects/MonthIndex.js';

const NOW = new Date('2026-01-01T00:00:00Z');

function cat(id: number, section: CategorySection, name: string, sortOrder = 0): Category {
  return Category.create({
    id,
    companyId: 100,
    section,
    name,
    sortOrder,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function cell(categoryId: number, monthIdx: number, major: number): Cell {
  return Cell.create({
    id: categoryId * 100 + monthIdx,
    companyId: 100,
    categoryId,
    fiscalYear: FiscalYear.create(2026),
    monthIdx: MonthIndex.create(monthIdx),
    value: Money.fromMajor(major, 'TRY'),
    updatedAt: NOW,
    updatedBy: null,
  });
}

describe('BudgetMatrix.build', () => {
  it('boş kategori → her section boş, P&L net sıfır', () => {
    const result = BudgetMatrix.build({
      currency: 'TRY',
      fiscalYear: 2026,
      categories: [],
      cells: [],
    });
    assert.equal(result.sections.length, 4); // 4 section her zaman var
    for (const s of result.sections) {
      assert.equal(s.rows.length, 0);
      assert.equal(s.sectionTotal.minorValue, 0);
    }
    assert.equal(result.pnlNetTotal.minorValue, 0);
  });

  it('cell olmayan ay Money.zero ile dolar — her satır 12 sütun', () => {
    const result = BudgetMatrix.build({
      currency: 'TRY',
      fiscalYear: 2026,
      categories: [cat(1, 'inflows', 'Satış')],
      cells: [cell(1, 0, 1000)], // sadece Ocak
    });
    const inflows = result.sections.find((s) => s.section === 'inflows')!;
    assert.equal(inflows.rows.length, 1);
    assert.equal(inflows.rows[0]!.months.length, 12);
    assert.equal(inflows.rows[0]!.months[0]!.toDecimalString(), '1000.00'); // Ocak
    assert.equal(inflows.rows[0]!.months[1]!.toDecimalString(), '0.00'); // Şubat
    assert.equal(inflows.rows[0]!.rowTotal.toDecimalString(), '1000.00');
  });

  it('satır + sütun + section toplamları', () => {
    const result = BudgetMatrix.build({
      currency: 'TRY',
      fiscalYear: 2026,
      categories: [cat(1, 'inflows', 'Satış', 0), cat(2, 'inflows', 'Diğer Gelir', 1)],
      cells: [cell(1, 0, 1000), cell(1, 1, 2000), cell(2, 0, 500), cell(2, 1, 500)],
    });
    const inflows = result.sections.find((s) => s.section === 'inflows')!;
    // Satır toplamları
    assert.equal(inflows.rows[0]!.rowTotal.toDecimalString(), '3000.00'); // 1000+2000
    assert.equal(inflows.rows[1]!.rowTotal.toDecimalString(), '1000.00'); // 500+500
    // Aylık sütun toplamları
    assert.equal(inflows.monthlyTotals[0]!.toDecimalString(), '1500.00'); // Ocak: 1000+500
    assert.equal(inflows.monthlyTotals[1]!.toDecimalString(), '2500.00'); // Şubat: 2000+500
    // Section toplamı
    assert.equal(inflows.sectionTotal.toDecimalString(), '4000.00');
  });

  it('P&L net = inflows − outflows (nonPnl/kasa hariç)', () => {
    const result = BudgetMatrix.build({
      currency: 'TRY',
      fiscalYear: 2026,
      categories: [
        cat(1, 'inflows', 'Satış'),
        cat(2, 'outflows', 'Kira'),
        cat(3, 'nonPnlOutflows', 'Kredi Anapara'),
        cat(4, 'kasaCategories', 'Kasa'),
      ],
      cells: [
        cell(1, 0, 10000), // inflow Ocak
        cell(2, 0, 3000), // outflow Ocak
        cell(3, 0, 5000), // nonPnl — net'e GİRMEZ
        cell(4, 0, 1000), // kasa — net'e GİRMEZ
      ],
    });
    // P&L net Ocak = 10000 − 3000 = 7000 (nonPnl ve kasa hariç)
    assert.equal(result.pnlNetMonthly[0]!.toDecimalString(), '7000.00');
    assert.equal(result.pnlNetTotal.toDecimalString(), '7000.00');
  });

  it('arşivli kategori matriste görünmez', () => {
    const archived = Category.create({
      id: 9,
      companyId: 100,
      section: 'inflows',
      name: 'Eski',
      sortOrder: 0,
      active: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const result = BudgetMatrix.build({
      currency: 'TRY',
      fiscalYear: 2026,
      categories: [archived, cat(1, 'inflows', 'Aktif', 1)],
      cells: [],
    });
    const inflows = result.sections.find((s) => s.section === 'inflows')!;
    assert.equal(inflows.rows.length, 1);
    assert.equal(inflows.rows[0]!.name, 'Aktif');
  });

  it('sortOrder ASC + id tie-break sıralaması', () => {
    const result = BudgetMatrix.build({
      currency: 'TRY',
      fiscalYear: 2026,
      categories: [cat(3, 'inflows', 'C', 1), cat(1, 'inflows', 'A', 0), cat(2, 'inflows', 'B', 0)],
      cells: [],
    });
    const inflows = result.sections.find((s) => s.section === 'inflows')!;
    // sortOrder 0: id 1 (A), id 2 (B); sonra sortOrder 1: id 3 (C)
    assert.deepEqual(
      inflows.rows.map((r) => r.name),
      ['A', 'B', 'C'],
    );
  });
});
