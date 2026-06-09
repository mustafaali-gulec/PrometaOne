/**
 * ConstructionPage — Şantiye Yönetim standalone demo / scoped-mount sayfası.
 *
 * App.jsx'e dokunmaz. Sekmeler: Projeler / Sözleşmeler / Keşif & Pursantaj / Poz Katalog. Auth token URL
 * hash'inden (`#token=...`) veya localStorage'dan (`promet_access_token`) okunur
 * (PurchasingPage ile aynı). views=[...] ile tek sekmeye scoped mount edilebilir.
 */
import { useEffect, useMemo, useState } from 'react';

import type {
  ContractDto,
  ContractParty,
  CurrencyCode,
  ProjectDto,
  ProjectStatus,
  ProjectType,
} from '../application/dto/ConstructionDtos';
import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import type { ConstructionApi } from '../application/ports/ConstructionApi';
import { ConstructionApiClient } from '../infrastructure/api/ConstructionApiClient';
import { BoqEditor, emptyRow, type BoqEditRow } from '../presentation/components/BoqEditor';
import { ContractsTable } from '../presentation/components/ContractsTable';
import { DepoManager } from '../presentation/components/DepoManager';
import { FinansManager } from '../presentation/components/FinansManager';
import { HakedisManager } from '../presentation/components/HakedisManager';
import { IsgucuManager } from '../presentation/components/IsgucuManager';
import { PozCatalogTable } from '../presentation/components/PozCatalogTable';
import { ProjectsKanban } from '../presentation/components/ProjectsKanban';
import { ProjectsTable } from '../presentation/components/ProjectsTable';
import { RaporManager } from '../presentation/components/RaporManager';
import { useContracts } from '../presentation/hooks/useContracts';
import { usePozCatalog } from '../presentation/hooks/usePozCatalog';
import { useProjects } from '../presentation/hooks/useProjects';

export type ConstructionTab =
  | 'projects'
  | 'contracts'
  | 'boq'
  | 'progress'
  | 'finance'
  | 'depot'
  | 'labor'
  | 'reports'
  | 'poz';

const ALL_TABS: ConstructionTab[] = [
  'projects',
  'contracts',
  'boq',
  'progress',
  'finance',
  'depot',
  'labor',
  'reports',
  'poz',
];
const TAB_LABELS: Record<ConstructionTab, string> = {
  projects: 'Projeler',
  contracts: 'Sözleşme & İhale',
  boq: 'Keşif & Pursantaj',
  progress: 'Hakediş',
  finance: 'Harcama & Finans',
  depot: 'Malzeme & Depo',
  labor: 'İş Gücü & Makine',
  reports: 'Raporlar',
  poz: 'Poz Katalog',
};

export interface ConstructionPageProps {
  apiBaseUrl?: string;
  accessToken?: string;
  companyId?: number;
  initialTab?: ConstructionTab;
  views?: ConstructionTab[];
}

export function ConstructionPage({
  apiBaseUrl = 'http://localhost:3000',
  accessToken,
  companyId = 1,
  initialTab,
  views,
}: ConstructionPageProps): JSX.Element {
  const scoped = Array.isArray(views) && views.length > 0;
  const visibleTabs: ConstructionTab[] = scoped ? views : ALL_TABS;
  const defaultTab: ConstructionTab =
    initialTab !== undefined && visibleTabs.includes(initialTab)
      ? initialTab
      : (visibleTabs[0] ?? 'projects');
  const [tab, setTab] = useState<ConstructionTab>(defaultTab);

  const api: ConstructionApi = useMemo(() => {
    const token = accessToken ?? extractToken();
    return new ConstructionApiClient(apiBaseUrl, new StaticAuthTokenProvider(token));
  }, [apiBaseUrl, accessToken]);

  const showTabs = visibleTabs.length > 1;

  return (
    <div
      style={
        scoped
          ? { padding: 4 }
          : {
              fontFamily: 'system-ui, -apple-system, sans-serif',
              maxWidth: 1100,
              margin: '0 auto',
              padding: 24,
            }
      }
    >
      {!scoped ? (
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Şantiye Yönetim Demo</h1>
          <p style={{ marginTop: 4, color: 'var(--ink-muted, #666)', fontSize: 13 }}>
            Standalone demo — backend `/v1/construction/*` rotalarını kullanır. Şirket id:{' '}
            <code>{companyId}</code>.
          </p>
        </header>
      ) : null}

      {showTabs ? (
        <nav style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line, #e5e5e5)' }}>
          {visibleTabs.map((tb) => (
            <TabButton key={tb} active={tab === tb} onClick={() => setTab(tb)}>
              {TAB_LABELS[tb]}
            </TabButton>
          ))}
        </nav>
      ) : null}

      <main style={{ marginTop: showTabs ? 16 : 0 }}>
        {tab === 'projects' ? <ProjectsTab api={api} companyId={companyId} /> : null}
        {tab === 'contracts' ? <ContractsTab api={api} companyId={companyId} /> : null}
        {tab === 'boq' ? <BoqTab api={api} companyId={companyId} /> : null}
        {tab === 'progress' ? <HakedisManager api={api} companyId={companyId} /> : null}
        {tab === 'finance' ? <FinansManager api={api} companyId={companyId} /> : null}
        {tab === 'depot' ? <DepoManager api={api} companyId={companyId} /> : null}
        {tab === 'labor' ? <IsgucuManager api={api} companyId={companyId} /> : null}
        {tab === 'reports' ? <RaporManager api={api} companyId={companyId} /> : null}
        {tab === 'poz' ? <PozTab api={api} companyId={companyId} /> : null}
      </main>
    </div>
  );
}

function ProjectsTab({ api, companyId }: { api: ConstructionApi; companyId: number }): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'table' | 'kanban'>('table');
  const { projects, loading, error, refetch } = useProjects(api, companyId);

  const onSetStatus = async (id: number, status: ProjectStatus): Promise<void> => {
    await api.changeProjectStatus(id, { companyId, status });
    await refetch();
  };
  const onDeactivate = async (id: number): Promise<void> => {
    await api.deactivateProject(id, companyId);
    await refetch();
  };

  return (
    <Section
      title={`Projeler (${projects.length})`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <>
          <ViewToggle mode={mode} onChange={setMode} />
          <button onClick={() => setShowForm((v) => !v)} style={btnStyle()}>
            {showForm ? 'Kapat' : '+ Proje'}
          </button>
        </>
      }
    >
      {showForm ? (
        <ProjectCreateForm
          api={api}
          companyId={companyId}
          onDone={() => {
            setShowForm(false);
            void refetch();
          }}
        />
      ) : null}
      {mode === 'kanban' ? (
        <ProjectsKanban projects={projects} onSetStatus={(id, s) => void onSetStatus(id, s)} />
      ) : (
        <ProjectsTable
          projects={projects}
          loading={loading}
          onSetStatus={(id, s) => void onSetStatus(id, s)}
          onDeactivate={(id) => void onDeactivate(id)}
        />
      )}
    </Section>
  );
}

/** Tablo ⇄ Kanban segment kontrolü (app accent stilinde). */
function ViewToggle({
  mode,
  onChange,
}: {
  mode: 'table' | 'kanban';
  onChange: (m: 'table' | 'kanban') => void;
}): JSX.Element {
  const seg = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: 12.5,
    fontWeight: 500,
    fontFamily: 'inherit',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--accent, #0a4d4a)' : 'var(--paper, #fff)',
    color: active ? '#fff' : 'var(--ink-soft, #57534e)',
  });
  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid var(--line-strong, #d6d3d1)',
        borderRadius: 'var(--radius, 6px)',
        overflow: 'hidden',
      }}
    >
      <button onClick={() => onChange('table')} style={seg(mode === 'table')}>
        ☰ Tablo
      </button>
      <button onClick={() => onChange('kanban')} style={seg(mode === 'kanban')}>
        ▦ Kanban
      </button>
    </div>
  );
}

function ContractsTab({
  api,
  companyId,
}: {
  api: ConstructionApi;
  companyId: number;
}): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const { contracts, loading, error, refetch } = useContracts(api, companyId);
  const { projects } = useProjects(api, companyId);

  return (
    <Section
      title={`Sözleşmeler (${contracts.length})`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <button
          onClick={() => setShowForm((v) => !v)}
          style={btnStyle()}
          disabled={projects.length === 0}
        >
          {showForm ? 'Kapat' : '+ Sözleşme'}
        </button>
      }
    >
      {projects.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--ink-muted, #888)', margin: '0 0 8px' }}>
          Önce bir proje oluşturun (sözleşme bir projeye bağlanır).
        </p>
      ) : null}
      {showForm ? (
        <ContractCreateForm
          api={api}
          companyId={companyId}
          projects={projects}
          onDone={() => {
            setShowForm(false);
            void refetch();
          }}
        />
      ) : null}
      <ContractsTable contracts={contracts} loading={loading} />
    </Section>
  );
}

function PozTab({ api, companyId }: { api: ConstructionApi; companyId: number }): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const { poz, loading, error, refetch } = usePozCatalog(api, companyId);

  const onDeactivate = async (id: number): Promise<void> => {
    await api.deactivatePoz(id, companyId);
    await refetch();
  };

  return (
    <Section
      title={`Poz Katalog (${poz.length})`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <button onClick={() => setShowForm((v) => !v)} style={btnStyle()}>
          {showForm ? 'Kapat' : '+ Poz'}
        </button>
      }
    >
      {showForm ? (
        <PozCreateForm
          api={api}
          companyId={companyId}
          onDone={() => {
            setShowForm(false);
            void refetch();
          }}
        />
      ) : null}
      <PozCatalogTable poz={poz} loading={loading} onDeactivate={(id) => void onDeactivate(id)} />
    </Section>
  );
}

function BoqTab({ api, companyId }: { api: ConstructionApi; companyId: number }): JSX.Element {
  const { contracts } = useContracts(api, companyId);
  const { poz } = usePozCatalog(api, companyId);
  const [contractId, setContractId] = useState<number>(0);
  const [rows, setRows] = useState<BoqEditRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    if (!(contractId > 0)) {
      setRows([emptyRow()]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getBoq(contractId, companyId)
      .then((dto) => {
        if (cancelled) return;
        setTotal(dto.totalAmount);
        setRows(
          dto.lines.length === 0
            ? [emptyRow()]
            : dto.lines.map((l) => ({
                pozId: l.pozId,
                pozNo: l.pozNo,
                description: l.description,
                unit: l.unit,
                quantity: String(l.quantity),
                unitPrice: String(l.unitPrice),
              })),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, companyId, contractId]);

  const onSave = async (): Promise<void> => {
    const lines = rows
      .filter((r) => r.description.trim() !== '')
      .map((r) => ({
        ...(r.pozId !== null ? { pozId: r.pozId } : {}),
        ...(r.pozNo !== null ? { pozNo: r.pozNo } : {}),
        description: r.description.trim(),
        unit: r.unit.trim() === '' ? 'ad' : r.unit.trim(),
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
      }));
    if (lines.length === 0) {
      setError('En az bir dolu satır gerekli');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dto = await api.saveBoq(contractId, { companyId, lines });
      setTotal(dto.totalAmount);
      setRows(
        dto.lines.map((l) => ({
          pozId: l.pozId,
          pozNo: l.pozNo,
          description: l.description,
          unit: l.unit,
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Keşif kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Keşif & Pursantaj" loading={loading} error={error} onReload={() => undefined}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-muted, #666)' }}>Sözleşme:</span>
        <select
          value={contractId}
          onChange={(ev) => setContractId(Number(ev.target.value))}
          style={{ ...fieldStyle(), minWidth: 280 }}
        >
          <option value={0}>— Sözleşme seç —</option>
          {contracts.map((c: ContractDto) => (
            <option key={String(c.id)} value={c.id}>
              {c.contractNo} — {c.title}
            </option>
          ))}
        </select>
        {total > 0 ? (
          <span style={{ fontSize: 12, color: 'var(--ink-muted, #666)' }}>
            Kayıtlı toplam: <strong>{total.toLocaleString('tr-TR')}</strong>
          </span>
        ) : null}
      </div>
      {contractId > 0 ? (
        <BoqEditor
          rows={rows}
          pozOptions={poz}
          onChange={setRows}
          onSave={() => void onSave()}
          saving={saving}
        />
      ) : (
        <p style={{ fontSize: 13, color: 'var(--ink-muted, #888)' }}>
          Keşif girmek için bir sözleşme seçin.
        </p>
      )}
    </Section>
  );
}

// --- Create formları --------------------------------------------------------

function PozCreateForm({
  api,
  companyId,
  onDone,
}: {
  api: ConstructionApi;
  companyId: number;
  onDone: () => void;
}): JSX.Element {
  const [pozNo, setPozNo] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('m3');
  const [unitPrice, setUnitPrice] = useState('');
  const [source, setSource] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (pozNo.trim() === '' || name.trim() === '' || unit.trim() === '') {
      setErr('Poz no, tanım ve birim zorunlu');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createPoz({
        companyId,
        pozNo: pozNo.trim(),
        name: name.trim(),
        unit: unit.trim(),
        unitPrice: unitPrice === '' ? 0 : Number(unitPrice),
        source: source.trim() === '' ? null : source.trim(),
        year: year === '' ? null : Number(year),
      });
      setPozNo('');
      setName('');
      setUnitPrice('');
      setSource('');
      setYear('');
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Poz eklenemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormBox onSubmit={submit}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={pozNo}
          onChange={(ev) => setPozNo(ev.target.value)}
          placeholder="Poz no (ör. Y.16.050/01)"
          style={{ ...fieldStyle(), width: 180 }}
        />
        <input
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          placeholder="Tanım"
          style={{ ...fieldStyle(), flex: 1, minWidth: 180 }}
        />
        <input
          value={unit}
          onChange={(ev) => setUnit(ev.target.value)}
          placeholder="Birim"
          style={{ ...fieldStyle(), width: 80 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="number"
          value={unitPrice}
          onChange={(ev) => setUnitPrice(ev.target.value)}
          placeholder="Birim fiyat"
          style={{ ...fieldStyle(), width: 130 }}
        />
        <input
          value={source}
          onChange={(ev) => setSource(ev.target.value)}
          placeholder="Kaynak (CSB/özel)"
          style={{ ...fieldStyle(), width: 150 }}
        />
        <input
          type="number"
          value={year}
          onChange={(ev) => setYear(ev.target.value)}
          placeholder="Yıl"
          style={{ ...fieldStyle(), width: 90 }}
        />
      </div>
      <FormError msg={err} />
      <SubmitBtn busy={busy} label="Poz ekle" />
    </FormBox>
  );
}

function ProjectCreateForm({
  api,
  companyId,
  onDone,
}: {
  api: ConstructionApi;
  companyId: number;
  onDone: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('private');
  const [currency, setCurrency] = useState<CurrencyCode>('TRY');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (name.trim() === '') {
      setErr('Proje adı zorunlu');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createProject({
        companyId,
        name: name.trim(),
        ...(code.trim() === '' ? {} : { code: code.trim() }),
        projectType,
        currency,
        budgetAmount: budget === '' ? 0 : Number(budget),
        location: location.trim() === '' ? null : location.trim(),
        startDate: startDate === '' ? null : startDate,
        plannedEnd: plannedEnd === '' ? null : plannedEnd,
      });
      setName('');
      setCode('');
      setBudget('');
      setLocation('');
      setStartDate('');
      setPlannedEnd('');
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Proje oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormBox onSubmit={submit}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          placeholder="Proje adı"
          style={{ ...fieldStyle(), flex: 1, minWidth: 180 }}
        />
        <input
          value={code}
          onChange={(ev) => setCode(ev.target.value)}
          placeholder="Kod (ops. — boşsa PRJ-NNN)"
          style={{ ...fieldStyle(), width: 200 }}
        />
        <select
          value={projectType}
          onChange={(ev) => setProjectType(ev.target.value as ProjectType)}
          style={{ ...fieldStyle(), width: 160 }}
        >
          <option value="private">Özel proje</option>
          <option value="public_tender">İhaleli (KİK)</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="number"
          value={budget}
          onChange={(ev) => setBudget(ev.target.value)}
          placeholder="Bütçe"
          style={{ ...fieldStyle(), width: 140 }}
        />
        <select
          value={currency}
          onChange={(ev) => setCurrency(ev.target.value as CurrencyCode)}
          style={{ ...fieldStyle(), width: 90 }}
        >
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(ev) => setStartDate(ev.target.value)}
          title="Başlangıç"
          style={{ ...fieldStyle(), width: 150 }}
        />
        <input
          type="date"
          value={plannedEnd}
          onChange={(ev) => setPlannedEnd(ev.target.value)}
          title="Planlanan bitiş"
          style={{ ...fieldStyle(), width: 150 }}
        />
      </div>
      <input
        value={location}
        onChange={(ev) => setLocation(ev.target.value)}
        placeholder="Konum (ops.)"
        style={{ ...fieldStyle(), width: '100%' }}
      />
      <FormError msg={err} />
      <SubmitBtn busy={busy} label="Proje oluştur" />
    </FormBox>
  );
}

function ContractCreateForm({
  api,
  companyId,
  projects,
  onDone,
}: {
  api: ConstructionApi;
  companyId: number;
  projects: ReadonlyArray<ProjectDto>;
  onDone: () => void;
}): JSX.Element {
  const [projectId, setProjectId] = useState<number>(0);
  const [partyKind, setPartyKind] = useState<ContractParty>('employer');
  const [title, setTitle] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('TRY');
  const [retentionPct, setRetentionPct] = useState('');
  const [advancePct, setAdvancePct] = useState('');
  const [priceDiffOn, setPriceDiffOn] = useState(false);
  const [isTender, setIsTender] = useState(false);
  const [ikn, setIkn] = useState('');
  const [procedure, setProcedure] = useState('');
  const [workIncreasePct, setWorkIncreasePct] = useState('');
  const [perfBondPct, setPerfBondPct] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (!(projectId > 0)) {
      setErr('Proje seçilmeli');
      return;
    }
    if (title.trim() === '') {
      setErr('Sözleşme başlığı zorunlu');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createContract({
        companyId,
        projectId,
        partyKind,
        title: title.trim(),
        ...(contractNo.trim() === '' ? {} : { contractNo: contractNo.trim() }),
        amount: amount === '' ? 0 : Number(amount),
        currency,
        retentionPct: retentionPct === '' ? 0 : Number(retentionPct),
        advancePct: advancePct === '' ? 0 : Number(advancePct),
        priceDiffOn,
        tender: isTender
          ? {
              ikn: ikn.trim() === '' ? null : ikn.trim(),
              procedure: procedure.trim() === '' ? null : procedure.trim(),
              workIncreasePct: workIncreasePct === '' ? 0 : Number(workIncreasePct),
              perfBondPct: perfBondPct === '' ? 0 : Number(perfBondPct),
            }
          : null,
      });
      setTitle('');
      setContractNo('');
      setAmount('');
      setRetentionPct('');
      setAdvancePct('');
      setIkn('');
      setProcedure('');
      setWorkIncreasePct('');
      setPerfBondPct('');
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sözleşme oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormBox onSubmit={submit}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select
          value={projectId}
          onChange={(ev) => setProjectId(Number(ev.target.value))}
          style={{ ...fieldStyle(), minWidth: 200 }}
        >
          <option value={0}>— Proje seç —</option>
          {projects.map((p) => (
            <option key={String(p.id)} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
        <select
          value={partyKind}
          onChange={(ev) => setPartyKind(ev.target.value as ContractParty)}
          style={{ ...fieldStyle(), width: 180 }}
        >
          <option value="employer">İşveren (gelir)</option>
          <option value="subcontractor">Taşeron (gider)</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          placeholder="Sözleşme başlığı"
          style={{ ...fieldStyle(), flex: 1, minWidth: 180 }}
        />
        <input
          value={contractNo}
          onChange={(ev) => setContractNo(ev.target.value)}
          placeholder="No (ops. — boşsa SZL-YYYY-NNNN)"
          style={{ ...fieldStyle(), width: 220 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="number"
          value={amount}
          onChange={(ev) => setAmount(ev.target.value)}
          placeholder="Sözleşme bedeli"
          style={{ ...fieldStyle(), width: 150 }}
        />
        <select
          value={currency}
          onChange={(ev) => setCurrency(ev.target.value as CurrencyCode)}
          style={{ ...fieldStyle(), width: 90 }}
        >
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <input
          type="number"
          value={retentionPct}
          onChange={(ev) => setRetentionPct(ev.target.value)}
          placeholder="Teminat %"
          style={{ ...fieldStyle(), width: 110 }}
        />
        <input
          type="number"
          value={advancePct}
          onChange={(ev) => setAdvancePct(ev.target.value)}
          placeholder="Avans %"
          style={{ ...fieldStyle(), width: 110 }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <input
          type="checkbox"
          checked={priceDiffOn}
          onChange={(ev) => setPriceDiffOn(ev.target.checked)}
        />
        Fiyat farkı uygulanır
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <input
          type="checkbox"
          checked={isTender}
          onChange={(ev) => setIsTender(ev.target.checked)}
        />
        İhaleli iş (KİK / EKAP bilgisi gir)
      </label>
      {isTender ? (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            padding: 8,
            border: '1px dashed var(--line, #d1d5db)',
            borderRadius: 4,
          }}
        >
          <input
            value={ikn}
            onChange={(ev) => setIkn(ev.target.value)}
            placeholder="İKN (EKAP)"
            style={{ ...fieldStyle(), width: 160 }}
          />
          <input
            value={procedure}
            onChange={(ev) => setProcedure(ev.target.value)}
            placeholder="İhale usulü"
            style={{ ...fieldStyle(), width: 150 }}
          />
          <input
            type="number"
            value={workIncreasePct}
            onChange={(ev) => setWorkIncreasePct(ev.target.value)}
            placeholder="İş artışı %"
            style={{ ...fieldStyle(), width: 110 }}
          />
          <input
            type="number"
            value={perfBondPct}
            onChange={(ev) => setPerfBondPct(ev.target.value)}
            placeholder="Kesin teminat %"
            style={{ ...fieldStyle(), width: 130 }}
          />
        </div>
      ) : null}
      <FormError msg={err} />
      <SubmitBtn busy={busy} label="Sözleşme oluştur" />
    </FormBox>
  );
}

// --- UI primitive'leri -----------------------------------------------------
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 14px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'inherit',
        fontWeight: active ? 600 : 500,
        marginBottom: -1,
        borderBottom: active ? '2px solid var(--accent, #0a4d4a)' : '2px solid transparent',
        color: active ? 'var(--accent, #0a4d4a)' : 'var(--ink-soft, #57534e)',
      }}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  loading,
  error,
  onReload,
  toolbar,
  children,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--ink, #1c1917)' }}>
          {title}
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {toolbar}
          <button onClick={onReload} disabled={loading} style={btnStyle()}>
            {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>
      </div>
      {error !== null ? (
        <div
          style={{
            padding: 12,
            background: 'var(--danger-bg, #fee2e2)',
            color: 'var(--danger, #b91c1c)',
            border: '1px solid var(--danger, #fca5a5)',
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          Hata: {error}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function FormBox({
  children,
  onSubmit,
}: {
  children: React.ReactNode;
  onSubmit: () => void | Promise<void>;
}): JSX.Element {
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        void onSubmit();
      }}
      style={{
        display: 'grid',
        gap: 10,
        marginBottom: 14,
        padding: 14,
        border: '1px solid var(--line, #e7e5e4)',
        borderRadius: 'var(--radius-md, 8px)',
        background: 'var(--bg-soft, #faf9f7)',
      }}
    >
      {children}
    </form>
  );
}

function FormError({ msg }: { msg: string | null }): JSX.Element | null {
  if (msg === null) return null;
  return <p style={{ margin: 0, fontSize: 12, color: 'var(--danger, #b91c1c)' }}>{msg}</p>;
}

function SubmitBtn({ busy, label }: { busy: boolean; label: string }): JSX.Element {
  return (
    <button
      type="submit"
      disabled={busy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '7px 14px',
        border: '1px solid var(--accent, #0a4d4a)',
        background: 'var(--accent, #0a4d4a)',
        color: '#fff',
        borderRadius: 'var(--radius, 6px)',
        fontSize: 12.5,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: busy ? 'wait' : 'pointer',
        justifySelf: 'start',
      }}
    >
      {busy ? 'Kaydediliyor…' : label}
    </button>
  );
}

function fieldStyle(): React.CSSProperties {
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
  };
}

function btnStyle(): React.CSSProperties {
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

function extractToken(): string | null {
  if (typeof window !== 'undefined' && window.location.hash.length > 1) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const t = params.get('token');
    if (t !== null && t.length > 0) return t;
  }
  if (typeof window !== 'undefined') {
    try {
      const t = window.localStorage.getItem('promet_access_token');
      if (t !== null && t.length > 0) return t;
    } catch {
      /* ignore */
    }
  }
  return null;
}
