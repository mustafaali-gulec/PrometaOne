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
import { EmployeesTable } from '../presentation/components/EmployeesTable';
import { OrgTreeView } from '../presentation/components/OrgTreeView';
import { PositionsList } from '../presentation/components/PositionsList';
import { useEmployees } from '../presentation/hooks/useEmployees';
import { useOrgTree } from '../presentation/hooks/useOrgTree';
import { usePositions } from '../presentation/hooks/usePositions';

export interface HrDemoPageProps {
  apiBaseUrl?: string;
  /** Override — yoksa hash veya localStorage'dan alınır. */
  accessToken?: string;
  /** Demo için default 1. */
  companyId?: number;
}

type Tab = 'org' | 'employees' | 'positions';

export function HrDemoPage({
  apiBaseUrl = 'http://localhost:3000',
  accessToken,
  companyId = 1,
}: HrDemoPageProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('org');

  const api: HrApi = useMemo(() => {
    const token = accessToken ?? extractToken();
    return new HrApiClient(apiBaseUrl, new StaticAuthTokenProvider(token));
  }, [apiBaseUrl, accessToken]);

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 1100,
        margin: '0 auto',
        padding: 24,
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>HR Demo (Faz 4)</h1>
        <p style={{ marginTop: 4, color: 'var(--ink-muted, #666)', fontSize: 13 }}>
          Standalone demo — backend `/v1/hr/*` rotalarını kullanır. Şirket
          id: <code>{companyId}</code>.
        </p>
      </header>

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
      </nav>

      <main style={{ marginTop: 16 }}>
        {tab === 'org' ? <OrgTab api={api} companyId={companyId} /> : null}
        {tab === 'employees' ? <EmployeesTab api={api} companyId={companyId} /> : null}
        {tab === 'positions' ? <PositionsTab api={api} companyId={companyId} /> : null}
      </main>
    </div>
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
    <Section
      title="Pozisyonlar"
      loading={loading}
      error={error}
      onReload={() => void refetch()}
    >
      <PositionsList positions={positions} loading={loading} />
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
