/**
 * IsgucuManager — İş Gücü & Makine (SF-6). Sekmeler: Personel + Puantaj (proje
 * bazlı), Makine (firma geneli) + Makine Logları (proje bazlı). Üstte işçilik/
 * makine maliyet özeti.
 */
import { useEffect, useState } from 'react';

import { MoneyInput } from '../../../../shared/ui/MoneyInput';
import type {
  MachineDto,
  MachineKind,
  MachineLogDto,
  PersonnelDto,
  ProjectDto,
  TimesheetDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { useProjects } from '../hooks/useProjects';

type Sub = 'personnel' | 'timesheets' | 'machines' | 'machinelogs';
const SUB_LABELS: Record<Sub, string> = {
  personnel: 'Personel',
  timesheets: 'Puantaj',
  machines: 'Makine Parkı',
  machinelogs: 'Makine Logları',
};
const KIND_LABELS: Record<MachineKind, string> = {
  owned: 'Özmal',
  rented: 'Kiralık',
  subcontractor: 'Taşeron',
};

export interface IsgucuManagerProps {
  api: ConstructionApi;
  companyId: number;
}

export function IsgucuManager({ api, companyId }: IsgucuManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [sub, setSub] = useState<Sub>('personnel');
  const [projectId, setProjectId] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    laborCost: number;
    machineWorkCost: number;
    fuelCost: number;
    maintCost: number;
    total: number;
  } | null>(null);
  const [tick, setTick] = useState(0);
  const projectScoped = sub !== 'machines';

  useEffect(() => {
    if (!(projectId > 0)) {
      setSummary(null);
      return;
    }
    let off = false;
    api
      .getLaborCostSummary(projectId, companyId)
      .then((s) => {
        if (!off) setSummary(s);
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [api, companyId, projectId, tick]);
  const refresh = (): void => setTick((t) => t + 1);

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

      {projectScoped && projectId > 0 && summary !== null ? (
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            padding: 12,
            border: '1px solid var(--line, #e5e7eb)',
            borderRadius: 6,
            background: 'var(--paper-2, #f9fafb)',
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <Metric label="İşçilik" value={summary.laborCost.toLocaleString('tr-TR')} />
          <Metric
            label="Makine (çalışma)"
            value={summary.machineWorkCost.toLocaleString('tr-TR')}
          />
          <Metric label="Yakıt" value={summary.fuelCost.toLocaleString('tr-TR')} />
          <Metric label="Bakım" value={summary.maintCost.toLocaleString('tr-TR')} />
          <Metric label="Toplam Maliyet" value={summary.total.toLocaleString('tr-TR')} strong />
        </div>
      ) : null}

      {error !== null ? <div style={errBox()}>Hata: {error}</div> : null}

      {sub === 'machines' ? (
        <MachinesSection api={api} companyId={companyId} onError={setError} />
      ) : null}
      {projectScoped && projectId === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-muted, #888)' }}>Bir proje seçin.</p>
      ) : null}
      {sub === 'personnel' && projectId > 0 ? (
        <PersonnelSection
          api={api}
          companyId={companyId}
          projectId={projectId}
          onError={setError}
          onChanged={refresh}
        />
      ) : null}
      {sub === 'timesheets' && projectId > 0 ? (
        <TimesheetsSection
          api={api}
          companyId={companyId}
          projectId={projectId}
          onError={setError}
          onChanged={refresh}
        />
      ) : null}
      {sub === 'machinelogs' && projectId > 0 ? (
        <MachineLogsSection
          api={api}
          companyId={companyId}
          projectId={projectId}
          onError={setError}
          onChanged={refresh}
        />
      ) : null}
    </section>
  );
}

function PersonnelSection({
  api,
  companyId,
  projectId,
  onError,
  onChanged,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  onError: (m: string | null) => void;
  onChanged: () => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<PersonnelDto>>([]);
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [daily, setDaily] = useState('');
  const [sub, setSub] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = (): void => {
    api
      .listPersonnel(companyId, projectId)
      .then((r) => setRows(r.personnel))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, [api, companyId, projectId]);
  const add = async (): Promise<void> => {
    if (name.trim() === '') {
      onError('Ad zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.createPersonnel({
        companyId,
        projectId,
        fullName: name.trim(),
        trade: trade.trim() || null,
        dailyCost: daily === '' ? 0 : Number(daily),
        isSubcontractor: sub,
      });
      setName('');
      setTrade('');
      setDaily('');
      setSub(false);
      load();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Personel eklenemedi');
    } finally {
      setBusy(false);
    }
  };
  const del = async (id: number): Promise<void> => {
    await api.deactivatePersonnel(id, companyId);
    load();
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ad Soyad"
          style={fld({ flex: 1, minWidth: 160 })}
        />
        <input
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          placeholder="Meslek"
          style={fld({ width: 130 })}
        />
        <MoneyInput
          value={daily}
          onChange={(v) => setDaily(v === '' ? '' : String(v))}
          placeholder="Yevmiye"
          style={fld({ width: 110 })}
        />
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={sub} onChange={(e) => setSub(e.target.checked)} />
          Taşeron
        </label>
        <button onClick={() => void add()} disabled={busy} style={btn()}>
          + Personel
        </button>
      </div>
      <Table
        head={['Ad', 'Meslek', 'Yevmiye', 'Tip', '']}
        rows={rows.map((p) => [
          p.fullName,
          p.trade ?? '—',
          p.dailyCost.toLocaleString('tr-TR'),
          p.isSubcontractor ? 'Taşeron' : 'Kadrolu',
          <button key="d" onClick={() => void del(p.id)} style={delBtn()}>
            Pasifleştir
          </button>,
        ])}
        empty="Personel yok."
      />
    </div>
  );
}

function TimesheetsSection({
  api,
  companyId,
  projectId,
  onError,
  onChanged,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  onError: (m: string | null) => void;
  onChanged: () => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<TimesheetDto>>([]);
  const [personnel, setPersonnel] = useState<ReadonlyArray<PersonnelDto>>([]);
  const [pid, setPid] = useState(0);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('P');
  const [busy, setBusy] = useState(false);
  const load = (): void => {
    api
      .listTimesheets(companyId, projectId)
      .then((r) => setRows(r.timesheets))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
    api
      .listPersonnel(companyId, projectId)
      .then((r) => setPersonnel(r.personnel))
      .catch(() => undefined);
  };
  useEffect(load, [api, companyId, projectId]);
  const save = async (): Promise<void> => {
    if (!(pid > 0) || date === '') {
      onError('Personel ve tarih zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.saveTimesheet({
        companyId,
        personnelId: pid,
        workDate: date,
        statusCode: status,
        hours: status === 'P' ? 8 : status === 'Y' ? 4 : 0,
      });
      load();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Puantaj kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };
  const pname = (id: number): string => personnel.find((p) => p.id === id)?.fullName ?? String(id);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <select
          value={pid}
          onChange={(e) => setPid(Number(e.target.value))}
          style={fld({ minWidth: 180 })}
        >
          <option value={0}>— Personel —</option>
          {personnel.map((p) => (
            <option key={String(p.id)} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={fld({ width: 150 })}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={fld({ width: 110 })}
        >
          <option value="P">Tam (P)</option>
          <option value="Y">Yarım (Y)</option>
          <option value="X">Yok (X)</option>
          <option value="I">İzin (İ)</option>
        </select>
        <button onClick={() => void save()} disabled={busy} style={btn()}>
          Puantaj Kaydet
        </button>
      </div>
      <Table
        head={['Tarih', 'Personel', 'Durum', 'Saat']}
        rows={rows.map((t) => [t.workDate, pname(t.personnelId), t.statusCode, String(t.hours)])}
        empty="Puantaj kaydı yok."
      />
    </div>
  );
}

function MachinesSection({
  api,
  companyId,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  onError: (m: string | null) => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<MachineDto>>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<MachineKind>('owned');
  const [hourly, setHourly] = useState('');
  const [busy, setBusy] = useState(false);
  const load = (): void => {
    api
      .listMachines(companyId)
      .then((r) => setRows(r.machines))
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
      await api.createMachine({
        companyId,
        code: code.trim(),
        name: name.trim(),
        kind,
        hourlyCost: hourly === '' ? 0 : Number(hourly),
      });
      setCode('');
      setName('');
      setHourly('');
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Makine eklenemedi');
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
          placeholder="Kod"
          style={fld({ width: 110 })}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Makine adı"
          style={fld({ flex: 1, minWidth: 150 })}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as MachineKind)}
          style={fld({ width: 120 })}
        >
          {(Object.keys(KIND_LABELS) as MachineKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <MoneyInput
          value={hourly}
          onChange={(v) => setHourly(v === '' ? '' : String(v))}
          placeholder="Saat ücreti"
          style={fld({ width: 110 })}
        />
        <button onClick={() => void add()} disabled={busy} style={btn()}>
          + Makine
        </button>
      </div>
      <Table
        head={['Kod', 'Ad', 'Tip', 'Saat Ücreti']}
        rows={rows.map((m) => [
          m.code,
          m.name,
          KIND_LABELS[m.kind],
          m.hourlyCost.toLocaleString('tr-TR'),
        ])}
        empty="Makine yok."
      />
    </div>
  );
}

function MachineLogsSection({
  api,
  companyId,
  projectId,
  onError,
  onChanged,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  onError: (m: string | null) => void;
  onChanged: () => void;
}): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<MachineLogDto>>([]);
  const [machines, setMachines] = useState<ReadonlyArray<MachineDto>>([]);
  const [mid, setMid] = useState(0);
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [fuel, setFuel] = useState('');
  const [maint, setMaint] = useState('');
  const [busy, setBusy] = useState(false);
  const load = (): void => {
    api
      .listMachineLogs(companyId, projectId)
      .then((r) => setRows(r.logs))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
    api
      .listMachines(companyId)
      .then((r) => setMachines(r.machines))
      .catch(() => undefined);
  };
  useEffect(load, [api, companyId, projectId]);
  const add = async (): Promise<void> => {
    if (!(mid > 0) || date === '') {
      onError('Makine ve tarih zorunlu');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.createMachineLog({
        companyId,
        machineId: mid,
        projectId,
        logDate: date,
        workHours: hours === '' ? 0 : Number(hours),
        fuelCost: fuel === '' ? 0 : Number(fuel),
        maintCost: maint === '' ? 0 : Number(maint),
      });
      setHours('');
      setFuel('');
      setMaint('');
      load();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Log eklenemedi');
    } finally {
      setBusy(false);
    }
  };
  const mname = (id: number): string => machines.find((m) => m.id === id)?.name ?? String(id);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <select
          value={mid}
          onChange={(e) => setMid(Number(e.target.value))}
          style={fld({ minWidth: 160 })}
        >
          <option value={0}>— Makine —</option>
          {machines.map((m) => (
            <option key={String(m.id)} value={m.id}>
              {m.code} — {m.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={fld({ width: 150 })}
        />
        <input
          type="number"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Saat"
          style={fld({ width: 90 })}
        />
        <MoneyInput
          value={fuel}
          onChange={(v) => setFuel(v === '' ? '' : String(v))}
          placeholder="Yakıt ₺"
          style={fld({ width: 100 })}
        />
        <MoneyInput
          value={maint}
          onChange={(v) => setMaint(v === '' ? '' : String(v))}
          placeholder="Bakım ₺"
          style={fld({ width: 100 })}
        />
        <button onClick={() => void add()} disabled={busy} style={btn()}>
          + Log
        </button>
      </div>
      <Table
        head={['Tarih', 'Makine', 'Saat', 'Yakıt', 'Bakım']}
        rows={rows.map((l) => [
          l.logDate,
          mname(l.machineId),
          String(l.workHours),
          l.fuelCost.toLocaleString('tr-TR'),
          l.maintCost.toLocaleString('tr-TR'),
        ])}
        empty="Log yok."
      />
    </div>
  );
}

function Metric({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): JSX.Element {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ink-muted, #888)' }}>{label}</div>
      <div style={{ fontWeight: strong === true ? 700 : 600 }}>{value}</div>
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
