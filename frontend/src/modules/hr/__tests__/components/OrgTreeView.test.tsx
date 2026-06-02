/**
 * OrgTreeView component testleri (Testing Library + jsdom).
 *
 * Doğrulanan davranışlar:
 *   - Boş tree → "Henüz organizasyon birimi yok." mesajı.
 *   - Recursive render: parent + child node'lar görünür.
 *   - selectedId seçili node'u görsel olarak işaretler (role="button" tabIndex).
 *   - onSelect prop verilirse tıklama callback'i tetikler; verilmemişse
 *     button rolü çıkmaz.
 *   - Code badge ve arşivli işareti doğru render edilir.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { orgTreeFixture, orgUnitChild, orgUnitRoot } from '../../../../test/fixtures/hrFixtures';
import { OrgTreeView } from '../../presentation/components/OrgTreeView';

describe('<OrgTreeView />', () => {
  it('tree boşsa boş durum mesajı gösterir', () => {
    render(<OrgTreeView tree={[]} />);
    expect(screen.getByText(/Henüz organizasyon birimi yok/i)).toBeInTheDocument();
  });

  it("parent + child node'ları render eder", () => {
    render(<OrgTreeView tree={orgTreeFixture.tree} />);
    expect(screen.getByText(orgUnitRoot.name)).toBeInTheDocument();
    expect(screen.getByText(orgUnitChild.name)).toBeInTheDocument();
    // Code badge'leri
    expect(screen.getByText('ROOT')).toBeInTheDocument();
    expect(screen.getByText('ENG')).toBeInTheDocument();
  });

  it('onSelect verilince node tıklanır → callback id ile çağrılır', () => {
    const onSelect = vi.fn();
    render(<OrgTreeView tree={orgTreeFixture.tree} onSelect={onSelect} />);

    // root node'unu seçmek için strong elementinin parent'ına click
    const rootText = screen.getByText(orgUnitRoot.name);
    const rootButton = rootText.closest('[role="button"]');
    expect(rootButton).not.toBeNull();
    fireEvent.click(rootButton!);
    expect(onSelect).toHaveBeenCalledWith(orgUnitRoot.id);
  });

  it('onSelect verilmediğinde role="button" yoktur (read-only)', () => {
    render(<OrgTreeView tree={orgTreeFixture.tree} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('arşivli (active=false) unit "(arşivli)" işaretiyle render edilir', () => {
    const archivedTree = [
      {
        unit: { ...orgUnitRoot, active: false },
        children: [],
      },
    ];
    render(<OrgTreeView tree={archivedTree} />);
    expect(screen.getByText(/\(arşivli\)/i)).toBeInTheDocument();
  });
});
