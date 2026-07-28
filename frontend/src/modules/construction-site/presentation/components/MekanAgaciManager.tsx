/**
 * MekanAgaciManager — Mekân Kırılımı (FAZ 1).
 *
 * Proje seç → Saha > Blok > Kat > Bağımsız Bölüm ağacı. Düğüm ekleme/düzenleme/
 * taşıma/silme + toplu üretim sihirbazı (N blok × M kat × K daire).
 *
 * Ağaç kısıtları backend'den gelir: her düğümün `allowedChildKinds` alanı hangi
 * tiplerin altına eklenebileceğini söyler, "Ekle" menüsü bunu okur. Böylece
 * "Daire 18'in altına blok" gibi anlamsız ağaçlar arayüzde bile teklif edilmez.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  LocationKind,
  LocationTreeNodeDto,
  ProjectDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { csT, locationKindLabel } from '../../i18n';
import { useProjects } from '../hooks/useProjects';

export interface MekanAgaciManagerProps {
  api: ConstructionApi;
  companyId: number;
  lang?: string | undefined;
  /** Üst uygulamanın onay diyaloğu; yoksa window.confirm'e düşer. */
  confirmAsync?: ((message: string) => Promise<boolean>) | undefined;
}

const box: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 12,
  background: '#fff',
};
const label: CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 2 };
const input: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
};
const btn: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: 12,
};
const btnPrimary: CSSProperties = {
  ...btn,
  background: '#2563eb',
  borderColor: '#2563eb',
  color: '#fff',
};
const errBox: CSSProperties = {
  border: '1px solid #fca5a5',
  background: '#fef2f2',
  color: '#b91c1c',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  marginBottom: 8,
};
const okBox: CSSProperties = {
  ...errBox,
  border: '1px solid #86efac',
  background: '#f0fdf4',
  color: '#15803d',
};

/** Tip → satır rengi; ağacı gözle taramayı kolaylaştırır. */
const KIND_TINT: Record<LocationKind, string> = {
  site: '#0f172a',
  block: '#1d4ed8',
  floor: '#0f766e',
  unit: '#7c3aed',
  zone: '#b45309',
};

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

interface DraftNode {
  parentId: number | null;
  kind: LocationKind;
  code: string;
  name: string;
  unitType: string;
  grossArea: string;
  netArea: string;
  landShare: string;
  facade: string;
}

const emptyDraft = (parentId: number | null, kind: LocationKind): DraftNode => ({
  parentId,
  kind,
  code: '',
  name: '',
  unitType: '',
  grossArea: '',
  netArea: '',
  landShare: '',
  facade: '',
});

export function MekanAgaciManager({
  api,
  companyId,
  lang,
  confirmAsync,
}: MekanAgaciManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState<number>(0);
  const [tree, setTree] = useState<ReadonlyArray<LocationTreeNodeDto>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());

  // Ekleme/düzenleme formları
  const [draft, setDraft] = useState<DraftNode | null>(null);
  const [editId, setEditId] = useState<number>(0);
  const [moveId, setMoveId] = useState<number>(0);
  const [showWizard, setShowWizard] = useState(false);

  const t = useCallback(
    (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => csT(k, lang, vars),
    [lang],
  );

  const confirm = useCallback(
    async (msg: string): Promise<boolean> => {
      if (confirmAsync) return confirmAsync(msg);
      return Promise.resolve(globalThis.confirm(msg));
    },
    [confirmAsync],
  );

  const load = useCallback(async (): Promise<void> => {
    if (!(projectId > 0)) {
      setTree([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const opts: { includeInactive?: boolean; search?: string } = {};
      if (includeInactive) opts.includeInactive = true;
      if (search.trim() !== '') opts.search = search.trim();
      const res = await api.getLocationTree(projectId, companyId, opts);
      setTree(res.tree);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, projectId, includeInactive, search]);

  useEffect(() => {
    void load();
  }, [load]);

  // Düz liste — "taşı" hedefi seçiciyi doldurmak için
  const flat = useMemo((): LocationTreeNodeDto[] => {
    const out: LocationTreeNodeDto[] = [];
    const walk = (nodes: ReadonlyArray<LocationTreeNodeDto>): void => {
      for (const n of nodes) {
        out.push(n);
        walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree]);

  const toggle = (id: number): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitDraft = async (): Promise<void> => {
    if (!draft || draft.code.trim() === '') return;
    setError(null);
    setInfo(null);
    try {
      await api.createLocation({
        companyId,
        projectId,
        parentId: draft.parentId,
        kind: draft.kind,
        code: draft.code.trim(),
        ...(draft.name.trim() !== '' ? { name: draft.name.trim() } : {}),
        ...(draft.unitType.trim() !== '' ? { unitType: draft.unitType.trim() } : {}),
        grossArea: numOrNull(draft.grossArea),
        netArea: numOrNull(draft.netArea),
        landShare: numOrNull(draft.landShare),
        ...(draft.facade.trim() !== '' ? { facade: draft.facade.trim() } : {}),
      });
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submitEdit = async (node: LocationTreeNodeDto, patch: DraftNode): Promise<void> => {
    setError(null);
    setInfo(null);
    try {
      await api.updateLocation(node.id, {
        companyId,
        code: patch.code.trim(),
        name: patch.name.trim() === '' ? patch.code.trim() : patch.name.trim(),
        unitType: patch.unitType.trim() === '' ? null : patch.unitType.trim(),
        grossArea: numOrNull(patch.grossArea),
        netArea: numOrNull(patch.netArea),
        landShare: numOrNull(patch.landShare),
        facade: patch.facade.trim() === '' ? null : patch.facade.trim(),
      });
      setEditId(0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doMove = async (id: number, newParentId: number | null): Promise<void> => {
    setError(null);
    try {
      await api.moveLocation(id, { companyId, newParentId });
      setMoveId(0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Silme akışı: önce kullanım sorulur. Bağlı kayıt varsa kalıcı silme
   * TEKLİF EDİLMEZ — kullanıcıya neyin bağlı olduğu sayılarla söylenip pasife
   * çekme önerilir. Böylece 409 hatasını görmeden doğru yolu seçer.
   */
  const doDelete = async (node: LocationTreeNodeDto): Promise<void> => {
    setError(null);
    setInfo(null);
    try {
      const usage = await api.getLocationUsage(node.id, companyId);
      if (!usage.canHardDelete) {
        const msg = t('cs.loc.deleteBlocked', { blockers: usage.blockers.join(', ') });
        if (!(await confirm(`${msg}\n\n${t('cs.loc.deactivateConfirm', { name: node.name })}`))) {
          return;
        }
        await api.deleteLocation(node.id, companyId, true);
      } else {
        if (!(await confirm(t('cs.loc.deleteConfirm', { name: node.name })))) return;
        await api.deleteLocation(node.id, companyId, false);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const renderRow = (node: LocationTreeNodeDto): JSX.Element => {
    const isCollapsed = collapsed.has(node.id);
    const hasKids = node.children.length > 0;
    const editing = editId === node.id;
    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 6px',
            paddingLeft: 6 + node.depth * 18,
            borderBottom: '1px solid #f1f5f9',
            background: node.active ? undefined : '#f8fafc',
            opacity: node.active ? 1 : 0.6,
          }}
        >
          <button
            type="button"
            onClick={() => toggle(node.id)}
            style={{
              ...btn,
              padding: '0 5px',
              visibility: hasKids ? 'visible' : 'hidden',
              minWidth: 22,
            }}
            aria-label={node.name}
          >
            {isCollapsed ? '+' : '−'}
          </button>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: KIND_TINT[node.kind],
              textTransform: 'uppercase',
              minWidth: 92,
            }}
          >
            {locationKindLabel(node.kind, lang)}
          </span>
          <strong style={{ fontSize: 13, minWidth: 56 }}>{node.code}</strong>
          <span style={{ fontSize: 13, flex: 1 }}>{node.name}</span>
          {node.unitType !== null && (
            <span style={{ fontSize: 11, color: '#7c3aed' }}>{node.unitType}</span>
          )}
          {node.kind !== 'unit' && node.unitCount > 0 && (
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {node.unitCount} {t('cs.loc.unitCount')}
            </span>
          )}
          {node.netAreaTotal !== null && (
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {node.netAreaTotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} m²
            </span>
          )}
          <span style={{ display: 'flex', gap: 4 }}>
            {node.allowedChildKinds.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value === '') return;
                  setDraft(emptyDraft(node.id, e.target.value as LocationKind));
                  setEditId(0);
                }}
                style={{ ...btn, padding: '4px 6px' }}
                title={t('cs.loc.addChild')}
              >
                <option value="">+ {t('cs.loc.addChild')}</option>
                {node.allowedChildKinds.map((k) => (
                  <option key={k} value={k}>
                    {locationKindLabel(k, lang)}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              style={btn}
              onClick={() => {
                setEditId(editing ? 0 : node.id);
                setDraft(null);
              }}
            >
              {t('cs.common.edit')}
            </button>
            <button
              type="button"
              style={btn}
              onClick={() => setMoveId(moveId === node.id ? 0 : node.id)}
            >
              {t('cs.loc.move')}
            </button>
            <button type="button" style={btn} onClick={() => void doDelete(node)}>
              {t('cs.common.delete')}
            </button>
          </span>
        </div>

        {editing && (
          <NodeForm
            lang={lang}
            initial={{
              parentId: node.parentId,
              kind: node.kind,
              code: node.code,
              name: node.name,
              unitType: node.unitType ?? '',
              grossArea: node.grossArea === null ? '' : String(node.grossArea),
              netArea: node.netArea === null ? '' : String(node.netArea),
              landShare: node.landShare === null ? '' : String(node.landShare),
              facade: node.facade ?? '',
            }}
            depth={node.depth}
            onCancel={() => setEditId(0)}
            onSubmit={(p) => void submitEdit(node, p)}
          />
        )}

        {moveId === node.id && (
          <div
            style={{
              paddingLeft: 24 + node.depth * 18,
              padding: '8px 10px',
              background: '#f8fafc',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <div style={{ minWidth: 340 }}>
              <span style={label}>{t('cs.loc.moveTo')}</span>
              <select
                style={input}
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  void doMove(node.id, v === 'root' ? null : Number(v));
                }}
              >
                <option value="" disabled>
                  {t('cs.common.selectProject')}
                </option>
                <option value="root">{t('cs.loc.moveToRoot')}</option>
                {flat
                  // Kendisi ve alt ağacı hedef olamaz (döngü); backend de reddeder
                  // ama seçeneği hiç göstermemek daha iyi bir deneyim.
                  .filter((cand) => cand.id !== node.id && !cand.path.startsWith(`${node.path} > `))
                  .filter((cand) => cand.allowedChildKinds.includes(node.kind))
                  .map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.path}
                    </option>
                  ))}
              </select>
            </div>
            <button type="button" style={btn} onClick={() => setMoveId(0)}>
              {t('cs.common.cancel')}
            </button>
          </div>
        )}

        {draft !== null && draft.parentId === node.id && (
          <NodeForm
            lang={lang}
            initial={draft}
            depth={node.depth + 1}
            onCancel={() => setDraft(null)}
            onSubmit={(p) => {
              setDraft(p);
              void submitDraft();
            }}
            onChange={setDraft}
          />
        )}

        {!isCollapsed && node.children.map(renderRow)}
      </div>
    );
  };

  const project = projects.find((p) => p.id === projectId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.loc.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.loc.subtitle')}</p>
      </div>

      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <span style={label}>{t('cs.common.project')}</span>
          <select
            style={input}
            value={projectId === 0 ? '' : String(projectId)}
            onChange={(e) => {
              setProjectId(e.target.value === '' ? 0 : Number(e.target.value));
              setDraft(null);
              setEditId(0);
              setInfo(null);
            }}
          >
            <option value="">{t('cs.common.selectProject')}</option>
            {projects.map((p: ProjectDto) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 200 }}>
          <span style={label}>{t('cs.common.search')}</span>
          <input style={input} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          {t('cs.common.showInactive')}
        </label>
        <button type="button" style={btn} onClick={() => void load()}>
          {t('cs.common.refresh')}
        </button>
        {projectId > 0 && (
          <>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value === '') return;
                setDraft(emptyDraft(null, e.target.value as LocationKind));
                setEditId(0);
              }}
              style={{ ...btn, padding: '6px 8px' }}
            >
              <option value="">+ {t('cs.loc.addRoot')}</option>
              {(['site', 'block', 'zone'] as LocationKind[]).map((k) => (
                <option key={k} value={k}>
                  {locationKindLabel(k, lang)}
                </option>
              ))}
            </select>
            <button type="button" style={btnPrimary} onClick={() => setShowWizard((v) => !v)}>
              {t('cs.gen.title')}
            </button>
          </>
        )}
      </div>

      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}

      {showWizard && projectId > 0 && (
        <BulkWizard
          api={api}
          companyId={companyId}
          projectId={projectId}
          lang={lang}
          roots={flat.filter((n) => n.allowedChildKinds.includes('block'))}
          onDone={(n) => {
            setInfo(n > 0 ? t('cs.gen.done', { n }) : t('cs.gen.idempotent'));
            setShowWizard(false);
            void load();
          }}
          onError={setError}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {draft !== null && draft.parentId === null && (
        <div style={box}>
          <NodeForm
            lang={lang}
            initial={draft}
            depth={0}
            onCancel={() => setDraft(null)}
            onSubmit={(p) => {
              setDraft(p);
              void submitDraft();
            }}
            onChange={setDraft}
          />
        </div>
      )}

      {projectId === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.selectProject')}</div>
      ) : loading ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.loading')}</div>
      ) : tree.length === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>
          <div>{t('cs.loc.empty')}</div>
          <div style={{ marginTop: 4 }}>{t('cs.loc.emptyHint')}</div>
        </div>
      ) : (
        <div style={{ ...box, padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 10px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              fontSize: 12,
              color: '#475569',
            }}
          >
            <span>
              {project?.name ?? ''} — {t('cs.loc.tree')}
            </span>
            <span>
              {t('cs.common.total')}: {flat.length} · {t('cs.loc.unitCount')}:{' '}
              {flat.filter((n) => n.kind === 'unit').length}
            </span>
          </div>
          {tree.map(renderRow)}
        </div>
      )}
    </div>
  );
}

// ===== Düğüm formu ==========================================================

interface NodeFormProps {
  lang?: string | undefined;
  initial: DraftNode;
  depth: number;
  onCancel: () => void;
  onSubmit: (draft: DraftNode) => void;
  onChange?: (draft: DraftNode) => void;
}

function NodeForm({
  lang,
  initial,
  depth,
  onCancel,
  onSubmit,
  onChange,
}: NodeFormProps): JSX.Element {
  const [d, setD] = useState<DraftNode>(initial);
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const set = (patch: Partial<DraftNode>): void => {
    const next = { ...d, ...patch };
    setD(next);
    onChange?.(next);
  };

  return (
    <div
      style={{
        paddingLeft: 24 + depth * 18,
        padding: '10px 12px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 8,
        alignItems: 'end',
      }}
    >
      <div>
        <span style={label}>
          {t('cs.loc.kind')}: <strong>{locationKindLabel(d.kind, lang)}</strong>
        </span>
        <span style={label}>
          {t('cs.common.code')} ({t('cs.common.required')})
        </span>
        <input style={input} value={d.code} onChange={(e) => set({ code: e.target.value })} />
      </div>
      <div>
        <span style={label}>{t('cs.common.name')}</span>
        <input
          style={input}
          value={d.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={t('cs.loc.nameHint')}
        />
      </div>
      {d.kind === 'unit' && (
        <>
          <div>
            <span style={label}>{t('cs.loc.unitType')}</span>
            <input
              style={input}
              value={d.unitType}
              onChange={(e) => set({ unitType: e.target.value })}
            />
          </div>
          <div>
            <span style={label}>{t('cs.loc.grossArea')}</span>
            <input
              style={input}
              value={d.grossArea}
              onChange={(e) => set({ grossArea: e.target.value })}
            />
          </div>
          <div>
            <span style={label}>{t('cs.loc.netArea')}</span>
            <input
              style={input}
              value={d.netArea}
              onChange={(e) => set({ netArea: e.target.value })}
            />
          </div>
          <div>
            <span style={label}>{t('cs.loc.landShare')}</span>
            <input
              style={input}
              value={d.landShare}
              onChange={(e) => set({ landShare: e.target.value })}
            />
          </div>
          <div>
            <span style={label}>{t('cs.loc.facade')}</span>
            <input
              style={input}
              value={d.facade}
              onChange={(e) => set({ facade: e.target.value })}
            />
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          style={btnPrimary}
          disabled={d.code.trim() === ''}
          onClick={() => onSubmit(d)}
        >
          {t('cs.common.save')}
        </button>
        <button type="button" style={btn} onClick={onCancel}>
          {t('cs.common.cancel')}
        </button>
      </div>
    </div>
  );
}

// ===== Toplu üretim sihirbazı ===============================================

interface BulkWizardProps {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  lang?: string | undefined;
  roots: ReadonlyArray<LocationTreeNodeDto>;
  onDone: (createdCount: number) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

/** "A, B, C" → ['A','B','C'] (boşlar atılır). */
const splitCsv = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');

function BulkWizard({
  api,
  companyId,
  projectId,
  lang,
  roots,
  onDone,
  onError,
  onCancel,
}: BulkWizardProps): JSX.Element {
  const [parentId, setParentId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState('A, B');
  const [floors, setFloors] = useState('0, 1, 2');
  const [unitsPerFloor, setUnitsPerFloor] = useState('4');
  const [numbering, setNumbering] = useState<'sequential' | 'per_floor'>('per_floor');
  const [unitType, setUnitType] = useState('');
  const [blockTpl, setBlockTpl] = useState('{code} Blok');
  const [floorTpl, setFloorTpl] = useState('{code}');
  const [unitTpl, setUnitTpl] = useState('{code}');
  const [busy, setBusy] = useState(false);

  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const b = splitCsv(blocks);
  const f = splitCsv(floors);
  const u = Math.max(0, Math.trunc(Number(unitsPerFloor) || 0));
  const nodeCount = b.length + b.length * f.length + b.length * f.length * u;

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await api.bulkGenerateLocations({
        companyId,
        projectId,
        parentId,
        blocks: b,
        floors: f,
        unitsPerFloor: u,
        unitNumbering: numbering,
        defaultUnitType: unitType.trim() === '' ? null : unitType.trim(),
        blockNameTemplate: blockTpl,
        floorNameTemplate: floorTpl,
        unitNameTemplate: unitTpl,
      });
      onDone(res.createdCount);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...box, background: '#f8fafc' }}>
      <h4 style={{ margin: '0 0 2px', fontSize: 14 }}>{t('cs.gen.title')}</h4>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>{t('cs.gen.hint')}</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
        }}
      >
        <div>
          <span style={label}>{t('cs.gen.parent')}</span>
          <select
            style={input}
            value={parentId === null ? 'root' : String(parentId)}
            onChange={(e) => setParentId(e.target.value === 'root' ? null : Number(e.target.value))}
          >
            <option value="root">{t('cs.gen.parentRoot')}</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.path}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span style={label}>{t('cs.gen.blocks')}</span>
          <input style={input} value={blocks} onChange={(e) => setBlocks(e.target.value)} />
          <span style={{ ...label, marginTop: 2 }}>{t('cs.gen.blocksHint')}</span>
        </div>
        <div>
          <span style={label}>{t('cs.gen.floors')}</span>
          <input style={input} value={floors} onChange={(e) => setFloors(e.target.value)} />
          <span style={{ ...label, marginTop: 2 }}>{t('cs.gen.floorsHint')}</span>
        </div>
        <div>
          <span style={label}>{t('cs.gen.unitsPerFloor')}</span>
          <input
            style={input}
            value={unitsPerFloor}
            onChange={(e) => setUnitsPerFloor(e.target.value)}
          />
        </div>
        <div>
          <span style={label}>{t('cs.gen.numbering')}</span>
          <select
            style={input}
            value={numbering}
            onChange={(e) => setNumbering(e.target.value as 'sequential' | 'per_floor')}
          >
            <option value="per_floor">{t('cs.gen.numbering.perFloor')}</option>
            <option value="sequential">{t('cs.gen.numbering.sequential')}</option>
          </select>
        </div>
        <div>
          <span style={label}>{t('cs.gen.defaultUnitType')}</span>
          <input
            style={input}
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            placeholder="2+1"
          />
        </div>
        <div>
          <span style={label}>{t('cs.gen.blockNameTpl')}</span>
          <input style={input} value={blockTpl} onChange={(e) => setBlockTpl(e.target.value)} />
        </div>
        <div>
          <span style={label}>{t('cs.gen.floorNameTpl')}</span>
          <input style={input} value={floorTpl} onChange={(e) => setFloorTpl(e.target.value)} />
        </div>
        <div>
          <span style={label}>{t('cs.gen.unitNameTpl')}</span>
          <input style={input} value={unitTpl} onChange={(e) => setUnitTpl(e.target.value)} />
          <span style={{ ...label, marginTop: 2 }}>{t('cs.gen.tplHint')}</span>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13 }}>
          {t('cs.gen.preview')}: <strong>{nodeCount}</strong> ({b.length} ×{' '}
          {locationKindLabel('block', lang)}, {b.length * f.length} ×{' '}
          {locationKindLabel('floor', lang)}, {b.length * f.length * u} ×{' '}
          {locationKindLabel('unit', lang)})
        </span>
        <button
          type="button"
          style={btnPrimary}
          disabled={busy || b.length === 0}
          onClick={() => void run()}
        >
          {busy ? t('cs.common.loading') : t('cs.gen.run')}
        </button>
        <button type="button" style={btn} onClick={onCancel}>
          {t('cs.common.cancel')}
        </button>
      </div>
    </div>
  );
}
