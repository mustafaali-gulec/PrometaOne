/**
 * EInvoiceInbox component testleri.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  einvoicesFixture,
  incomingPending,
  outgoingImported,
} from '../../../../test/fixtures/einvoiceFixtures';
import { EInvoiceInbox } from '../../presentation/components/EInvoiceInbox';

describe('<EInvoiceInbox />', () => {
  it('loading=true ise yükleniyor mesajı', () => {
    render(<EInvoiceInbox einvoices={[]} loading />);
    expect(screen.getByText(/Yükleniyor…/i)).toBeInTheDocument();
  });

  it('boş ise "E-fatura bulunamadı."', () => {
    render(<EInvoiceInbox einvoices={[]} />);
    expect(screen.getByText(/E-fatura bulunamadı/i)).toBeInTheDocument();
  });

  it('satırları + durum rozetlerini render eder (Bekliyor / Aktarıldı)', () => {
    render(<EInvoiceInbox einvoices={einvoicesFixture.einvoices} />);
    expect(screen.getByTestId('einvoice-inbox')).toBeInTheDocument();
    expect(screen.getByText('Tedarikçi A.Ş.')).toBeInTheDocument();
    expect(screen.getByText('Bekliyor')).toBeInTheDocument(); // incoming pending
    expect(screen.getByText('Aktarıldı')).toBeInTheDocument(); // outgoing imported
  });

  it('pending fatura için Aktar/Yok say butonları onImport/onIgnore tetikler', () => {
    const onImport = vi.fn();
    const onIgnore = vi.fn();
    render(<EInvoiceInbox einvoices={[incomingPending]} onImport={onImport} onIgnore={onIgnore} />);
    fireEvent.click(screen.getByText('Aktar'));
    expect(onImport).toHaveBeenCalledWith(incomingPending.id);
    fireEvent.click(screen.getByText('Yok say'));
    expect(onIgnore).toHaveBeenCalledWith(incomingPending.id);
  });

  it('aktarılmış fatura için aksiyon butonu yok', () => {
    const onImport = vi.fn();
    render(<EInvoiceInbox einvoices={[outgoingImported]} onImport={onImport} />);
    expect(screen.queryByText('Aktar')).toBeNull();
  });
});
