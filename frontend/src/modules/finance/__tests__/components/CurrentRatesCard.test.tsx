/**
 * CurrentRatesCard component testleri.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { currentRatesFixture } from '../../../../test/fixtures/einvoiceFixtures';
import { CurrentRatesCard } from '../../presentation/components/CurrentRatesCard';

describe('<CurrentRatesCard />', () => {
  it('loading=true ise yükleniyor mesajı', () => {
    render(<CurrentRatesCard rates={null} loading />);
    expect(screen.getByText(/Yükleniyor…/i)).toBeInTheDocument();
  });

  it('rates null ise "Kur verisi yok."', () => {
    render(<CurrentRatesCard rates={null} />);
    expect(screen.getByText(/Kur verisi yok/i)).toBeInTheDocument();
  });

  it('USD/EUR kurlarını 4 ondalıkla gösterir', () => {
    render(<CurrentRatesCard rates={currentRatesFixture} />);
    expect(screen.getByTestId('current-rates-card')).toBeInTheDocument();
    expect(screen.getByTestId('rate-usd')).toHaveTextContent('32.1500');
    expect(screen.getByTestId('rate-eur')).toHaveTextContent('35.0000');
    expect(screen.getByText('2026-05-31')).toBeInTheDocument();
  });

  it('USD/EUR ikisi de null ise "Kur verisi yok."', () => {
    render(<CurrentRatesCard rates={{ USD: null, EUR: null, date: null }} />);
    expect(screen.getByText(/Kur verisi yok/i)).toBeInTheDocument();
  });
});
