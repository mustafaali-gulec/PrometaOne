/**
 * RecruitmentFunnel component testleri.
 *
 * Doğrulanan davranışlar:
 *   - funnel=null + loading=true → "Yükleniyor…"
 *   - funnel verilince 5 aktif stage card + 2 terminal stage card gösterilir.
 *   - Stage başına count doğru render edilir.
 *   - Counts içinde olmayan stage 0 olarak gösterilir.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { funnelFixture } from '../../../../test/fixtures/hrFixtures';
import { RecruitmentFunnel } from '../../presentation/components/RecruitmentFunnel';

describe('<RecruitmentFunnel />', () => {
  it('funnel=null + loading=true → yükleniyor', () => {
    render(<RecruitmentFunnel funnel={null} loading />);
    expect(screen.getByText(/Yükleniyor…/i)).toBeInTheDocument();
  });

  it("5 aktif stage + 2 terminal stage label'larını gösterir", () => {
    render(<RecruitmentFunnel funnel={funnelFixture} />);
    for (const label of ['Yeni', 'Tarama', 'Mülakat', 'Teklif', 'İşe Alındı']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    for (const label of ['Red', 'Çekildi']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('counts mapping doğru render edilir', () => {
    render(<RecruitmentFunnel funnel={funnelFixture} />);
    // new: 5
    expect(screen.getByText('5')).toBeInTheDocument();
    // screening: 3
    expect(screen.getByText('3')).toBeInTheDocument();
    // interview: 2 — birden fazla "2" olabilir, getAllByText kullan
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('counts içinde olmayan terminal stage 0 olarak gösterilir', () => {
    const minimal = {
      positionId: funnelFixture.positionId,
      counts: { new: 1 },
    };
    render(<RecruitmentFunnel funnel={minimal} />);
    // Red ve Çekildi 0 göstermeli — en az 2 tane "0" hücresi olmalı
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});
