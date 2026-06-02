/**
 * InvoicesTable component testleri.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { invoiceFixture, invoicesFixture } from '../../../../test/fixtures/financeFixtures';
import { InvoicesTable } from '../../presentation/components/InvoicesTable';

describe('<InvoicesTable />', () => {
  it('loading=true ise yükleniyor mesajı gösterir', () => {
    render(<InvoicesTable invoices={[]} loading />);
    expect(screen.getByText(/Yükleniyor…/i)).toBeInTheDocument();
  });

  it('invoices boş ise "Fatura bulunamadı." gösterir', () => {
    render(<InvoicesTable invoices={[]} />);
    expect(screen.getByText(/Fatura bulunamadı/i)).toBeInTheDocument();
  });

  it('fatura satırlarını + durum rozetlerini render eder', () => {
    render(<InvoicesTable invoices={invoicesFixture.invoices} />);
    expect(screen.getByTestId('invoices-table')).toBeInTheDocument();
    expect(screen.getByText('Acme Ltd.')).toBeInTheDocument();
    expect(screen.getByText('Beta A.Ş.')).toBeInTheDocument();
    expect(screen.getByText('Kısmi')).toBeInTheDocument(); // status partial
    expect(screen.getByText('Gecikmiş')).toBeInTheDocument(); // status overdue
  });

  it('invoiceNo null ise "—" placeholder gösterir', () => {
    const noNo = { ...invoiceFixture, invoiceNo: null };
    render(<InvoicesTable invoices={[noNo]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it("onSelect verilince satır click callback'i tetikler", () => {
    const onSelect = vi.fn();
    render(<InvoicesTable invoices={[invoiceFixture]} onSelect={onSelect} />);
    const row = screen.getByText('Acme Ltd.').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(onSelect).toHaveBeenCalledWith(invoiceFixture.id);
  });
});
