/**
 * CashPositionCard component testleri.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { cashPositionFixture } from '../../../../test/fixtures/financeFixtures';
import { CashPositionCard } from '../../presentation/components/CashPositionCard';

describe('<CashPositionCard />', () => {
  it('loading=true ise yükleniyor mesajı gösterir', () => {
    render(<CashPositionCard position={null} loading />);
    expect(screen.getByText(/Yükleniyor…/i)).toBeInTheDocument();
  });

  it('position=null ise "Hesap seçilmedi." gösterir', () => {
    render(<CashPositionCard position={null} />);
    expect(screen.getByText(/Hesap seçilmedi/i)).toBeInTheDocument();
  });

  it('hesap adı, tip rozeti ve güncel bakiyeyi render eder', () => {
    render(<CashPositionCard position={cashPositionFixture} />);
    expect(screen.getByTestId('cash-position-card')).toBeInTheDocument();
    expect(screen.getByText('Ana Kasa')).toBeInTheDocument();
    expect(screen.getByText('Kasa')).toBeInTheDocument(); // endpointType=kasa
    expect(screen.getByTestId('current-balance')).toHaveTextContent('4500.00');
    expect(screen.getByTestId('current-balance')).toHaveTextContent('TRY');
  });

  it('banka hesabında "Banka" rozeti gösterir', () => {
    render(
      <CashPositionCard
        position={{ ...cashPositionFixture, endpointType: 'bank', name: 'İş Bank' }}
      />,
    );
    expect(screen.getByText('Banka')).toBeInTheDocument();
  });
});
