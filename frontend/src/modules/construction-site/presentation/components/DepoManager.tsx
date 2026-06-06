/**
 * DepoManager — Malzeme & Depo (SF-5). Sekmeler: Malzeme (firma geneli master) +
 * proje bazlı Depolar / Stok & Hareketler / Talepler. Stok hareketi tür seçimine
 * göre kaynak/hedef depo ister; talep onayı yönetici yetkisi ister (403).
 */
import { useEffect, useState } from 'react';

import type {
  MaterialDto,
  MaterialRequestSummaryDto,
  ProjectDto,
  StockDto,
  StockMoveKind,
  StockMovementDto,
  WarehouseDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { useProjects } from '../hooks/useProjects';

type Sub = 'materials' | 'warehouses' | 'stock' | 'requests';
const SUB_LABELS: Record<Sub, string> = {
  materials: 'Malzeme',
  warehouses: 'Depolar',
  stock: 'Stok & Hareketler',
  requests: 'Talepler',
};
const KIND_LABELS: Record<StockMoveKind, string> = {
  in: 'Giriş',
  out: 'Çıkış',
  transfer: 'Transfer',
  adjust: 'Düzeltme',
  waste: 'Fire',
};
const REQ_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  fulfilled: 'Karşılandı',
  cancelled: 'İptal',
};

export interface DepoManagerProps {
  api: ConstructionApi;
  companyId: number;
}

export function DepoManager({ api, companyId }: DepoManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [sub, setSub] = useState<Sub>('materials');
  const [projectId, setProjectId] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const projectScoped = sub !== 'materials';

  return (
    <section>
      <nav
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--line, #e5e5e5)',
          marginBottom: 12,
        }}
      >
        {(Object.keys(SUB_LABELS) as Sub[]).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            style={{
              padding: '6px 14px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: sub === s ? 600 : 400,
              borderBottom:
                sub === s ? '2px solid var(--accent, #0066cc)' : '2px solid transparent',
              color: sub === s ? 'var(--accent, #0066cc)' : 'var(--ink, #111)',
            }}
          >
            {SUB_LABELS[s]}
          </button>
        ))}
      </nav>

      {projectScoped ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-muted, #666)' }}>Proje:</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(Number(e.target.value))}
            style={fld({ minWidth: 260 })}
          >
            <option value={0}>— Proje seç —</option>
            {projects.map((p: ProjectDto) => (
              <option key={String(p.id)} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error !== null ? <div style={errBox()}>Hata: {error}</div> : null}

      {sub === 'materials' ? (
        <MaterialsSection api={api} companyId={companyId} onError={setError} />
      ) : null}
      {projectScoped && projectId === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-muted, #888)' }}>Bir proje seçin.</p>
      ) : null}
      {sub === 'warehouses' && projectId > 0 ? (
        <WarehousesSection
          api={api}
          companyId={companyId}
          projectId={projectId}
          onError={setError}
        />
      ) : null}
      {sub === 'stock' && projectId > 0 ? (
        <StockSection api={api} companyId={companyId} projectId={projectId} onError={setError} />
      ) : null}
      {sub === 'requests' && projectId > 0 ? (
        <RequestsSection api={api} companyId={companyId} projectId={projectId} onError={setError} />
      ) : null}
    </section>
  );
}

function MaterialsSection({
  api,
  companyId,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  onError: (m: string | null) => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<MaterialDto>>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('ad');
  const [waste, setWaste] = useState('');
  const [busy, setBusy] = useState(false);
  const load = (): void => {
    api
      .listMaterials(companyId)
      .then((r) => setRows(r.materials))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, [api, companyId]);
  const add = async (): Promise<void> => {
    if (code.trim() === '' || name.trim() === '') {
      onError('Kod ve ad zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.createMaterial({
        companyId,
        code: code.trim(),
        name: name.trim(),
        unit: unit.trim() || 'ad',
        wastePct: waste === '' ? 0 : Number(waste),
      });
      setCode('');
      setName('');
      setWaste('');
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Malzeme eklenemedi');
    } finally {
      setBusy(false);
    }
  };
  const del = async (id: number): Promise<void> => {
    await api.deactivateMaterial(id, companyId);
    load();
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Kod"
          style={fld({ width: 120 })}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Malzeme adı"
          style={fld({ flex: 1, minWidth: 160 })}
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Birim"
          style={fld({ width: 80 })}
        />
        <input
          type="number"
          value={waste}
          onChange={(e) => setWaste(e.target.value)}
          placeholder="Fire %"
          style={fld({ width: 90 })}
        />
        <button onClick={() => void add()} disabled={busy} style={btn()}>
          + Malzeme
        </button>
      </div>
      <Table
        head={['Kod', 'Ad', 'Birim', 'Fire %', '']}
        rows={rows.map((m) => [
          m.code,
          m.name,
          m.unit,
          String(m.wastePct),
          <button key="d" onClick={() => void del(m.id)} style={delBtn()}>
            Pasifleştir
          </button>,
        ])}
        empty="Malzeme yok."
      />
    </div>
  );
}

function WarehousesSection({
  api,
  companyId,
  projectId,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  onError: (m: string | null) => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<WarehouseDto>>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const load = (): void => {
    api
      .listWarehouses(companyId, projectId)
      .then((r) => setRows(r.warehouses))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, [api, companyId, projectId]);
  const add = async (): Promise<void> => {
    if (code.trim() === '' || name.trim() === '') {
      onError('Kod ve ad zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.createWarehouse({ companyId, projectId, code: code.trim(), name: name.trim() });
      setCode('');
      setName('');
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Depo eklenemedi');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Depo kodu"
          style={fld({ width: 120 })}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Depo adı"
          style={fld({ flex: 1, minWidth: 160 })}
        />
        <button onClick={() => void add()} disabled={busy} style={btn()}>
          + Depo
        </button>
      </div>
      <Table head={['Kod', 'Ad']} rows={rows.map((w) => [w.code, w.name])} empty="Depo yok." />
    </div>
  );
}

function StockSection({
  api,
  companyId,
  projectId,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  onError: (m: string | null) => void;
}): JSX.Element {
  const [stock, setStock] = useState<ReadonlyArray<StockDto>>([]);
  const [movements, setMovements] = useState<ReadonlyArray<StockMovementDto>>([]);
  const [materials, setMaterials] = useState<ReadonlyArray<MaterialDto>>([]);
  const [warehouses, setWarehouses] = useState<ReadonlyArray<WarehouseDto>>([]);
  const [kind, setKind] = useState<StockMoveKind>('in');
  const [materialId, setMaterialId] = useState(0);
  const [fromW, setFromW] = useState(0);
  const [toW, setToW] = useState(0);
  const [qty, setQty] = useState('');
  const [movedAt, setMovedAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (): void => {
    api
      .listStock(companyId, projectId)
      .then((r) => setStock(r.stock))
      .catch(() => undefined);
    api
      .listMovements(companyId, projectId)
      .then((r) => setMovements(r.movements))
      .catch(() => undefined);
    api
      .listWarehouses(companyId, projectId)
      .then((r) => setWarehouses(r.warehouses))
      .catch(() => undefined);
    api
      .listMaterials(companyId)
      .then((r) => setMaterials(r.materials))
      .catch(() => undefined);
  };
  useEffect(load, [api, companyId, projectId]);

  const needFrom = kind === 'out' || kind === 'waste' || kind === 'transfer';
  const needTo = kind === 'in' || kind === 'adjust' || kind === 'transfer';

  const record = async (): Promise<void> => {
    if (!(materialId > 0) || qty === '' || movedAt === '') {
      onError('Malzeme, miktar ve tarih zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.recordMovement({
        companyId,
        materialId,
        kind,
        fromWarehouse: needFrom ? fromW : null,
        toWarehouse: needTo ? toW : null,
        qty: Number(qty),
        movedAt,
      });
      setQty('');
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Hareket kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const whName = (id: number | null): string =>
    id === null ? '—' : (warehouses.find((w) => w.id === id)?.name ?? String(id));
  const matName = (id: number): string => materials.find((m) => m.id === id)?.name ?? String(id);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          marginBottom: 10,
          alignItems: 'center',
        }}
      >
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as StockMoveKind)}
          style={fld({ width: 120 })}
        >
          {(Object.keys(KIND_LABELS) as StockMoveKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          value={materialId}
          onChange={(e) => setMaterialId(Number(e.target.value))}
          style={fld({ minWidth: 160 })}
        >
          <option value={0}>— Malzeme —</option>
          {materials.map((m) => (
            <option key={String(m.id)} value={m.id}>
              {m.code} — {m.name}
            </option>
          ))}
        </select>
        {needFrom ? (
          <select
            value={fromW}
            onChange={(e) => setFromW(Number(e.target.value))}
            style={fld({ width: 140 })}
          >
            <option value={0}>— Kaynak depo —</option>
            {warehouses.map((w) => (
              <option key={String(w.id)} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        ) : null}
        {needTo ? (
          <select
            value={toW}
            onChange={(e) => setToW(Number(e.target.value))}
            style={fld({ width: 140 })}
          >
            <option value={0}>— Hedef depo —</option>
            {warehouses.map((w) => (
              <option key={String(w.id)} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Miktar"
          style={fld({ width: 100 })}
        />
        <input
          type="date"
          value={movedAt}
          onChange={(e) => setMovedAt(e.target.value)}
          style={fld({ width: 150 })}
        />
        <button onClick={() => void record()} disabled={busy} style={btn()}>
          Kaydet
        </button>
      </div>

      <h4 style={{ fontSize: 13, margin: '6px 0' }}>Mevcut Stok</h4>
      <Table
        head={['Depo', 'Malzeme', 'Birim', 'Miktar']}
        rows={stock.map((s) => [
          s.warehouseName,
          `${s.materialCode} — ${s.materialName}`,
          s.unit,
          s.qty.toLocaleString('tr-TR'),
        ])}
        empty="Stok yok."
      />

      <h4 style={{ fontSize: 13, margin: '14px 0 6px' }}>Son Hareketler</h4>
      <Table
        head={['Tarih', 'Tür', 'Malzeme', 'Kaynak', 'Hedef', 'Miktar']}
        rows={movements
          .slice(0, 20)
          .map((m) => [
            m.movedAt,
            KIND_LABELS[m.kind],
            matName(m.materialId),
            whName(m.fromWarehouse),
            whName(m.toWarehouse),
            m.qty.toLocaleString('tr-TR'),
          ])}
        empty="Hareket yok."
      />
    </div>
  );
}

function RequestsSection({
  api,
  companyId,
  projectId,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  onError: (m: string | null) => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<MaterialRequestSummaryDto>>([]);
  const [materials, setMaterials] = useState<ReadonlyArray<MaterialDto>>([]);
  const [matId, setMatId] = useState(0);
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (): void => {
    api
      .listMaterialRequests(companyId, projectId)
      .then((r) => setRows(r.requests))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
    api
      .listMaterials(companyId)
      .then((r) => setMaterials(r.materials))
      .catch(() => undefined);
  };
  useEffect(load, [api, companyId, projectId]);

  const create = async (): Promise<void> => {
    if (!(matId > 0) || qty === '') {
      onError('Malzeme ve miktar zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.createMaterialRequest({
        companyId,
        projectId,
        lines: [{ materialId: matId, qty: Number(qty) }],
      });
      setQty('');
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Talep oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };
  const setStatus = async (
    id: number,
    status: 'submitted' | 'approved' | 'rejected',
  ): Promise<void> => {
    try {
      await api.changeMaterialRequestStatus(id, { companyId, status });
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Durum değiştirilemedi');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <select
          value={matId}
          onChange={(e) => setMatId(Number(e.target.value))}
          style={fld({ minWidth: 160 })}
        >
          <option value={0}>— Malzeme —</option>
          {materials.map((m) => (
            <option key={String(m.id)} value={m.id}>
              {m.code} — {m.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Miktar"
          style={fld({ width: 110 })}
        />
        <button onClick={() => void create()} disabled={busy} style={btn()}>
          + Talep
        </button>
      </div>
      <Table
        head={['Talep No', 'Durum', 'İşlem']}
        rows={rows.map((r) => [
          r.reqNo,
          REQ_STATUS_LABELS[r.status] ?? r.status,
          <span key="a" style={{ display: 'inline-flex', gap: 4 }}>
            {r.status === 'draft' ? (
              <button onClick={() => void setStatus(r.id, 'submitted')} style={miniBtn('#f59e0b')}>
                Gönder
              </button>
            ) : null}
            {r.status === 'submitted' ? (
              <button onClick={() => void setStatus(r.id, 'approved')} style={miniBtn('#10b981')}>
                Onayla
              </button>
            ) : null}
            {r.status === 'submitted' ? (
              <button onClick={() => void setStatus(r.id, 'rejected')} style={miniBtn('#ef4444')}>
                Reddet
              </button>
            ) : null}
          </span>,
        ])}
        empty="Talep yok."
      />
    </div>
  );
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: Array<Array<React.ReactNode>>;
  empty: string;
}): JSX.Element {
  if (rows.length === 0)
    return <p style={{ fontSize: 12, color: 'var(--ink-muted, #888)' }}>{empty}</p>;
  return (
    <table className="grid">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            {r.map((cell, ci) => (
              <td key={ci}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function fld(extra: React.CSSProperties): React.CSSProperties {
  return {
    width: '100%',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    background: 'var(--paper, #fff)',
    border: '1px solid var(--line-strong, #d6d3d1)',
    borderRadius: 'var(--radius, 6px)',
    color: 'var(--ink, #1c1917)',
    outline: 'none',
    minWidth: 0,
    ...extra,
  };
}
function btn(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '6px 12px',
    fontSize: 12.5,
    fontWeight: 500,
    fontFamily: 'inherit',
    border: '1px solid var(--line-strong, #d6d3d1)',
    borderRadius: 'var(--radius, 6px)',
    background: 'var(--paper, #fff)',
    color: 'var(--ink, #1c1917)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
function delBtn(): React.CSSProperties {
  return {
    padding: '3px 10px',
    border: 'none',
    borderRadius: 4,
    background: '#ef4444',
    color: '#fff',
    fontSize: 11,
    cursor: 'pointer',
  };
}
function miniBtn(bg: string): React.CSSProperties {
  return {
    padding: '3px 10px',
    border: 'none',
    borderRadius: 4,
    background: bg,
    color: '#fff',
    fontSize: 11,
    cursor: 'pointer',
  };
}
function errBox(): React.CSSProperties {
  return {
    padding: 10,
    background: 'var(--danger-bg, #fee2e2)',
    color: 'var(--danger, #b91c1c)',
    border: '1px solid var(--danger, #fca5a5)',
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 13,
  };
}
