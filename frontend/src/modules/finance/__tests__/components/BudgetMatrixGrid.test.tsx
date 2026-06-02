/**
 * BudgetMatrixGrid component testleri.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { budgetMatrixFixture } from '../../../../test/fixtures/financeFixtures';
import { BudgetMatrixGrid } from '../../presentation/components/BudgetMatrixGrid';

describe('<BudgetMatrixGrid />', () => {
  it('loading=true ise yükleniyor mesajı gösterir', () => {
    render(<BudgetMatrixGrid matrix={null} loading />);
    expect(screen.getByText(/Yükleniyor…/i)).toBeInTheDocument();
  });

  it('matrix=null ise "Bütçe verisi yok." gösterir', () => {
    render(<BudgetMatrixGrid matrix={null} />);
    expect(screen.getByText(/Bütçe verisi yok/i)).toBeInTheDocument();
  });

  it('kategori satırlarını ve P&L net toplamını render eder', () => {
    render(<BudgetMatrixGrid matrix={budgetMatrixFixture} />);
    expect(screen.getByTestId('budget-matrix')).toBeInTheDocument();
    expect(screen.getByText('Satış')).toBeInTheDocument();
    expect(screen.getByText('Kira')).toBeInTheDocument();
    expect(screen.getByText('Nakit Girişleri')).toBeInTheDocument();
    expect(screen.getByTestId('pnl-net-total')).toHaveTextContent('19000.00');
  });

  it('boş section için "(kategori yok)" placeholder gösterir', () => {
    render(<BudgetMatrixGrid matrix={budgetMatrixFixture} />);
    // nonPnlOutflows + kasaCategories boş → en az 2 placeholder
    expect(screen.getAllByText('(kategori yok)').length).toBeGreaterThanOrEqual(2);
  });
});
