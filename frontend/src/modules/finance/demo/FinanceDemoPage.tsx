/**
 * FinanceDemoPage — Faz 5 / PR 7 standalone demo sayfası.
 *
 * App.jsx'e dokunmaz. 3 sekme: Bütçe / Nakit / Faturalar.
 * Auth token URL hash'inden (`#token=...`) veya localStorage'dan
 * (`promet_access_token`) okunur (HrDemoPage ile aynı).
 */
import { useMemo, useState } from 'react';

import { MoneyInput, RateInput } from '../../../shared/ui/MoneyInput';
import type {
  CategorySection,
  Currency,
  EndpointType,
  FlowDirection,
} from '../application/dto/FinanceDtos';
import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import type { EInvoiceApi } from '../application/ports/EInvoiceApi';
import type { FinanceApi } from '../application/ports/FinanceApi';
import { EInvoiceApiClient } from '../infrastructure/api/EInvoiceApiClient';
import { FinanceApiClient } from '../infrastructure/api/FinanceApiClient';
import { BudgetMatrixGrid } from '../presentation/components/BudgetMatrixGrid';
import { CashPositionCard } from '../presentation/components/CashPositionCard';
import { CurrentRatesCard } from '../presentation/components/CurrentRatesCard';
import { EInvoiceInbox } from '../presentation/components/EInvoiceInbox';
import { InvoicesTable } from '../presentation/components/InvoicesTable';
import { RevaluationsTable } from '../presentation/components/RevaluationsTable';
import { useBudgetMatrix } from '../presentation/hooks/useBudgetMatrix';
import { useCashPosition } from '../presentation/hooks/useCashPosition';
import { useCurrentRates } from '../presentation/hooks/useCurrentRates';
import { useEInvoices } from '../presentation/hooks/useEInvoices';
import { useInvoices } from '../presentation/hooks/useInvoices';
import { useRevaluations } from '../presentation/hooks/useRevaluations';

export type FinanceTab = 'budget' | 'cash' | 'invoices' | 'einvoice' | 'fx';

export interface FinanceDemoPageProps {
  apiBaseUrl?: string;
  accessToken?: string;
  companyId?: number;
  fiscalYear?: number;
  /** Açılışta seçili sekme (App.jsx menü eşlemesi için). */
  initialTab?: FinanceTab;
}

type Tab = FinanceTab;

export function FinanceDemoPage({
  apiBaseUrl = 'http://localhost:3000',
  accessToken,
  companyId = 1,
  fiscalYear = new Date().getFullYear(),
  initialTab = 'budget',
}: FinanceDemoPageProps): JSX.Element {
  const [tab, setTab] = useState<Tab>(initialTab);

  const api: FinanceApi = useMemo(() => {
    const token = accessToken ?? extractToken();
    return new FinanceApiClient(apiBaseUrl, new StaticAuthTokenProvider(token));
  }, [apiBaseUrl, accessToken]);

  const eApi: EInvoiceApi = useMemo(() => {
    const token = accessToken ?? extractToken();
    return new EInvoiceApiClient(apiBaseUrl, new StaticAuthTokenProvider(token));
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
        <h1 style={{ fontSize: 22, margin: 0 }}>Finans Demo (Faz 5)</h1>
        <p style={{ marginTop: 4, color: 'var(--ink-muted, #666)', fontSize: 13 }}>
          Standalone demo — backend `/v1/finance/*` rotalarını kullanır. Şirket id:{' '}
          <code>{companyId}</code>.
        </p>
      </header>

      <nav style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line, #e5e5e5)' }}>
        <TabButton active={tab === 'budget'} onClick={() => setTab('budget')}>
          Bütçe
        </TabButton>
        <TabButton active={tab === 'cash'} onClick={() => setTab('cash')}>
          Nakit
        </TabButton>
        <TabButton active={tab === 'invoices'} onClick={() => setTab('invoices')}>
          Faturalar
        </TabButton>
        <TabButton active={tab === 'einvoice'} onClick={() => setTab('einvoice')}>
          E-Fatura
        </TabButton>
        <TabButton active={tab === 'fx'} onClick={() => setTab('fx')}>
          Döviz/FX
        </TabButton>
      </nav>

      <main style={{ marginTop: 16 }}>
        {tab === 'budget' ? (
          <BudgetTab api={api} companyId={companyId} fiscalYear={fiscalYear} />
        ) : null}
        {tab === 'cash' ? <CashTab api={api} companyId={companyId} /> : null}
        {tab === 'invoices' ? <InvoicesTab api={api} companyId={companyId} /> : null}
        {tab === 'einvoice' ? <EInvoiceTab api={eApi} companyId={companyId} /> : null}
        {tab === 'fx' ? <FxTab api={eApi} companyId={companyId} /> : null}
      </main>
    </div>
  );
}

function BudgetTab({
  api,
  companyId,
  fiscalYear,
}: {
  api: FinanceApi;
  companyId: number;
  fiscalYear: number;
}): JSX.Element {
  const { matrix, loading, error, refetch } = useBudgetMatrix(api, companyId, fiscalYear);
  const [showForm, setShowForm] = useState(false);
  return (
    <Section
      title={`Bütçe Matrisi — ${fiscalYear}`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <button onClick={() => setShowForm((v) => !v)} style={btnStyle()}>
          {showForm ? 'Kapat' : '+ Kategori'}
        </button>
      }
    >
      {showForm ? (
        <CategoryCreateForm
          api={api}
          companyId={companyId}
          onDone={() => {
            setShowForm(false);
            void refetch();
          }}
        />
      ) : null}
      <BudgetMatrixGrid matrix={matrix} loading={loading} />
    </Section>
  );
}

function CashTab({ api, companyId }: { api: FinanceApi; companyId: number }): JSX.Element {
  const [type, setType] = useState<EndpointType>('kasa');
  const [accountId, setAccountId] = useState<number>(1);
  const [showForm, setShowForm] = useState(false);
  const { position, loading, error, refetch } = useCashPosition(api, companyId, type, accountId);
  return (
    <Section
      title="Nakit Pozisyonu"
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={type}
            onChange={(ev) => setType(ev.target.value as EndpointType)}
            style={selectStyle()}
          >
            <option value="kasa">Kasa</option>
            <option value="bank">Banka</option>
          </select>
          <input
            type="number"
            value={accountId}
            min={1}
            onChange={(ev) => setAccountId(Number(ev.target.value))}
            style={{ ...selectStyle(), width: 80 }}
          />
          {type === 'kasa' ? (
            <button onClick={() => setShowForm((v) => !v)} style={btnStyle()}>
              {showForm ? 'Kapat' : '+ Hareket'}
            </button>
          ) : null}
        </div>
      }
    >
      {showForm && type === 'kasa' ? (
        <KasaEntryForm
          api={api}
          companyId={companyId}
          kasaAccountId={accountId}
          onDone={() => {
            setShowForm(false);
            void refetch();
          }}
        />
      ) : null}
      <CashPositionCard position={position} loading={loading} />
    </Section>
  );
}

function InvoicesTab({ api, companyId }: { api: FinanceApi; companyId: number }): JSX.Element {
  const [type, setType] = useState<FlowDirection | ''>('');
  const [showForm, setShowForm] = useState(false);
  const { invoices, loading, error, refetch } = useInvoices(api, companyId, {
    ...(type !== '' ? { type } : {}),
  });
  return (
    <Section
      title={`Faturalar (${invoices.length})`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={type}
            onChange={(ev) => setType(ev.target.value as FlowDirection | '')}
            style={selectStyle()}
          >
            <option value="">Tümü</option>
            <option value="in">Alacak</option>
            <option value="out">Borç</option>
          </select>
          <button onClick={() => setShowForm((v) => !v)} style={btnStyle()}>
            {showForm ? 'Kapat' : '+ Fatura'}
          </button>
        </div>
      }
    >
      {showForm ? (
        <InvoiceCreateForm
          api={api}
          companyId={companyId}
          onDone={() => {
            setShowForm(false);
            void refetch();
          }}
        />
      ) : null}
      <InvoicesTable invoices={invoices} loading={loading} />
    </Section>
  );
}

function EInvoiceTab({ api, companyId }: { api: EInvoiceApi; companyId: number }): JSX.Element {
  const { einvoices, loading, error, refetch } = useEInvoices(api, companyId);

  const onImport = async (id: number): Promise<void> => {
    await api.importEInvoice(id, { companyId });
    await refetch();
  };
  const onIgnore = async (id: number): Promise<void> => {
    await api.ignoreEInvoice(id, { companyId });
    await refetch();
  };

  return (
    <Section
      title={`E-Fatura Gelen Kutusu (${einvoices.length})`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
    >
      <EInvoiceInbox
        einvoices={einvoices}
        loading={loading}
        onImport={(id) => void onImport(id)}
        onIgnore={(id) => void onIgnore(id)}
      />
    </Section>
  );
}

function FxTab({ api, companyId }: { api: EInvoiceApi; companyId: number }): JSX.Element {
  const {
    rates,
    loading: ratesLoading,
    error: ratesError,
    refetch: refetchRates,
  } = useCurrentRates(api);
  const {
    revaluations,
    loading: revLoading,
    error: revError,
    refetch: refetchRevals,
  } = useRevaluations(api, companyId);

  const onPost = async (id: number): Promise<void> => {
    await api.postRevaluation(id, companyId);
    await refetchRevals();
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Section
        title="Güncel Kurlar"
        loading={ratesLoading}
        error={ratesError}
        onReload={() => void refetchRates()}
      >
        <CurrentRatesCard rates={rates} loading={ratesLoading} />
      </Section>
      <Section
        title={`Kur Farkı Değerlemeleri (${revaluations.length})`}
        loading={revLoading}
        error={revError}
        onReload={() => void refetchRevals()}
      >
        <RevaluationsTable
          revaluations={revaluations}
          loading={revLoading}
          onPost={(id) => void onPost(id)}
        />
      </Section>
    </div>
  );
}

// --- Create formlari (Faz 5 — yaratma) -------------------------------------

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
        gap: 8,
        marginBottom: 12,
        padding: 12,
        border: '1px solid var(--line, #e5e7eb)',
        borderRadius: 6,
        background: 'var(--paper-2, #f9fafb)',
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
        padding: '7px 14px',
        border: 'none',
        background: 'var(--accent, #0066cc)',
        color: '#fff',
        borderRadius: 4,
        fontSize: 12,
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
    padding: '6px 8px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 12,
    minWidth: 0,
  };
}

function CategoryCreateForm({
  api,
  companyId,
  onDone,
}: {
  api: FinanceApi;
  companyId: number;
  onDone: () => void;
}): JSX.Element {
  const [section, setSection] = useState<CategorySection>('inflows');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (): Promise<void> => {
    if (name.trim() === '') {
      setErr('Kategori adı zorunlu');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createCategory({ companyId, section, name: name.trim() });
      setName('');
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kategori eklenemedi');
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormBox onSubmit={submit}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select
          value={section}
          onChange={(ev) => setSection(ev.target.value as CategorySection)}
          style={{ ...fieldStyle(), width: 200 }}
        >
          <option value="inflows">Gelirler (inflows)</option>
          <option value="outflows">Giderler (outflows)</option>
          <option value="nonPnlOutflows">P&amp;L Dışı (nonPnlOutflows)</option>
          <option value="kasaCategories">Kasa (kasaCategories)</option>
        </select>
        <input
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          placeholder="Kategori adı"
          style={{ ...fieldStyle(), flex: 1, minWidth: 140 }}
        />
      </div>
      <FormError msg={err} />
      <SubmitBtn busy={busy} label="Kategori ekle" />
    </FormBox>
  );
}

function KasaEntryForm({
  api,
  companyId,
  kasaAccountId,
  onDone,
}: {
  api: FinanceApi;
  companyId: number;
  kasaAccountId: number;
  onDone: () => void;
}): JSX.Element {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<FlowDirection>('in');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (): Promise<void> => {
    const amt = Number(amount);
    if (!(amt > 0)) {
      setErr('Tutar sıfırdan büyük olmalı');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.recordKasaEntry({
        companyId,
        kasaAccountId,
        date,
        type,
        amount: amt,
        description: description.trim() === '' ? null : description.trim(),
      });
      setAmount('');
      setDescription('');
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hareket eklenemedi');
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormBox onSubmit={submit}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
          style={{ ...fieldStyle(), width: 150 }}
        />
        <select
          value={type}
          onChange={(ev) => setType(ev.target.value as FlowDirection)}
          style={{ ...fieldStyle(), width: 110 }}
        >
          <option value="in">Giriş</option>
          <option value="out">Çıkış</option>
        </select>
        <MoneyInput
          value={amount}
          onChange={(v) => setAmount(v === '' ? '' : String(v))}
          placeholder="Tutar"
          style={{ ...fieldStyle(), width: 120 }}
        />
        <input
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          placeholder="Açıklama"
          style={{ ...fieldStyle(), flex: 1, minWidth: 120 }}
        />
      </div>
      <FormError msg={err} />
      <SubmitBtn busy={busy} label={`Kasa #${kasaAccountId} hareketi ekle`} />
    </FormBox>
  );
}

function InvoiceCreateForm({
  api,
  companyId,
  onDone,
}: {
  api: FinanceApi;
  companyId: number;
  onDone: () => void;
}): JSX.Element {
  const [type, setType] = useState<FlowDirection>('in');
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [subtotal, setSubtotal] = useState('');
  const [kdvRate, setKdvRate] = useState('20');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (): Promise<void> => {
    const sub = Number(subtotal);
    if (counterparty.trim() === '') {
      setErr('Karşı taraf zorunlu');
      return;
    }
    if (!(sub > 0)) {
      setErr('Ara toplam sıfırdan büyük olmalı');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createInvoice({
        companyId,
        type,
        counterparty: counterparty.trim(),
        dueDate,
        currency,
        subtotal: sub,
        kdvRate: Number(kdvRate) / 100,
        invoiceNo: invoiceNo.trim() === '' ? null : invoiceNo.trim(),
      });
      setCounterparty('');
      setSubtotal('');
      setInvoiceNo('');
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fatura oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormBox onSubmit={submit}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select
          value={type}
          onChange={(ev) => setType(ev.target.value as FlowDirection)}
          style={{ ...fieldStyle(), width: 130 }}
        >
          <option value="in">Alacak (in)</option>
          <option value="out">Borç (out)</option>
        </select>
        <input
          value={counterparty}
          onChange={(ev) => setCounterparty(ev.target.value)}
          placeholder="Karşı taraf"
          style={{ ...fieldStyle(), flex: 1, minWidth: 140 }}
        />
        <input
          value={invoiceNo}
          onChange={(ev) => setInvoiceNo(ev.target.value)}
          placeholder="Fatura no"
          style={{ ...fieldStyle(), width: 130 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="date"
          value={dueDate}
          onChange={(ev) => setDueDate(ev.target.value)}
          style={{ ...fieldStyle(), width: 150 }}
        />
        <select
          value={currency}
          onChange={(ev) => setCurrency(ev.target.value as Currency)}
          style={{ ...fieldStyle(), width: 90 }}
        >
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <MoneyInput
          value={subtotal}
          onChange={(v) => setSubtotal(v === '' ? '' : String(v))}
          placeholder="Ara toplam"
          style={{ ...fieldStyle(), width: 130 }}
        />
        <RateInput
          value={kdvRate}
          onChange={(v) => setKdvRate(v === '' ? '' : String(v))}
          placeholder="KDV %"
          style={{ ...fieldStyle(), width: 90 }}
        />
      </div>
      <FormError msg={err} />
      <SubmitBtn busy={busy} label="Fatura oluştur" />
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

function selectStyle(): React.CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 12,
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
