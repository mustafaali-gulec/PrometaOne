/**
 * ExpenseCardsPage — Gider Kartları yönetim ekranı (ayrı menü).
 *
 * Malzeme kartları (construction.materials) muadili: kart-liste (grid) +
 * sekmeli editör modalı (Genel · Muhasebe & Vergi · Bütçe & Varsayılanlar) +
 * arama + pasifleştir. Backend /v1/expense/cards rotalarını kullanır.
 * App.jsx'ten `<ExpenseCardsPage apiBaseUrl="" companyId={..} lang={lang} />`
 * şeklinde mount edilir.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Archive, FileText, Pencil, Trash2 } from 'lucide-react';

import { confirmDialog } from '../../../shared/feedback';
import type {
  ExpenseCardAttributes,
  ExpenseCardDto,
  ExpenseCardMovement,
  ExpenseKasaAccountRef,
  FlowDirection,
  PaymentMethod,
} from '../application/dto/ExpenseDtos';
import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import type { ExpenseApi } from '../application/ports/ExpenseApi';
import { ExpenseApiClient } from '../infrastructure/api/ExpenseApiClient';

import { el } from './i18n';
import { extractToken } from './token';

export interface ExpenseCardsPageProps {
  apiBaseUrl?: string;
  accessToken?: string;
  companyId?: number;
  lang?: string;
  /** Kasa hareketleri (App.jsx `data.kasaEntries`) — kart ekstresini besler. */
  movements?: ReadonlyArray<ExpenseCardMovement>;
  /** Kasa hesapları — ekstrede kasa adını göstermek için. */
  kasaAccounts?: ReadonlyArray<ExpenseKasaAccountRef>;
}

export function ExpenseCardsPage({
  apiBaseUrl = '',
  accessToken,
  companyId = 1,
  lang = 'tr',
  movements = [],
  kasaAccounts = [],
}: ExpenseCardsPageProps): JSX.Element {
  const api: ExpenseApi = useMemo(() => {
    const token = accessToken ?? extractToken();
    return new ExpenseApiClient(apiBaseUrl, new StaticAuthTokenProvider(token));
  }, [apiBaseUrl, accessToken]);

  const [cards, setCards] = useState<ReadonlyArray<ExpenseCardDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);
  /** Editör açık mı: 'new' | düzenlenecek kart | null (kapalı). */
  const [editorState, setEditorState] = useState<'new' | ExpenseCardDto | null>(null);
  /** Ekstresi açık olan kart (null = kapalı). */
  const [ledgerCard, setLedgerCard] = useState<ExpenseCardDto | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listExpenseCards(companyId, { includeInactive, search });
      setCards(res.cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, includeInactive, search]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const onDeactivate = async (card: ExpenseCardDto): Promise<void> => {
    if (!(await confirmDialog({ title: el('cards.deactivateConfirm', lang), tone: 'danger' })))
      return;
    try {
      await api.deactivateExpenseCard(card.id, companyId);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Hangi kartlar işlem görmüş (kasa hareketi var) — kalıcı silme yasağı. */
  const cardsWithMovements = useMemo(() => {
    const s = new Set<number>();
    for (const c of cards) {
      if (movements.some((m) => movementMatchesCard(m, c))) s.add(c.id);
    }
    return s;
  }, [cards, movements]);

  const onDelete = async (card: ExpenseCardDto): Promise<void> => {
    if (cardsWithMovements.has(card.id)) {
      // Savunma katmanı — buton zaten devre dışı, yine de kural burada da uygulanır.
      setError(el('cards.deleteBlocked', lang));
      return;
    }
    if (!(await confirmDialog({ title: el('cards.deleteConfirm', lang), tone: 'danger' }))) return;
    try {
      await api.deleteExpenseCard(card.id, companyId);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : el('cards.err.delete', lang));
    }
  };

  const incomeCount = cards.filter((c) => c.direction === 'in').length;
  const expenseCount = cards.filter((c) => c.direction === 'out').length;

  return (
    <div style={{ padding: 4 }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{el('cards.title', lang)}</h1>
        <p style={{ marginTop: 4, color: 'var(--ink-muted, #666)', fontSize: 13 }}>
          {el('cards.subtitle', lang)}
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 6, marginRight: 'auto', flexWrap: 'wrap' }}>
          <StatChip label={el('cards.sum.total', lang)} value={cards.length} tone="neutral" />
          <StatChip label={el('cards.sum.income', lang)} value={incomeCount} tone="in" />
          <StatChip label={el('cards.sum.expense', lang)} value={expenseCount} tone="out" />
        </div>
        <input
          value={search}
          onChange={(ev) => setSearch(ev.target.value)}
          placeholder={el('cards.search', lang)}
          style={{ ...fieldStyle(), width: 220 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(ev) => setIncludeInactive(ev.target.checked)}
          />
          {el('cards.includeInactive', lang)}
        </label>
        <button onClick={() => setEditorState('new')} style={btnPrimary()}>
          {el('cards.new', lang)}
        </button>
        <button onClick={() => void refetch()} disabled={loading} style={btnStyle()}>
          {loading ? el('cards.loading', lang) : el('cards.reload', lang)}
        </button>
      </div>

      {error !== null ? (
        <div
          style={{
            padding: 10,
            background: 'var(--danger-bg, #fee2e2)',
            color: 'var(--danger, #b91c1c)',
            border: '1px solid var(--danger, #fca5a5)',
            borderRadius: 6,
            marginBottom: 10,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {cards.length === 0 ? (
        <div style={emptyBox}>{loading ? el('cards.loading', lang) : el('cards.empty', lang)}</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="grid" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>{el('cards.col.code', lang)}</th>
                  <th>{el('cards.col.name', lang)}</th>
                  <th>{el('cards.col.direction', lang)}</th>
                  <th>{el('cards.col.account', lang)}</th>
                  <th>{el('cards.status', lang)}</th>
                  <th>{el('cards.col.actions', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr
                    key={String(c.id)}
                    onClick={() => setEditorState(c)}
                    style={{ cursor: 'pointer', opacity: c.active ? 1 : 0.5 }}
                  >
                    <td className="mono text-xs font-bold">{c.code}</td>
                    <td className="text-xs" style={{ fontWeight: 600 }}>
                      {c.name}
                    </td>
                    <td className="text-xs">
                      <DirectionBadge dir={c.direction} lang={lang} />
                    </td>
                    <td className="mono text-xs">
                      {c.defaultAccountCode !== null && c.defaultAccountCode !== '' ? (
                        c.defaultAccountCode
                      ) : (
                        <span style={{ color: 'var(--ink-mute)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <StatusChip active={c.active} lang={lang} />
                    </td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setLedgerCard(c)}
                          title={el('cards.ledger.tooltip', lang)}
                          style={iconBtn()}
                        >
                          <FileText size={13} />
                        </button>
                        <button
                          onClick={() => setEditorState(c)}
                          title={el('cards.edit', lang)}
                          style={iconBtn()}
                        >
                          <Pencil size={13} />
                        </button>
                        {/* Kural: işlem gören kart silinemez (yalnız pasifleştirilir);
                            işlem görmeyen kart kalıcı silinebilir. */}
                        {c.active && cardsWithMovements.has(c.id) ? (
                          <button
                            onClick={() => void onDeactivate(c)}
                            title={el('cards.deactivate', lang)}
                            style={iconBtn()}
                          >
                            <Archive size={13} />
                          </button>
                        ) : null}
                        {cardsWithMovements.has(c.id) ? (
                          <button
                            disabled
                            title={el('cards.deleteBlocked', lang)}
                            style={{ ...iconBtnDanger(), opacity: 0.35, cursor: 'not-allowed' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <button
                            onClick={() => void onDelete(c)}
                            title={el('cards.delete', lang)}
                            style={iconBtnDanger()}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editorState !== null ? (
        <ExpenseCardEditor
          api={api}
          companyId={companyId}
          lang={lang}
          editing={editorState === 'new' ? null : editorState}
          onClose={() => setEditorState(null)}
          onSaved={() => {
            setEditorState(null);
            void refetch();
          }}
          onError={(m) => setError(m)}
        />
      ) : null}

      {ledgerCard !== null ? (
        <ExpenseCardLedger
          card={ledgerCard}
          movements={movements}
          kasaAccounts={kasaAccounts}
          lang={lang}
          onClose={() => setLedgerCard(null)}
        />
      ) : null}
    </div>
  );
}

function DirectionBadge({ dir, lang }: { dir: FlowDirection; lang: string }): JSX.Element {
  const isIn = dir === 'in';
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 999,
        background: isIn ? 'var(--ok-bg, #dcfce7)' : 'var(--warn-bg, #fef3c7)',
        color: isIn ? 'var(--ok, #15803d)' : 'var(--warn, #b45309)',
      }}
    >
      {isIn ? el('cards.dir.in', lang) : el('cards.dir.out', lang)}
    </span>
  );
}

function StatusChip({ active, lang }: { active: boolean; lang: string }): JSX.Element {
  return (
    <span
      className="chip"
      style={{
        background: active ? '#dcfce7' : '#f1f5f9',
        color: active ? '#15803d' : '#64748b',
        fontWeight: 700,
        fontSize: 10,
        textTransform: 'uppercase',
      }}
    >
      {active ? el('cards.status.active', lang) : el('cards.status.passive', lang)}
    </span>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'in' | 'out';
}): JSX.Element {
  const colors =
    tone === 'in'
      ? { bg: 'var(--ok-bg, #dcfce7)', fg: 'var(--ok, #15803d)' }
      : tone === 'out'
        ? { bg: 'var(--warn-bg, #fef3c7)', fg: 'var(--warn, #b45309)' }
        : { bg: 'var(--paper-2, #f3f4f6)', fg: 'var(--ink, #374151)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 999,
        background: colors.bg,
        color: colors.fg,
      }}
    >
      {label}
      <b>{value}</b>
    </span>
  );
}

// --- Ekstre (hareket dökümü) modalı ------------------------------------------
/**
 * Eşleşme için normalize formları: hem tr-locale (İ/ı tutarlı, backend normKey
 * ile aynı) hem locale-agnostik büyük harf (küçük i→I katlar) — elle girilmiş
 * farklı büyük/küçük harfli mahiyetleri de yakalar.
 */
function normForms(s: string | undefined): string[] {
  const t = (s ?? '').trim();
  if (t === '') return [];
  return [t.toLocaleUpperCase('tr-TR'), t.toUpperCase()];
}
/** Kasa hareketi bu gider kartına ait mi? (mahiyet = kart adı / kategori / kod) */
function movementMatchesCard(m: ExpenseCardMovement, card: ExpenseCardDto): boolean {
  const cat = normForms(m.category);
  if (cat.length === 0) return false;
  const cardForms = [...normForms(card.name), ...normForms(card.category), ...normForms(card.code)];
  return cat.some((c) => cardForms.includes(c));
}

function ExpenseCardLedger({
  card,
  movements,
  kasaAccounts,
  lang,
  onClose,
}: {
  card: ExpenseCardDto;
  movements: ReadonlyArray<ExpenseCardMovement>;
  kasaAccounts: ReadonlyArray<ExpenseKasaAccountRef>;
  lang: string;
  onClose: () => void;
}): JSX.Element {
  const rows = useMemo(
    () =>
      movements
        .filter((m) => movementMatchesCard(m, card))
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), // en yeni üstte
    [movements, card],
  );

  const kasaName = (id: string | undefined): string => {
    if (id === undefined || id === '') return '';
    return kasaAccounts.find((k) => k.id === id)?.name ?? '';
  };

  const totalIn = rows
    .filter((r) => r.type === 'in')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalOut = rows
    .filter((r) => r.type === 'out')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const net = totalIn - totalOut;

  return (
    <div
      style={overlay}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div style={{ ...panel, maxWidth: 880 }} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>{el('cards.ledger.title', lang)}</h2>
          <code
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 5,
              background: 'var(--paper-2, #f3f4f6)',
              color: 'var(--ink-muted, #4b5563)',
            }}
          >
            {card.code}
          </code>
          <span style={{ fontWeight: 600 }}>{card.name}</span>
          <button onClick={onClose} style={{ ...btnStyle(), marginLeft: 'auto' }}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <StatChip label={el('cards.ledger.count', lang)} value={rows.length} tone="neutral" />
          <LedgerTotalChip label={el('cards.ledger.totalIn', lang)} amount={totalIn} tone="in" />
          <LedgerTotalChip label={el('cards.ledger.totalOut', lang)} amount={totalOut} tone="out" />
          <LedgerTotalChip
            label={el('cards.ledger.net', lang)}
            amount={net}
            tone={net >= 0 ? 'in' : 'out'}
          />
        </div>

        {rows.length === 0 ? (
          <div style={emptyBox}>{el('cards.ledger.empty', lang)}</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: '55vh' }}>
              <table className="grid" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>{el('cards.ledger.col.date', lang)}</th>
                    <th>{el('cards.ledger.col.desc', lang)}</th>
                    <th>{el('cards.ledger.col.dir', lang)}</th>
                    <th>{el('cards.ledger.col.method', lang)}</th>
                    <th>{el('cards.ledger.col.source', lang)}</th>
                    <th>{el('cards.ledger.col.amount', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id ?? String(i)}>
                      <td className="mono text-xs">{r.date}</td>
                      <td className="text-xs">{r.description ?? ''}</td>
                      <td>
                        <DirectionBadge dir={r.type} lang={lang} />
                      </td>
                      <td className="text-xs">{paymentLabel(r.paymentMethod, lang)}</td>
                      <td className="text-xs">{kasaName(r.kasaAccountId) || (r.source ?? '')}</td>
                      <td
                        className="mono text-xs"
                        style={{
                          fontWeight: 600,
                          color: r.type === 'in' ? 'var(--ok, #15803d)' : 'var(--danger, #b91c1c)',
                        }}
                      >
                        {r.type === 'in' ? '+' : '−'}
                        {fmtMoney(Number(r.amount) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LedgerTotalChip({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: 'in' | 'out';
}): JSX.Element {
  const c =
    tone === 'in'
      ? { bg: 'var(--ok-bg, #dcfce7)', fg: 'var(--ok, #15803d)' }
      : { bg: 'var(--warn-bg, #fef3c7)', fg: 'var(--warn, #b45309)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
      }}
    >
      {label}
      <b>{fmtMoney(amount)}</b>
    </span>
  );
}

// --- Sekmeli editör modalı ---------------------------------------------------
type EditorTab = 'general' | 'accounting' | 'budget';

function ExpenseCardEditor({
  api,
  companyId,
  lang,
  editing,
  onClose,
  onSaved,
  onError,
}: {
  api: ExpenseApi;
  companyId: number;
  lang: string;
  editing: ExpenseCardDto | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}): JSX.Element {
  const attr = editing?.attributes ?? {};
  const [tab, setTab] = useState<EditorTab>('general');
  const [busy, setBusy] = useState<boolean>(false);

  // Genel
  const [name, setName] = useState<string>(editing?.name ?? '');
  const [direction, setDirection] = useState<FlowDirection>(editing?.direction ?? 'out');
  const [note, setNote] = useState<string>(editing?.note ?? '');

  // Muhasebe & Vergi
  const [account, setAccount] = useState<string>(editing?.defaultAccountCode ?? '');
  const [kdvRate, setKdvRate] = useState<string>(numToStr(attr.kdvRate));
  const [tevkifatCode, setTevkifatCode] = useState<string>(attr.tevkifatCode ?? '');
  const [taxDeductible, setTaxDeductible] = useState<boolean>(attr.taxDeductible ?? true);
  const [costCenter, setCostCenter] = useState<string>(attr.costCenter ?? '');

  // Bütçe & Varsayılanlar
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(attr.paymentMethod ?? '');
  const [currency, setCurrency] = useState<string>(attr.currency ?? 'TRY');
  const [defaultAmount, setDefaultAmount] = useState<string>(numToStr(attr.defaultAmount));
  const [monthlyBudget, setMonthlyBudget] = useState<string>(numToStr(attr.monthlyBudget));
  const [recurring, setRecurring] = useState<boolean>(attr.recurring ?? false);
  const [vendor, setVendor] = useState<string>(attr.vendor ?? '');

  const buildAttributes = (): ExpenseCardAttributes => {
    const out: ExpenseCardAttributes = { taxDeductible, recurring };
    const kdv = strToNum(kdvRate);
    if (kdv !== undefined) out.kdvRate = kdv;
    if (tevkifatCode.trim() !== '') out.tevkifatCode = tevkifatCode.trim();
    if (costCenter.trim() !== '') out.costCenter = costCenter.trim();
    if (paymentMethod !== '') out.paymentMethod = paymentMethod;
    if (currency.trim() !== '') out.currency = currency.trim();
    const amt = strToNum(defaultAmount);
    if (amt !== undefined) out.defaultAmount = amt;
    const budget = strToNum(monthlyBudget);
    if (budget !== undefined) out.monthlyBudget = budget;
    if (vendor.trim() !== '') out.vendor = vendor.trim();
    return out;
  };

  const submit = async (): Promise<void> => {
    if (name.trim() === '') {
      onError(el('cards.err.nameRequired', lang));
      setTab('general');
      return;
    }
    setBusy(true);
    try {
      const common = {
        companyId,
        name: name.trim(),
        direction,
        defaultAccountCode: account.trim() === '' ? null : account.trim(),
        note: note.trim() === '' ? null : note.trim(),
        attributes: buildAttributes(),
      };
      if (editing !== null) {
        await api.updateExpenseCard(editing.id, common);
      } else {
        // Kod her zaman otomatik üretilir (GK000n).
        await api.createExpenseCard(common);
      }
      onSaved();
    } catch (e) {
      onError(
        e instanceof Error
          ? e.message
          : el(editing !== null ? 'cards.err.update' : 'cards.err.create', lang),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={overlay}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div style={panel} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>
            {el(editing !== null ? 'cards.editTitle' : 'cards.newTitle', lang)}
          </h2>
          {editing !== null ? (
            <code
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 5,
                background: 'var(--paper-2, #f3f4f6)',
                color: 'var(--ink-muted, #4b5563)',
              }}
            >
              {editing.code}
            </code>
          ) : null}
          <button onClick={onClose} style={{ ...btnStyle(), marginLeft: 'auto' }}>
            ✕
          </button>
        </div>

        {/* Sekme çubuğu */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            borderBottom: '1px solid var(--line, #e5e7eb)',
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <TabButton active={tab === 'general'} onClick={() => setTab('general')}>
            {el('cards.tab.general', lang)}
          </TabButton>
          <TabButton active={tab === 'accounting'} onClick={() => setTab('accounting')}>
            {el('cards.tab.accounting', lang)}
          </TabButton>
          <TabButton active={tab === 'budget'} onClick={() => setTab('budget')}>
            {el('cards.tab.budget', lang)}
          </TabButton>
        </div>

        {tab === 'general' ? (
          <div style={grid2}>
            <Field label={el('cards.f.name', lang)} required span2>
              <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle()} />
            </Field>
            <Field label={el('cards.f.direction', lang)} span2>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as FlowDirection)}
                style={fieldStyle()}
              >
                <option value="out">{el('cards.dir.out', lang)}</option>
                <option value="in">{el('cards.dir.in', lang)}</option>
              </select>
            </Field>
            <Field label={el('cards.f.note', lang)} span2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                style={{ ...fieldStyle(), resize: 'vertical' }}
              />
            </Field>
            {editing !== null ? (
              <div
                style={{ gridColumn: 'span 2', fontSize: 12, color: 'var(--ink-muted, #6b7280)' }}
              >
                {el('cards.status', lang)}: <StatusChip active={editing.active} lang={lang} />
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'accounting' ? (
          <div style={grid2}>
            <Field label={el('cards.f.account', lang)}>
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="770 / 740 / 600"
                style={fieldStyle()}
              />
            </Field>
            <Field label={el('cards.f.kdv', lang)}>
              <input
                type="number"
                min="0"
                max="100"
                value={kdvRate}
                onChange={(e) => setKdvRate(e.target.value)}
                placeholder="20"
                style={fieldStyle()}
              />
            </Field>
            <Field label={el('cards.f.tevkifat', lang)}>
              <input
                value={tevkifatCode}
                onChange={(e) => setTevkifatCode(e.target.value)}
                placeholder="9/10"
                style={fieldStyle()}
              />
            </Field>
            <Field label={el('cards.f.costCenter', lang)}>
              <input
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                style={fieldStyle()}
              />
            </Field>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={taxDeductible}
                  onChange={(e) => setTaxDeductible(e.target.checked)}
                />
                {el('cards.f.taxDeductible', lang)}
              </label>
              <div style={{ fontSize: 11, color: 'var(--ink-muted, #9ca3af)', marginTop: 3 }}>
                {el('cards.f.taxDeductibleHint', lang)}
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'budget' ? (
          <div style={grid2}>
            <Field label={el('cards.f.paymentMethod', lang)}>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                style={fieldStyle()}
              >
                <option value="">{el('cards.pm.none', lang)}</option>
                <option value="cash">{el('cards.pm.cash', lang)}</option>
                <option value="card">{el('cards.pm.card', lang)}</option>
                <option value="transfer">{el('cards.pm.transfer', lang)}</option>
              </select>
            </Field>
            <Field label={el('cards.f.currency', lang)}>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={fieldStyle()}
              >
                <option value="TRY">TRY ₺</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
                <option value="GBP">GBP £</option>
              </select>
            </Field>
            <Field label={el('cards.f.defaultAmount', lang)}>
              <input
                type="number"
                min="0"
                step="any"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(e.target.value)}
                style={fieldStyle()}
              />
            </Field>
            <Field label={el('cards.f.monthlyBudget', lang)}>
              <input
                type="number"
                min="0"
                step="any"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                style={fieldStyle()}
              />
            </Field>
            <Field label={el('cards.f.vendor', lang)} span2>
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                style={fieldStyle()}
              />
            </Field>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                />
                {el('cards.f.recurring', lang)}
              </label>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 18,
            paddingTop: 12,
            borderTop: '1px solid var(--line, #e5e7eb)',
          }}
        >
          <button onClick={onClose} style={btnStyle()}>
            {el('cards.cancel', lang)}
          </button>
          <button onClick={() => void submit()} disabled={busy} style={btnPrimary()}>
            {busy ? el('cards.saving', lang) : el('cards.save', lang)}
          </button>
        </div>
      </div>
    </div>
  );
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
        padding: '7px 14px',
        fontSize: 12.5,
        fontWeight: active ? 700 : 500,
        border: 'none',
        borderBottom: active ? '2px solid var(--accent, #0066cc)' : '2px solid transparent',
        background: 'transparent',
        color: active ? 'var(--accent, #0066cc)' : 'var(--ink-muted, #6b7280)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  required,
  span2,
  children,
}: {
  label: string;
  required?: boolean;
  span2?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontSize: 12,
        ...(span2 === true ? { gridColumn: 'span 2' } : {}),
      }}
    >
      <span style={{ color: 'var(--ink-muted, #6b7280)' }}>
        {label}
        {required === true ? <span style={{ color: 'var(--danger, #dc2626)' }}> *</span> : null}
      </span>
      {children}
    </label>
  );
}

// --- yardımcılar -------------------------------------------------------------
function numToStr(n: number | undefined): string {
  return typeof n === 'number' && !Number.isNaN(n) ? String(n) : '';
}
function strToNum(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}
function paymentLabel(pm: string | undefined, lang: string): string {
  switch (pm) {
    case 'cash':
      return el('cards.pm.cash', lang);
    case 'card':
      return el('cards.pm.card', lang);
    case 'transfer':
      return el('cards.pm.transfer', lang);
    default:
      return '—';
  }
}
function fmtMoney(n: number): string {
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

// --- stiller -----------------------------------------------------------------
const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 12,
};
const emptyBox: React.CSSProperties = {
  padding: 32,
  textAlign: 'center',
  color: 'var(--ink-muted, #888)',
  border: '1px dashed var(--line, #e5e7eb)',
  borderRadius: 8,
  fontSize: 13,
};
const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 24,
  zIndex: 1000,
  overflow: 'auto',
};
const panel: React.CSSProperties = {
  background: 'var(--paper, #fff)',
  color: 'var(--ink, #111)',
  borderRadius: 10,
  padding: 18,
  width: '100%',
  maxWidth: 640,
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
};
function fieldStyle(): React.CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 12,
    minWidth: 0,
    width: '100%',
    background: 'var(--paper, #fff)',
    color: 'var(--ink, #111)',
    boxSizing: 'border-box',
  };
}
function btnStyle(): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    background: 'var(--paper, #fff)',
    color: 'var(--ink, #111)',
    cursor: 'pointer',
    fontSize: 12,
  };
}
function btnPrimary(): React.CSSProperties {
  return {
    padding: '6px 14px',
    border: 'none',
    background: 'var(--accent, #0066cc)',
    color: '#fff',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  };
}
function iconBtn(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 7px',
    border: 'none',
    borderRadius: 4,
    background: 'var(--bg-alt, #f1f5f9)',
    color: 'var(--ink, #111)',
    cursor: 'pointer',
  };
}
function iconBtnDanger(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 7px',
    border: 'none',
    borderRadius: 4,
    background: '#fee2e2',
    color: '#b91c1c',
    cursor: 'pointer',
  };
}
