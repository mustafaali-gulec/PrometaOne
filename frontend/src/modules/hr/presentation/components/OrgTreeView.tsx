/**
 * OrgTreeView — recursive OrgUnit ağacını gösterir.
 *
 * Basit display component. Düzenleme / sürükleme PR 5'in kapsam dışında —
 * sadece görselleştirme ve seçim.
 */
import type { OrgTreeNodeDto } from '../../application/dto/HrDtos';

export interface OrgTreeViewProps {
  tree: ReadonlyArray<OrgTreeNodeDto>;
  selectedId?: number | null;
  onSelect?: (id: number) => void;
}

export function OrgTreeView({ tree, selectedId, onSelect }: OrgTreeViewProps): JSX.Element {
  if (tree.length === 0) {
    return (
      <div style={{ padding: 12, color: 'var(--ink-muted, #888)', fontStyle: 'italic' }}>
        Henüz organizasyon birimi yok.
      </div>
    );
  }
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
      }}
    >
      {tree.map((node) => (
        <OrgTreeNode
          key={node.unit.id}
          node={node}
          depth={0}
          selectedId={selectedId ?? null}
          {...(onSelect ? { onSelect } : {})}
        />
      ))}
    </ul>
  );
}

interface OrgTreeNodeProps {
  node: OrgTreeNodeDto;
  depth: number;
  selectedId: number | null;
  onSelect?: (id: number) => void;
}

function OrgTreeNode({ node, depth, selectedId, onSelect }: OrgTreeNodeProps): JSX.Element {
  const isSelected = selectedId === node.unit.id;
  return (
    <li>
      <div
        style={{
          padding: '6px 8px',
          paddingLeft: 8 + depth * 16,
          cursor: onSelect ? 'pointer' : 'default',
          background: isSelected ? 'var(--bg-selected, #e8f1ff)' : 'transparent',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        {...(onSelect
          ? {
              role: 'button',
              tabIndex: 0,
              onClick: () => onSelect(node.unit.id),
              onKeyDown: (ev: React.KeyboardEvent<HTMLDivElement>) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  onSelect(node.unit.id);
                }
              },
            }
          : {})}
      >
        <span style={{ color: 'var(--ink-muted, #888)' }}>
          {node.children.length > 0 ? '▼' : '·'}
        </span>
        <strong>{node.unit.name}</strong>
        {node.unit.code !== null ? (
          <span
            style={{
              fontSize: 11,
              padding: '2px 6px',
              background: 'var(--paper-2, #f5f5f5)',
              borderRadius: 3,
              color: 'var(--ink-muted, #666)',
            }}
          >
            {node.unit.code}
          </span>
        ) : null}
        {!node.unit.active ? (
          <span style={{ fontSize: 11, color: 'var(--danger, #c00)' }}>(arşivli)</span>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {node.children.map((child) => (
            <OrgTreeNode
              key={child.unit.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              {...(onSelect ? { onSelect } : {})}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
