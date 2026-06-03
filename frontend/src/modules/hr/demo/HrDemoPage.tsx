/**
 * HrDemoPage — Faz 4 / PR 5 standalone demo sayfası.
 *
 * App.jsx'e dokunmaz. 3 sekme: Organizasyon / Personel / Pozisyonlar.
 *
 * Auth token URL hash'inden (`#token=...`) veya localStorage'dan
 * (`promet_access_token`) okunur. Production'da auth modülünden gelir.
 */
import { useMemo, useState } from 'react';

import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import type { HrApi } from '../application/ports/HrApi';
import { HrApiClient } from '../infrastructure/api/HrApiClient';
import { ApplicationKanban } from '../presentation/components/ApplicationKanban';
import { CandidateForm } from '../presentation/components/CandidateForm';
import { EmployeesTable } from '../presentation/components/EmployeesTable';
import { OrgTreeView } from '../presentation/components/OrgTreeView';
import { PositionsList } from '../presentation/components/PositionsList';
import { RecruitmentFunnel } from '../presentation/components/RecruitmentFunnel';
import { useApplications } from '../presentation/hooks/useApplications';
import { useCandidates } from '../presentation/hooks/useCandidates';
import { useEmployees } from '../presentation/hooks/useEmployees';
import { useOrgTree } from '../presentation/hooks/useOrgTree';
import { usePositions } from '../presentation/hooks/usePositions';
import { useRecruitmentFunnel } from '../presentation/hooks/useRecruitmentFunnel';

export interface HrDemoPageProps {
  apiBaseUrl?: string;
  /** Override — yoksa hash veya localStorage'dan alınır. */
  accessToken?: string;
  /** Demo için default 1. */
  companyId?: number;
}

type Tab = 'org' | 'employees' | 'positions' | 'recruitment';

const TOKEN_STORAGE_KEY = 'promet_access_token';

export function HrDemoPage({
  apiBaseUrl = 'http://localhost:3000',
  accessToken,
  companyId = 1,
}: HrDemoPageProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('org');
  const [token, setToken] = useState<string | null>(() => accessToken ?? extractToken());

  const api: HrApi = useMemo(
    () => new HrApiClient(apiBaseUrl, new StaticAuthTokenProvider(token)),
    [apiBaseUrl, token],
  );

  const handleLogin = (t: string): void => {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    setToken(t);
  };

  const handleLogout = (): void => {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setToken(null);
  };

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 1100,
        margin: '0 auto',
        padding: 24,
      }}
    >
      <header
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>HR Demo (Faz 4)</h1>
          <p style={{ marginTop: 4, color: 'var(--ink-muted, #666)', fontSize: 13 }}>
            Standalone demo — backend `/v1/hr/*` rotalarını kullanır. Şirket id:{' '}
            <code>{companyId}</code>.
          </p>
        </div>
        {token !== null ? (
          <button type="button" onClick={handleLogout} style={btnStyle()}>
            Çıkış
          </button>
        ) : null}
      </header>

      {token === null ? (
        <HrLoginForm apiBaseUrl={apiBaseUrl} onLogin={handleLogin} />
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
          </nav>

          <main style={{ marginTop: 16 }}>
            {tab === 'org' ? <OrgTab api={api} companyId={companyId} /> : null}
            {tab === 'employees' ? <EmployeesTab api={api} companyId={companyId} /> : null}
            {tab === 'positions' ? <PositionsTab api={api} companyId={companyId} /> : null}
            {tab === 'recruitment' ? <RecruitmentTab api={api} companyId={companyId} /> : null}
          </main>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login formu — token yoksa gösterilir (AI/Notifications demo pattern'i)
// ---------------------------------------------------------------------------

function HrLoginForm({
  apiBaseUrl,
  onLogin,
}: {
  apiBaseUrl: string;
  onLogin: (token: string) => void;
}): JSX.Element {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { accessToken?: string };
      if (data.accessToken === undefined || data.accessToken === '') {
        throw new Error('Yanıtta accessToken yok');
      }
      onLogin(data.accessToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      style={{
        maxWidth: 360,
        marginTop: 24,
        padding: 20,
        border: '1px solid var(--line, #e5e7eb)',
        borderRadius: 8,
        background: 'var(--paper, #fff)',
      }}
    >
      <h2 style={{ fontSize: 16, marginTop: 0 }}>Giriş</h2>
      <p style={{ fontSize: 12, color: 'var(--ink-muted, #6b7280)', marginTop: 0 }}>
        HR rotaları kimlik doğrulaması ister. Demo kullanıcısı ile giriş yapın.
      </p>
      <form onSubmit={(ev) => void submit(ev)} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'block', fontSize: 13 }}>
          <span style={{ display: 'block', marginBottom: 4 }}>Kullanıcı adı</span>
          <input
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
            autoComplete="username"
            style={{ ...inputStyle(), width: '100%', minWidth: 0 }}
          />
        </label>
        <label style={{ display: 'block', fontSize: 13 }}>
          <span style={{ display: 'block', marginBottom: 4 }}>Şifre</span>
          <input
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            autoComplete="current-password"
            style={{ ...inputStyle(), width: '100%', minWidth: 0 }}
          />
        </label>
        {error !== null ? (
          <p
            style={{
              margin: 0,
              padding: '8px 10px',
              background: 'var(--danger-bg, #fee2e2)',
              color: 'var(--danger, #b91c1c)',
              border: '1px solid var(--danger, #fca5a5)',
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'var(--accent, #0066cc)',
            color: '#fff',
            borderRadius: 4,
            cursor: loading ? 'wait' : 'pointer',
            fontSize: 13,
          }}
        >
          {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
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
