/**
 * FxCurrencyFields testleri — "dövizli tiki + kur kaynağı sorusu" akışı.
 *
 * Backend (`/v1/finance/fx/rates/at`) kapatılır (`useBackend={false}`); kurlar
 * yerel kur defterinden çözülür — böylece test ağdan bağımsızdır.
 */
import { useState } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { normalizeFxDraft, type FxDraft, type RateBook } from '../fxCore';
import { FxCurrencyFields } from '../FxCurrencyFields';

const rateBook: RateBook = {
  current: { USD: 40, EUR: 45 },
  history: [{ date: '15-07-2026', USD: 38, EUR: 42 }],
};

/** Draft'ı state'te tutan sarmalayıcı — gerçek form davranışını taklit eder. */
function Harness({
  initial = {},
  amount = 100,
  date = '2026-07-20',
  onDraft,
  ...rest
}: {
  initial?: FxDraft;
  amount?: number;
  date?: string;
  onDraft?: (d: FxDraft) => void;
} & Partial<React.ComponentProps<typeof FxCurrencyFields>>) {
  const [draft, setDraft] = useState<FxDraft>(initial);
  return (
    <FxCurrencyFields
      value={draft}
      amount={amount}
      date={date}
      rateBook={rateBook}
      useBackend={false}
      onChange={(patch) => {
        setDraft((d) => {
          const next = { ...d, ...patch };
          onDraft?.(next);
          return next;
        });
      }}
      {...rest}
    />
  );
}

describe('<FxCurrencyFields />', () => {
  it('tik kapalıyken yalnız açıklama gösterir, kur alanları gizlidir', () => {
    render(<Harness />);
    expect(screen.getByTestId('fx-toggle')).not.toBeChecked();
    expect(screen.queryByTestId('fx-currency')).toBeNull();
    expect(screen.queryByTestId('fx-rate-source')).toBeNull();
  });

  it('tik işaretlenince para birimi VE kur kaynağı sorusu görünür', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('fx-toggle'));

    expect(screen.getByTestId('fx-currency')).toHaveValue('USD');
    // Varsayılan kaynak: Merkez Bankası
    expect(screen.getByTestId('fx-rate-source')).toHaveValue('tcmb');
    expect(screen.getByTestId('fx-rate-readonly')).toBeInTheDocument();
  });

  it('TCMB kaynağında kayıt tarihli kur okunur gösterilir ve TL karşılığı hesaplanır', async () => {
    const user = userEvent.setup();
    render(<Harness amount={100} date="2026-07-20" />);
    await user.click(screen.getByTestId('fx-toggle'));

    // 15-07-2026 USD kuru 38 → 100 × 38 = 3.800,00 ₺
    expect(screen.getByTestId('fx-rate-readonly')).toHaveTextContent('38');
    expect(screen.getByTestId('fx-try-equivalent')).toHaveTextContent('3.800,00 ₺');
  });

  it('manuel kaynağa geçince kur elle girilebilir ve TL karşılığı güncellenir', async () => {
    const user = userEvent.setup();
    render(<Harness amount={100} date="2026-07-20" />);
    await user.click(screen.getByTestId('fx-toggle'));
    await user.selectOptions(screen.getByTestId('fx-rate-source'), 'manual');

    const rateInput = screen.getByTestId('fx-rate-input');
    expect(rateInput).toBeInTheDocument();
    await user.clear(rateInput);
    await user.type(rateInput, '33,25');

    expect(screen.getByTestId('fx-try-equivalent')).toHaveTextContent('3.325,00 ₺');
  });

  it('para birimi EUR yapılınca o günün EUR kuru kullanılır', async () => {
    const user = userEvent.setup();
    render(<Harness amount={200} date="2026-07-20" />);
    await user.click(screen.getByTestId('fx-toggle'));
    await user.selectOptions(screen.getByTestId('fx-currency'), 'EUR');

    // 15-07-2026 EUR kuru 42 → 200 × 42 = 8.400,00 ₺
    expect(screen.getByTestId('fx-try-equivalent')).toHaveTextContent('8.400,00 ₺');
  });

  it('tik kaldırılınca döviz alanları temizlenir (TRY ye döner)', async () => {
    const user = userEvent.setup();
    const seen: FxDraft[] = [];
    render(<Harness onDraft={(d) => seen.push(d)} />);
    await user.click(screen.getByTestId('fx-toggle'));
    await user.click(screen.getByTestId('fx-toggle'));

    const last = seen[seen.length - 1];
    expect(last?.isFx).toBe(false);
    expect(last?.currency).toBe('TRY');
    expect(last?.fxRate).toBeNull();
  });

  it('çözümlenen kur draft a yazılır — kaydetmede normalizeFxDraft onu dondurur', async () => {
    const user = userEvent.setup();
    const seen: FxDraft[] = [];
    render(<Harness amount={100} date="2026-07-20" onDraft={(d) => seen.push(d)} />);
    await user.click(screen.getByTestId('fx-toggle'));

    const last = seen[seen.length - 1];
    expect(Number(last?.fxRate)).toBe(38);

    const frozen = normalizeFxDraft({ ...last, amount: 100, date: '2026-07-20' }, rateBook);
    expect(frozen).toEqual({
      currency: 'USD',
      fxRate: 38,
      fxRateSource: 'tcmb',
      fxRateDate: '2026-07-20',
      amountTRY: 3800,
    });
  });

  it('lockToggle ile tik kilitlenir (döviz hesabı) ama kur kaynağı seçilebilir', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ isFx: true, currency: 'USD' }} lockToggle currencies={['USD']} />);

    expect(screen.getByTestId('fx-toggle')).toBeDisabled();
    expect(screen.getByTestId('fx-rate-source')).toBeEnabled();
    await user.selectOptions(screen.getByTestId('fx-rate-source'), 'manual');
    expect(screen.getByTestId('fx-rate-input')).toBeInTheDocument();
  });

  it('kur bulunamazsa uyarı metni gösterilir', async () => {
    const user = userEvent.setup();
    render(<Harness rateBook={{ current: {}, history: [] }} />);
    await user.click(screen.getByTestId('fx-toggle'));
    expect(screen.getByText(/Kur bulunamadı/)).toBeInTheDocument();
  });

  it('İngilizce dilde etiketler çevrilir', async () => {
    const user = userEvent.setup();
    render(<Harness lang="en" />);
    expect(screen.getByText('Foreign currency entry')).toBeInTheDocument();
    await user.click(screen.getByTestId('fx-toggle'));
    expect(screen.getByText('Rate source')).toBeInTheDocument();
    expect(screen.getByText('Central Bank (TCMB)')).toBeInTheDocument();
  });

  it('useBackend açıkken tarihli kur backend ten çekilir', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ currency: 'USD', date: '2026-07-20', rate: 39.5 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<Harness amount={100} date="2026-07-20" useBackend />);
    await user.click(screen.getByTestId('fx-toggle'));

    // Backend kuru yerel geçmişten üstündür: 100 × 39,5 = 3.950,00 ₺
    expect(await screen.findByText('3.950,00 ₺')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/finance/fx/rates/at?currency=USD&date=2026-07-20',
      expect.anything(),
    );
    vi.unstubAllGlobals();
  });
});
