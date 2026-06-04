/**
 * HrDemoPage — İK modülü ana giriş bileşeni.
 *
 * Sekmeler: Organizasyon / Personel / Pozisyonlar / İşe Alım.
 * Oturum token'ı ana uygulamanın login köprüsünden (`promet_access_token`)
 * gelir; ayrı login formu yoktur.
 */
import { useMemo, useState } from 'react';

import type { AccessApi } from '../../access/application/ports/AccessApi';
import { StaticAuthTokenProvider as AccessStaticAuthTokenProvider } from '../../access/application/ports/AuthTokenProvider';
import { AccessApiClient } from '../../access/infrastructure/api/AccessApiClient';
import {
  LocalStorageAuthTokenProvider,
  createTokenRefresher,
  hasRefreshToken,
} from '../../access/infrastructure/auth/RefreshingAuthTokenProvider';
import { AccessPanel } from '../../access/presentation/components/AccessPanel';
import type { AssetType, PayrollItemDto, PayrollRunDto } from '../application/dto/HrDtos';
import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import type { HrApi } from '../application/ports/HrApi';
import { HrApiClient } from '../infrastructure/api/HrApiClient';
import { ApplicationKanban } from '../presentation/components/ApplicationKanban';
import { AssetsTable } from '../presentation/components/AssetsTable';
import { CandidateForm } from '../presentation/components/CandidateForm';
import { EmployeesTable } from '../presentation/components/EmployeesTable';
import { LeaveRequestsTable } from '../presentation/components/LeaveRequestsTable';
import { OrgTreeView } from '../presentation/components/OrgTreeView';
import { PayrollRunsTable } from '../presentation/components/PayrollRunsTable';
import { PayrollSlipModal } from '../presentation/components/PayrollSlipModal';
import { PositionsList } from '../presentation/components/PositionsList';
import { RecruitmentFunnel } from '../presentation/components/RecruitmentFunnel';
import { useApplications } from '../presentation/hooks/useApplications';
import { useAssets } from '../presentation/hooks/useAssets';
import { useCandidates } from '../presentation/hooks/useCandidates';
import { useEmployees } from '../presentation/hooks/useEmployees';
import { useLeaveRequests } from '../presentation/hooks/useLeaveRequests';
import { useOrgTree } from '../presentation/hooks/useOrgTree';
import { usePayrollRuns } from '../presentation/hooks/usePayrollRuns';
import { usePositions } from '../presentation/hooks/usePositions';
import { useRecruitmentFunnel } from '../presentation/hooks/useRecruitmentFunnel';

export interface HrDemoPageProps {
  apiBaseUrl?: string;
  /** Override — yoksa hash veya localStorage'dan alınır. */
  accessToken?: string;
  /** Demo için default 1. */
  companyId?: number;
}

type Tab =
  | 'org'
  | 'employees'
  | 'positions'
  | 'recruitment'
  | 'leaves'
  | 'payroll'
  | 'assets'
  | 'access';

export function HrDemoPage({
  apiBaseUrl = '',
  accessToken,
  companyId = 1,
}: HrDemoPageProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('org');
  const [token] = useState<string | null>(() => accessToken ?? extractToken());

  // Refresh token varsa: access token'i localStorage'dan taze okuyan +
  // 401'de /v1/auth/refresh ile yenileyen davranisa gec. Aksi halde (ornegin
  // token yalnizca URL hash'inden geldiyse) eski static davranis korunur.
  const api: HrApi = useMemo(() => {
    if (hasRefreshToken()) {
      return new HrApiClient(
        apiBaseUrl,
        new LocalStorageAuthTokenProvider(),
        createTokenRefresher(apiBaseUrl),
      );
    }
    return new HrApiClient(apiBaseUrl, new StaticAuthTokenProvider(token));
  }, [apiBaseUrl, token]);

  const accessApi: AccessApi = useMemo(() => {
    if (hasRefreshToken()) {
      return new AccessApiClient(
        apiBaseUrl,
        new LocalStorageAuthTokenProvider(),
        createTokenRefresher(apiBaseUrl),
      );
    }
    return new AccessApiClient(apiBaseUrl, new AccessStaticAuthTokenProvider(token));
  }, [apiBaseUrl, token]);

  return (
    <div className="card" style={{ display: 'grid', gap: 16 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>İnsan Kaynakları</h1>
        </div>
      </header>

      {token === null ? (
        <HrReloginNotice />
      ) : (
        <>
          <nav style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line, #e5e5e5)' }}>
            <TabButton active={tab === 'org'} onClick={() => setTab('org')}>
              Organizasyon
            </TabButton>
            <TabButton active={tab === 'employees'} onClick={() => setTab('employees')}>
              Personel
            </TabButton>
            <TabButton active={tab === 'positions'} onClick={() => setTab('positions')}>
              Pozisyonlar
            </TabButton>
            <TabButton active={tab === 'recruitment'} onClick={() => setTab('recruitment')}>
              İşe Alım
            </TabButton>
            <TabButton active={tab === 'leaves'} onClick={() => setTab('leaves')}>
              İzinler
            </TabButton>
            <TabButton active={tab === 'payroll'} onClick={() => setTab('payroll')}>
              Bordro
            </TabButton>
            <TabButton active={tab === 'assets'} onClick={() => setTab('assets')}>
              Zimmet
            </TabButton>
            <TabButton active={tab === 'access'} onClick={() => setTab('access')}>
              Roller ve İzinler
            </TabButton>
          </nav>

          <main style={{ marginTop: 16 }}>
            {tab === 'org' ? <OrgTab api={api} companyId={companyId} /> : null}
            {tab === 'employees' ? <EmployeesTab api={api} companyId={companyId} /> : null}
            {tab === 'positions' ? <PositionsTab api={api} companyId={companyId} /> : null}
            {tab === 'recruitment' ? <RecruitmentTab api={api} companyId={companyId} /> : null}
            {tab === 'leaves' ? <LeavesTab api={api} companyId={companyId} /> : null}
            {tab === 'payroll' ? <PayrollTab api={api} companyId={companyId} /> : null}
            {tab === 'assets' ? <AssetsTab api={api} companyId={companyId} /> : null}
            {tab === 'access' ? <AccessTab api={accessApi} companyId={companyId} /> : null}
          </main>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Oturum köprüsü yoksa: ana uygulamadan yeniden giriş bilgilendirmesi
// ---------------------------------------------------------------------------

function HrReloginNotice(): JSX.Element {
  return (
    <section
      style={{
        padding: 16,
        border: '1px solid var(--danger, #fca5a5)',
        background: 'var(--danger-bg, #fef2f2)',
        color: 'var(--danger, #b91c1c)',
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>Oturum doğrulanamadı</strong>
      İK ekranları için aktif bir oturum gerekiyor. Lütfen ana uygulamadan çıkış yapıp tekrar giriş
      yapın; oturumunuz İK modülüne otomatik olarak aktarılacaktır.
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tab içerikleri
// ---------------------------------------------------------------------------

function OrgTab({ api, companyId }: { api: HrApi; companyId: number }): JSX.Element {
  const { tree, loading, error, refetch } = useOrgTree(api, companyId);
  return (
    <Section
      title="Organizasyon Ağacı"
      loading={loading}
      error={error}
      onReload={() => void refetch()}
    >
      <OrgTreeView tree={tree} />
    </Section>
  );
}

function EmployeesTab({ api, companyId }: { api: HrApi; companyId: number }): JSX.Element {
  const [q, setQ] = useState<string>('');
  const { employees, loading, error, refetch } = useEmployees(api, companyId, { q });
  return (
    <Section
      title="Personel"
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <input
          type="text"
          placeholder="Ad / soyad / no ara…"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          style={inputStyle()}
        />
      }
    >
      <EmployeesTable employees={employees} loading={loading} />
    </Section>
  );
}

function LeavesTab({ api, companyId }: { api: HrApi; companyId: number }): JSX.Element {
  const { leaveRequests, loading, error, refetch } = useLeaveRequests(api, companyId);

  const handleApprove = async (id: number): Promise<void> => {
    await api.approveLeave(id, companyId);
    await refetch();
  };
  const handleReject = async (id: number): Promise<void> => {
    await api.rejectLeave(id, companyId);
    await refetch();
  };
  const handleCancel = async (id: number): Promise<void> => {
    await api.cancelLeave(id, companyId);
    await refetch();
  };

  return (
    <Section title="İzin Talepleri" loading={loading} error={error} onReload={() => void refetch()}>
      <LeaveRequestsTable
        leaveRequests={leaveRequests}
        loading={loading}
        onApprove={(id) => void handleApprove(id)}
        onReject={(id) => void handleReject(id)}
        onCancel={(id) => void handleCancel(id)}
      />
    </Section>
  );
}

function PayrollTab({ api, companyId }: { api: HrApi; companyId: number }): JSX.Element {
  const { payrollRuns, loading, error, refetch } = usePayrollRuns(api, companyId);
  const [creating, setCreating] = useState<boolean>(false);
  const now = new Date();
  const [year, setYear] = useState<number>(now.getUTCFullYear());
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);

  // Fiş modalı state'i
  const [slipRun, setSlipRun] = useState<PayrollRunDto | null>(null);
  const [slipItems, setSlipItems] = useState<ReadonlyArray<PayrollItemDto>>([]);
  const [slipLoading, setSlipLoading] = useState<boolean>(false);

  const handleCreate = async (): Promise<void> => {
    await api.createPayrollRun({ companyId, periodYear: year, periodMonth: month });
    setCreating(false);
    await refetch();
  };
  const handleRunBatch = async (id: number): Promise<void> => {
    await api.runPayrollBatch(id, companyId);
    await refetch();
  };
  const handleFinalize = async (id: number): Promise<void> => {
    await api.finalizePayrollRun(id, companyId);
    await refetch();
  };
  const handleView = async (id: number): Promise<void> => {
    setSlipLoading(true);
    try {
      const res = await api.getPayrollRun(id, companyId);
      setSlipRun(res.run);
      setSlipItems(res.items);
    } finally {
      setSlipLoading(false);
    }
  };

  return (
    <Section
      title="Bordro Koşuları"
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          style={{
            padding: '6px 12px',
            border: 'none',
            background: 'var(--accent, #0066cc)',
            color: '#fff',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {creating ? 'Kapat' : '+ Yeni Koşu'}
        </button>
      }
    >
      {creating ? (
        <div
          style={{
            background: 'var(--paper-2, #f9fafb)',
            border: '1px solid var(--line, #e5e7eb)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <input
            type="number"
            value={year}
            min={2000}
            max={2200}
            onChange={(ev) => setYear(Number(ev.target.value))}
            style={inputStyle()}
          />
          <input
            type="number"
            value={month}
            min={1}
            max={12}
            onChange={(ev) => setMonth(Number(ev.target.value))}
            style={inputStyle()}
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: '#10b981',
              color: '#fff',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Oluştur
          </button>
        </div>
      ) : null}
      <PayrollRunsTable
        payrollRuns={payrollRuns}
        loading={loading}
        onRunBatch={(id) => void handleRunBatch(id)}
        onFinalize={(id) => void handleFinalize(id)}
        onView={(id) => void handleView(id)}
      />
      <PayrollSlipModal
        run={slipRun}
        items={slipItems}
        loading={slipLoading}
        onClose={() => setSlipRun(null)}
      />
    </Section>
  );
}

const ASSET_TYPE_OPTIONS: ReadonlyArray<{ value: AssetType; label: string }> = [
  { value: 'laptop', label: 'Dizüstü' },
  { value: 'desktop', label: 'Masaüstü' },
  { value: 'phone', label: 'Telefon' },
  { value: 'vehicle', label: 'Araç' },
  { value: 'card', label: 'Kart' },
  { value: 'monitor', label: 'Monitör' },
  { value: 'headset', label: 'Kulaklık' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'printer', label: 'Yazıcı' },
  { value: 'furniture', label: 'Mobilya' },
  { value: 'key_lock', label: 'Anahtar/Kilit' },
  { value: 'uniform', label: 'Üniforma' },
  { value: 'ppe', label: 'KKD' },
  { value: 'other', label: 'Diğer' },
];

function AssetsTab({ api, companyId }: { api: HrApi; companyId: number }): JSX.Element {
  const { assets, loading, error, refetch } = useAssets(api, companyId);
  const [creating, setCreating] = useState<boolean>(false);
  const [assetType, setAssetType] = useState<AssetType>('laptop');
  const [name, setName] = useState<string>('');

  const handleCreate = async (): Promise<void> => {
    if (name.trim().length === 0) return;
    await api.createAsset({ companyId, assetType, name: name.trim() });
    setName('');
    setCreating(false);
    await refetch();
  };
  const handleAssign = async (id: number): Promise<void> => {
    const raw = window.prompt('Zimmetlenecek personel ID:');
    if (raw === null) return;
    const employeeId = Number(raw);
    if (!Number.isInteger(employeeId) || employeeId <= 0) return;
    await api.assignAsset(id, companyId, employeeId);
    await refetch();
  };
  const handleReturn = async (id: number): Promise<void> => {
    const note = window.prompt('İade notu (opsiyonel):');
    await api.returnAsset(id, companyId, note === null || note === '' ? undefined : note);
    await refetch();
  };

  return (
    <Section
      title="Varlık Havuzu (Zimmet)"
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          style={{
            padding: '6px 12px',
            border: 'none',
            background: 'var(--accent, #0066cc)',
            color: '#fff',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {creating ? 'Kapat' : '+ Yeni Varlık'}
        </button>
      }
    >
      {creating ? (
        <div
          style={{
            background: 'var(--paper-2, #f9fafb)',
            border: '1px solid var(--line, #e5e7eb)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <select
            value={assetType}
            onChange={(ev) => setAssetType(ev.target.value as AssetType)}
            style={inputStyle()}
          >
            {ASSET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={name}
            placeholder="Varlık adı"
            onChange={(ev) => setName(ev.target.value)}
            style={{ ...inputStyle(), minWidth: 200 }}
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: '#10b981',
              color: '#fff',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Oluştur
          </button>
        </div>
      ) : null}
      <AssetsTable
        assets={assets}
        loading={loading}
        onAssign={(id) => void handleAssign(id)}
        onReturn={(id) => void handleReturn(id)}
      />
    </Section>
  );
}

function PositionsTab({ api, companyId }: { api: HrApi; companyId: number }): JSX.Element {
  const { positions, loading, error, refetch } = usePositions(api, companyId);
  return (
    <Section title="Pozisyonlar" loading={loading} error={error} onReload={() => void refetch()}>
      <PositionsList positions={positions} loading={loading} />
    </Section>
  );
}

function RecruitmentTab({ api, companyId }: { api: HrApi; companyId: number }): JSX.Element {
  const { positions } = usePositions(api, companyId, { status: 'open' });
  const [positionId, setPositionId] = useState<number | null>(null);

  // İlk açık pozisyonu otomatik seç
  const effectivePositionId = positionId ?? (positions.length > 0 ? positions[0]!.id : null);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <RecruitmentFunnelSection api={api} companyId={companyId} positionId={effectivePositionId} />

      <Section
        title="Açık Pozisyon Başvuruları"
        loading={false}
        error={null}
        onReload={() => {
          /* alt section kendi refetch'ini çalıştırır */
        }}
        toolbar={
          <select
            value={effectivePositionId ?? ''}
            onChange={(ev) =>
              setPositionId(ev.target.value === '' ? null : Number(ev.target.value))
            }
            style={{
              padding: '6px 8px',
              border: '1px solid var(--line, #d1d5db)',
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <option value="">— Pozisyon seçin —</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        }
      >
        {effectivePositionId === null ? (
          <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
            Açık pozisyon yok veya seçilmedi.
          </div>
        ) : (
          <KanbanForPosition api={api} companyId={companyId} positionId={effectivePositionId} />
        )}
      </Section>

      <CandidatesSection api={api} companyId={companyId} />
    </div>
  );
}

function RecruitmentFunnelSection({
  api,
  companyId,
  positionId,
}: {
  api: HrApi;
  companyId: number;
  positionId: number | null;
}): JSX.Element {
  const { funnel, loading, error, refetch } = useRecruitmentFunnel(api, companyId, {
    ...(positionId !== null ? { positionId } : {}),
  });
  return (
    <Section
      title={positionId === null ? 'Huni (Tüm Şirket)' : 'Huni (Pozisyon Bazlı)'}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
    >
      <RecruitmentFunnel funnel={funnel} loading={loading} />
    </Section>
  );
}

function KanbanForPosition({
  api,
  companyId,
  positionId,
}: {
  api: HrApi;
  companyId: number;
  positionId: number;
}): JSX.Element {
  const { applications, loading, error, refetch } = useApplications(api, companyId, {
    positionId,
  });

  const onMoveStage = async (
    applicationId: number,
    newStage: 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn',
  ): Promise<void> => {
    await api.moveApplicationStage(applicationId, { companyId, newStage });
    await refetch();
  };

  if (error !== null) {
    return (
      <div
        style={{
          padding: 12,
          background: 'var(--danger-bg, #fef2f2)',
          color: 'var(--danger, #b91c1c)',
          border: '1px solid var(--danger, #fca5a5)',
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        {error}
      </div>
    );
  }
  return (
    <ApplicationKanban applications={applications} loading={loading} onMoveStage={onMoveStage} />
  );
}

function CandidatesSection({ api, companyId }: { api: HrApi; companyId: number }): JSX.Element {
  const { candidates, loading, error, refetch } = useCandidates(api, companyId);
  const [formOpen, setFormOpen] = useState<boolean>(false);

  const handleSubmit = async (values: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    source: 'referral' | 'linkedin' | 'jobboard' | 'direct' | 'agency' | 'other';
    cvUrl: string | null;
    notes: string | null;
  }): Promise<void> => {
    await api.registerCandidate({ companyId, ...values });
    setFormOpen(false);
    await refetch();
  };

  return (
    <Section
      title={`Aday Havuzu (${candidates.length})`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          style={{
            padding: '6px 12px',
            border: 'none',
            background: 'var(--accent, #0066cc)',
            color: '#fff',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {formOpen ? 'Kapat' : '+ Yeni Aday'}
        </button>
      }
    >
      {formOpen ? (
        <div
          style={{
            background: 'var(--paper-2, #f9fafb)',
            border: '1px solid var(--line, #e5e7eb)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <CandidateForm onSubmit={handleSubmit} onCancel={() => setFormOpen(false)} />
        </div>
      ) : null}
      {candidates.length === 0 ? (
        <div style={{ padding: 12, fontStyle: 'italic', color: 'var(--ink-muted, #888)' }}>
          Aday yok. Yukarıdan yeni aday ekleyin.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {candidates.map((c) => (
            <li
              key={c.id}
              style={{
                background: 'var(--paper, #fff)',
                border: '1px solid var(--line, #e5e7eb)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <strong>{c.fullName}</strong>
              <span style={{ color: 'var(--ink-muted, #6b7280)', fontSize: 12 }}>
                {c.email ?? '—'}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: 'var(--paper-2, #f3f4f6)',
                  color: 'var(--ink-muted, #6b7280)',
                  marginLeft: 'auto',
                }}
              >
                {c.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// UI primitive'leri
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Access (Roller ve İzinler) sekmesi
// ---------------------------------------------------------------------------
function AccessTab({ api, companyId }: { api: AccessApi; companyId: number }): JSX.Element {
  return <AccessPanel api={api} companyId={companyId} />;
}

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
        padding: '8px 16px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        borderBottom: active ? '2px solid var(--accent, #0066cc)' : '2px solid transparent',
        color: active ? 'var(--accent, #0066cc)' : 'var(--ink, #111)',
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
        <h2 style={{ fontSize: 16, margin: 0 }}>{title}</h2>
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

function btnStyle(): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    background: 'var(--paper, #fff)',
    cursor: 'pointer',
    fontSize: 12,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 12,
    minWidth: 200,
  };
}

// ---------------------------------------------------------------------------
// Token kaynağı
// ---------------------------------------------------------------------------
function extractToken(): string | null {
  // 1) URL hash: #token=...
  if (typeof window !== 'undefined' && window.location.hash.length > 1) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const t = params.get('token');
    if (t !== null && t.length > 0) return t;
  }
  // 2) localStorage
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
