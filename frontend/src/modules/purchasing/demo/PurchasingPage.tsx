/**
 * PurchasingPage — Satınalma standalone demo / scoped-mount sayfası.
 *
 * App.jsx'e dokunmaz. 3 sekme: Tedarikçiler / Talepler / Siparişler.
 * Auth token URL hash'inden (`#token=...`) veya localStorage'dan
 * (`promet_access_token`) okunur (FinanceDemoPage ile aynı).
 */
import { useMemo, useState } from 'react';

import type {
  CariClass,
  CurrencyCode,
  PersonType,
  VendorDto,
} from '../application/dto/PurchasingDtos';
import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import type { CreateRequestItemBody, PurchasingApi } from '../application/ports/PurchasingApi';
import { PurchasingApiClient } from '../infrastructure/api/PurchasingApiClient';
import { PurchaseOrdersTable } from '../presentation/components/PurchaseOrdersTable';
import { PurchaseRequestsTable } from '../presentation/components/PurchaseRequestsTable';
import { VendorsTable } from '../presentation/components/VendorsTable';
import { usePurchaseOrders } from '../presentation/hooks/usePurchaseOrders';
import { usePurchaseRequests } from '../presentation/hooks/usePurchaseRequests';
import { useVendors } from '../presentation/hooks/useVendors';

export type PurchasingTab = 'vendors' | 'requests' | 'orders';

const ALL_TABS: PurchasingTab[] = ['vendors', 'requests', 'orders'];
const TAB_LABELS: Record<PurchasingTab, string> = {
  vendors: 'Tedarikçiler',
  requests: 'Talepler',
  orders: 'Siparişler',
};

export interface PurchasingPageProps {
  apiBaseUrl?: string;
  accessToken?: string;
  companyId?: number;
  /** Açılışta seçili sekme (App.jsx menü eşlemesi için). */
  initialTab?: PurchasingTab;
  /**
   * Verilirse yalnızca bu sekmeler gösterilir ("görünüm-bazlı" mount):
   * demo başlığı gizlenir; tek sekmede sekme çubuğu da gizlenir.
   * Belirtilmezse tüm sekmeler + demo başlığı gösterilir (standalone demo).
   */
  views?: PurchasingTab[];
}

type Tab = PurchasingTab;

export function PurchasingPage({
  apiBaseUrl = 'http://localhost:3000',
  accessToken,
  companyId = 1,
  initialTab,
  views,
}: PurchasingPageProps): JSX.Element {
  const scoped = Array.isArray(views) && views.length > 0;
  const visibleTabs: PurchasingTab[] = scoped ? views : ALL_TABS;
  const defaultTab: Tab =
    initialTab !== undefined && visibleTabs.includes(initialTab)
      ? initialTab
      : (visibleTabs[0] ?? 'vendors');
  const [tab, setTab] = useState<Tab>(defaultTab);

  const api: PurchasingApi = useMemo(() => {
    const token = accessToken ?? extractToken();
    return new PurchasingApiClient(apiBaseUrl, new StaticAuthTokenProvider(token));
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
          <h1 style={{ fontSize: 22, margin: 0 }}>Satınalma Demo</h1>
          <p style={{ marginTop: 4, color: 'var(--ink-muted, #666)', fontSize: 13 }}>
            Standalone demo — backend `/v1/purchasing/*` rotalarını kullanır. Şirket id:{' '}
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
        {tab === 'vendors' ? <VendorsTab api={api} companyId={companyId} /> : null}
        {tab === 'requests' ? <RequestsTab api={api} companyId={companyId} /> : null}
        {tab === 'orders' ? <OrdersTab api={api} companyId={companyId} /> : null}
      </main>
    </div>
  );
}

function VendorsTab({ api, companyId }: { api: PurchasingApi; companyId: number }): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const { vendors, loading, error, refetch } = useVendors(api, companyId);
  return (
    <Section
      title={`Tedarikçiler (${vendors.length})`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <button onClick={() => setShowForm((v) => !v)} style={btnStyle()}>
          {showForm ? 'Kapat' : '+ Tedarikçi'}
        </button>
      }
    >
      {showForm ? (
        <VendorCreateForm
          api={api}
          companyId={companyId}
          onDone={() => {
            setShowForm(false);
            void refetch();
          }}
        />
      ) : null}
      <VendorsTable vendors={vendors} loading={loading} />
    </Section>
  );
}

function RequestsTab({ api, companyId }: { api: PurchasingApi; companyId: number }): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const { requests, loading, error, refetch } = usePurchaseRequests(api, companyId);

  const onApprove = async (id: number): Promise<void> => {
    await api.changeRequestStatus(id, { companyId, status: 'approved' });
    await refetch();
  };
  const onReject = async (id: number): Promise<void> => {
    await api.changeRequestStatus(id, { companyId, status: 'rejected' });
    await refetch();
  };

  return (
    <Section
      title={`Talepler (${requests.length})`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <button onClick={() => setShowForm((v) => !v)} style={btnStyle()}>
          {showForm ? 'Kapat' : '+ Talep'}
        </button>
      }
    >
      {showForm ? (
        <RequestCreateForm
          api={api}
          companyId={companyId}
          onDone={() => {
            setShowForm(false);
            void refetch();
          }}
        />
      ) : null}
      <PurchaseRequestsTable
        requests={requests}
        loading={loading}
        onApprove={(id) => void onApprove(id)}
        onReject={(id) => void onReject(id)}
      />
    </Section>
  );
}

function OrdersTab({ api, companyId }: { api: PurchasingApi; companyId: number }): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const { orders, loading, error, refetch } = usePurchaseOrders(api, companyId);
  const { vendors } = useVendors(api, companyId);

  const onMarkOrdered = async (id: number): Promise<void> => {
    await api.changeOrderStatus(id, { companyId, status: 'ordered' });
    await refetch();
  };
  const onMarkReceived = async (id: number): Promise<void> => {
    await api.changeOrderStatus(id, { companyId, status: 'received' });
    await refetch();
  };
  const onCancel = async (id: number): Promise<void> => {
    await api.changeOrderStatus(id, { companyId, status: 'cancelled' });
    await refetch();
  };

  return (
    <Section
      title={`Siparişler (${orders.length})`}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      toolbar={
        <button onClick={() => setShowForm((v) => !v)} style={btnStyle()}>
          {showForm ? 'Kapat' : '+ Sipariş'}
        </button>
      }
    >
      {showForm ? (
        <OrderCreateForm
          api={api}
          companyId={companyId}
          vendors={vendors}
          onDone={() => {
            setShowForm(false);
            void refetch();
          }}
        />
      ) : null}
      <PurchaseOrdersTable
        orders={orders}
        loading={loading}
        onMarkOrdered={(id) => void onMarkOrdered(id)}
        onMarkReceived={(id) => void onMarkReceived(id)}
        onCancel={(id) => void onCancel(id)}
      />
    </Section>
  );
}

// --- Create formlari --------------------------------------------------------

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

function VendorCreateForm({
  api,
  companyId,
  onDone,
}: {
  api: PurchasingApi;
  companyId: number;
  onDone: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [personType, setPersonType] = useState<PersonType>('legal');
  const [cariClass, setCariClass] = useState<CariClass>('satici');
  const [taxId, setTaxId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (): Promise<void> => {
    if (name.trim() === '') {
      setErr('Tedarikçi adı zorunlu');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createVendor({
        companyId,
        name: name.trim(),
        personType,
        cariClass,
        taxId: taxId.trim() === '' ? null : taxId.trim(),
      });
      setName('');
      setTaxId('');
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Tedarikçi eklenemedi');
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
          placeholder="Tedarikçi adı"
          style={{ ...fieldStyle(), flex: 1, minWidth: 160 }}
        />
        <input
          value={taxId}
          onChange={(ev) => setTaxId(ev.target.value)}
          placeholder="Vergi no (ops.)"
          style={{ ...fieldStyle(), width: 140 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select
          value={personType}
          onChange={(ev) => setPersonType(ev.target.value as PersonType)}
          style={{ ...fieldStyle(), width: 140 }}
        >
          <option value="real">Gerçek kişi (real)</option>
          <option value="legal">Tüzel kişi (legal)</option>
        </select>
        <select
          value={cariClass}
          onChange={(ev) => setCariClass(ev.target.value as CariClass)}
          style={{ ...fieldStyle(), width: 140 }}
        >
          <option value="satici">Satıcı (satici)</option>
          <option value="alici">Alıcı (alici)</option>
        </select>
      </div>
      <FormError msg={err} />
      <SubmitBtn busy={busy} label="Tedarikçi ekle" />
    </FormBox>
  );
}

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

function RequestCreateForm({
  api,
  companyId,
  onDone,
}: {
  api: PurchasingApi;
  companyId: number;
  onDone: () => void;
}): JSX.Element {
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [currency, setCurrency] = useState<CurrencyCode>('TRY');
  const [justification, setJustification] = useState('');
  const [requiredBy, setRequiredBy] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const updateItem = (idx: number, patch: Partial<ItemRow>): void => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = (): void => {
    setItems((prev) => [...prev, { description: '', quantity: '1', unitPrice: '' }]);
  };
  const removeItem = (idx: number): void => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const submit = async (): Promise<void> => {
    const built: CreateRequestItemBody[] = [];
    for (const it of items) {
      const desc = it.description.trim();
      const qty = Number(it.quantity);
      const price = Number(it.unitPrice);
      if (desc === '') {
        setErr('Her kalem için açıklama zorunlu');
        return;
      }
      if (!(qty > 0)) {
        setErr('Miktar sıfırdan büyük olmalı');
        return;
      }
      if (!(price >= 0)) {
        setErr('Birim fiyat negatif olamaz');
        return;
      }
      built.push({ description: desc, quantity: qty, unitPrice: price });
    }
    if (built.length === 0) {
      setErr('En az bir kalem gerekli');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createRequest({
        companyId,
        category,
        priority,
        currency,
        justification: justification.trim() === '' ? null : justification.trim(),
        requiredBy: requiredBy === '' ? null : requiredBy,
        items: built,
        submit: true,
      });
      setItems([{ description: '', quantity: '1', unitPrice: '' }]);
      setJustification('');
      setRequiredBy('');
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Talep oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormBox onSubmit={submit}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={category}
          onChange={(ev) => setCategory(ev.target.value)}
          placeholder="Kategori"
          style={{ ...fieldStyle(), width: 140 }}
        />
        <input
          value={priority}
          onChange={(ev) => setPriority(ev.target.value)}
          placeholder="Öncelik"
          style={{ ...fieldStyle(), width: 120 }}
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
          value={requiredBy}
          onChange={(ev) => setRequiredBy(ev.target.value)}
          style={{ ...fieldStyle(), width: 150 }}
        />
      </div>
      <input
        value={justification}
        onChange={(ev) => setJustification(ev.target.value)}
        placeholder="Gerekçe (ops.)"
        style={{ ...fieldStyle(), width: '100%' }}
      />
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((it, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={it.description}
              onChange={(ev) => updateItem(idx, { description: ev.target.value })}
              placeholder="Açıklama"
              style={{ ...fieldStyle(), flex: 1, minWidth: 140 }}
            />
            <input
              type="number"
              value={it.quantity}
              onChange={(ev) => updateItem(idx, { quantity: ev.target.value })}
              placeholder="Miktar"
              style={{ ...fieldStyle(), width: 90 }}
            />
            <input
              type="number"
              value={it.unitPrice}
              onChange={(ev) => updateItem(idx, { unitPrice: ev.target.value })}
              placeholder="Birim fiyat"
              style={{ ...fieldStyle(), width: 110 }}
            />
            <button
              type="button"
              onClick={() => removeItem(idx)}
              disabled={items.length <= 1}
              style={btnStyle()}
            >
              −
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem} style={{ ...btnStyle(), justifySelf: 'start' }}>
          + Kalem
        </button>
      </div>
      <FormError msg={err} />
      <SubmitBtn busy={busy} label="Talep oluştur" />
    </FormBox>
  );
}

function OrderCreateForm({
  api,
  companyId,
  vendors,
  onDone,
}: {
  api: PurchasingApi;
  companyId: number;
  vendors: ReadonlyArray<VendorDto>;
  onDone: () => void;
}): JSX.Element {
  const [vendorId, setVendorId] = useState<number>(0);
  const [prId, setPrId] = useState('');
  const [note, setNote] = useState('');
  const [markOrdered, setMarkOrdered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (): Promise<void> => {
    if (!(vendorId > 0)) {
      setErr('Tedarikçi seçilmeli');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const pr = prId.trim();
      await api.createOrder({
        companyId,
        vendorId,
        prId: pr === '' ? null : Number(pr),
        note: note.trim() === '' ? null : note.trim(),
        markOrdered,
      });
      setPrId('');
      setNote('');
      setMarkOrdered(false);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sipariş oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };
  const hasVendors = vendors.length > 0;
  return (
    <FormBox onSubmit={submit}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select
          value={vendorId}
          onChange={(ev) => setVendorId(Number(ev.target.value))}
          disabled={!hasVendors}
          style={{ ...fieldStyle(), minWidth: 200 }}
        >
          {hasVendors ? (
            <>
              <option value={0}>— Tedarikçi seç —</option>
              {vendors.map((v) => (
                <option key={String(v.id)} value={v.id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </>
          ) : (
            <option value={0}>— Tedarikçi yok —</option>
          )}
        </select>
        <input
          value={prId}
          onChange={(ev) => setPrId(ev.target.value)}
          placeholder="Talep id (ops.)"
          style={{ ...fieldStyle(), width: 130 }}
        />
      </div>
      <input
        value={note}
        onChange={(ev) => setNote(ev.target.value)}
        placeholder="Not (ops.)"
        style={{ ...fieldStyle(), width: '100%' }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <input
          type="checkbox"
          checked={markOrdered}
          onChange={(ev) => setMarkOrdered(ev.target.checked)}
        />
        Oluştururken sipariş ver (markOrdered)
      </label>
      <FormError msg={err} />
      <SubmitBtn busy={busy} label="Sipariş oluştur" />
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
