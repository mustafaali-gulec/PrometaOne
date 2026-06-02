/**
 * EmployeesTable component testleri.
 *
 * Doğrulanan davranışlar:
 *   - loading=true → "Yükleniyor…" mesajı.
 *   - employees boş → "Çalışan bulunamadı." mesajı.
 *   - employee satırları render edilir; status label/renk doğru.
 *   - onSelect verilince satır click callback'i tetikler.
 *   - email/phone null ise "—" yer tutucusu gösterilir.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { employeeFixture } from '../../../../test/fixtures/hrFixtures';
import { EmployeesTable } from '../../presentation/components/EmployeesTable';

describe('<EmployeesTable />', () => {
  it('loading=true ise yükleniyor mesajı gösterir', () => {
    render(<EmployeesTable employees={[]} loading />);
    expect(screen.getByText(/Yükleniyor…/i)).toBeInTheDocument();
  });

  it('employees boş ise "Çalışan bulunamadı." gösterir', () => {
    render(<EmployeesTable employees={[]} />);
    expect(screen.getByText(/Çalışan bulunamadı/i)).toBeInTheDocument();
  });

  it("employee'leri satır olarak render eder + status badge (Aktif) gösterir", () => {
    render(<EmployeesTable employees={[employeeFixture]} />);
    expect(screen.getByText(employeeFixture.fullName)).toBeInTheDocument();
    expect(screen.getByText(employeeFixture.employeeNo)).toBeInTheDocument();
    expect(screen.getByText('Aktif')).toBeInTheDocument(); // status='active' label
  });

  it('null email/phone "—" placeholder ile gösterilir', () => {
    const noContact = { ...employeeFixture, email: null, phone: null };
    render(<EmployeesTable employees={[noContact]} />);
    // En az 2 tane "—" hücresi olmalı (email + phone)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("onSelect verilince satır click callback'i tetikler", () => {
    const onSelect = vi.fn();
    render(<EmployeesTable employees={[employeeFixture]} onSelect={onSelect} />);
    const row = screen.getByText(employeeFixture.fullName).closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(onSelect).toHaveBeenCalledWith(employeeFixture.id);
  });
});
