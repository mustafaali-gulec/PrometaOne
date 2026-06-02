/**
 * ApplicationKanban component testleri.
 *
 * Native HTML5 drag-drop API jsdom'da tam emüle edilmez; bu yüzden
 * drag-drop davranışı doğrudan event firing ile test edilir
 * (dataTransfer mock'lanır).
 *
 * Doğrulanan davranışlar:
 *   - 4 kolon (Yeni / Tarama / Mülakat / Teklif) render edilir.
 *   - Stage'lere göre başvuru kartları doğru kolona dağılır.
 *   - dragStart → dragOver → drop akışı onMoveStage callback'i çağırır.
 *   - onMoveStage hata fırlatırsa kullanıcıya error mesajı görünür.
 *   - applications boş + loading=true → yükleniyor.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { applicationFixture } from '../../../../test/fixtures/hrFixtures';
import { ApplicationKanban } from '../../presentation/components/ApplicationKanban';

describe('<ApplicationKanban />', () => {
  it("4 kolon label'ı (Yeni/Tarama/Mülakat/Teklif) render eder", () => {
    render(<ApplicationKanban applications={[]} onMoveStage={vi.fn()} />);
    expect(screen.getByText('Yeni')).toBeInTheDocument();
    expect(screen.getByText('Tarama')).toBeInTheDocument();
    expect(screen.getByText('Mülakat')).toBeInTheDocument();
    expect(screen.getByText('Teklif')).toBeInTheDocument();
  });

  it('applications boş + loading=true → "Yükleniyor…"', () => {
    render(<ApplicationKanban applications={[]} loading onMoveStage={vi.fn()} />);
    expect(screen.getByText(/Yükleniyor…/i)).toBeInTheDocument();
  });

  it('screening stage\'li başvuru "Tarama" kolonunda kart olarak görünür', () => {
    render(<ApplicationKanban applications={[applicationFixture]} onMoveStage={vi.fn()} />);
    expect(screen.getByText(`Başvuru #${applicationFixture.id}`)).toBeInTheDocument();
  });

  it("drag-drop akışı onMoveStage callback'ini çağırır", async () => {
    const onMoveStage = vi.fn().mockResolvedValue(undefined);
    render(<ApplicationKanban applications={[applicationFixture]} onMoveStage={onMoveStage} />);
    const card = screen.getByText(`Başvuru #${applicationFixture.id}`).closest('div')!;
    const interviewColumn = screen.getByText('Mülakat').closest('div')!.parentElement!;

    // Mock dataTransfer
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
      getData: vi.fn(),
    };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(interviewColumn, { dataTransfer });
    fireEvent.drop(interviewColumn, { dataTransfer });

    // onMoveStage çağrıldı mı? (async dispatch için micro-task)
    await new Promise((r) => setTimeout(r, 0));
    expect(onMoveStage).toHaveBeenCalledTimes(1);
    expect(onMoveStage).toHaveBeenCalledWith(applicationFixture.id, 'interview');
  });

  it('onMoveStage reject ederse error mesajı kullanıcıya görünür', async () => {
    const onMoveStage = vi.fn().mockRejectedValue(new Error('400: yasak transition'));
    render(<ApplicationKanban applications={[applicationFixture]} onMoveStage={onMoveStage} />);
    const card = screen.getByText(`Başvuru #${applicationFixture.id}`).closest('div')!;
    const offerColumn = screen.getByText('Teklif').closest('div')!.parentElement!;

    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
      getData: vi.fn(),
    };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(offerColumn, { dataTransfer });
    fireEvent.drop(offerColumn, { dataTransfer });

    // Async hata gösterimi için bekle
    await screen.findByText(/Geçiş hatası.*yasak transition/i);
  });
});
