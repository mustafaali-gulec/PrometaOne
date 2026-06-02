/**
 * PositionsList component testleri.
 *
 * Doğrulanan davranışlar:
 *   - loading=true → "Yükleniyor…" gösterilir.
 *   - positions boş → "Pozisyon bulunamadı." gösterilir.
 *   - Position kartları title + status (Açık) + headcount + maaş aralığı render eder.
 *   - onSelect prop verilince kart tıklama callback'i tetikler (role="button").
 *   - description null ise gösterilmez.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { positionFixture } from '../../../../test/fixtures/hrFixtures';
import { PositionsList } from '../../presentation/components/PositionsList';

describe('<PositionsList />', () => {
  it('loading=true ise yükleniyor mesajı gösterir', () => {
    render(<PositionsList positions={[]} loading />);
    expect(screen.getByText(/Yükleniyor…/i)).toBeInTheDocument();
  });

  it('positions boş ise "Pozisyon bulunamadı." gösterir', () => {
    render(<PositionsList positions={[]} />);
    expect(screen.getByText(/Pozisyon bulunamadı/i)).toBeInTheDocument();
  });

  it('title + "Açık" status + headcount + maaş aralığı render eder', () => {
    render(<PositionsList positions={[positionFixture]} />);
    expect(screen.getByText(positionFixture.title)).toBeInTheDocument();
    expect(screen.getByText('Açık')).toBeInTheDocument();
    expect(screen.getByText(/Kadro:\s*2/)).toBeInTheDocument();
    // Maaş aralığı (tr-TR formatlı): 1.000 – 2.000
    expect(screen.getByText(/1\.000.*2\.000/)).toBeInTheDocument();
  });

  it('description null ise açıklama bloğu render edilmez', () => {
    const noDesc = { ...positionFixture, description: null };
    render(<PositionsList positions={[noDesc]} />);
    // Açıklama metni yok olmalı
    expect(screen.queryByText(positionFixture.description!)).not.toBeInTheDocument();
  });

  it("onSelect verilince kart tıklama callback'i tetikler", () => {
    const onSelect = vi.fn();
    render(<PositionsList positions={[positionFixture]} onSelect={onSelect} />);
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(positionFixture.id);
  });
});
