/**
 * ExpenseCardsPage — Gider Kartları yönetim ekranı (ayrı menü).
 *
 * Malzeme kartları (construction.materials) muadili: liste + ekle + düzenle +
 * pasifleştir + arama. Backend /v1/expense/cards rotalarını kullanır.
 * App.jsx'ten `<ExpenseCardsPage apiBaseUrl="" companyId={..} lang={lang} />`
 * şeklinde mount edilir.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ExpenseCardDto, FlowDirection } from '../application/dto/ExpenseDtos';
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
}

export function ExpenseCardsPage({
  apiBaseUrl = '',
  accessToken,
  companyId = 1,
  lang = 'tr',
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
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editing, setEditing] = useState<ExpenseCardDto | null>(null);

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
    if (!window.confirm(el('cards.deactivateConfirm', lang))) return;
    try {
      await api.deactivateExpenseCard(card.id, companyId);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

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
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: 15, margin: 0, marginRight: 'auto' }}>
          {el('cards.count', lang)} ({cards.length})
        </h2>
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
        <button
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
          style={btnPrimary()}
        >
          {showForm && editing === null ? el('cards.close', lang) : el('cards.new', lang)}
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

      {showForm || editing !== null ? (
        <ExpenseCardForm
          api={api}
          companyId={companyId}
          lang={lang}
          editing={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
            void refetch();
          }}
          onError={(m) => setError(m)}
        />
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line, #e5e7eb)' }}>
              <th style={thStyle()}>{el('cards.col.code', lang)}</th>
              <th style={thStyle()}>{el('cards.col.name', lang)}</th>
              <th style={thStyle()}>{el('cards.col.category', lang)}</th>
              <th style={thStyle()}>{el('cards.col.direction', lang)}</th>
              <th style={thStyle()}>{el('cards.col.account', lang)}</th>
              <th style={{ ...thStyle(), textAlign: 'right' }}>{el('cards.col.actions', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: 'var(--ink-muted, #888)' }}>
                  {el('cards.empty', lang)}
                </td>
              </tr>
            ) : (
              cards.map((c) => (
                <tr
                  key={String(c.id)}
                  style={{
                    borderBottom: '1px solid var(--line, #f0f0f0)',
                    opacity: c.active ? 1 : 0.5,
                  }}
                >
                  <td style={tdStyle()}>
                    <code>{c.code}</code>
                  </td>
                  <td style={tdStyle()}>
                    {c.name} {c.active ? '' : el('cards.passive', lang)}
                  </td>
                  <td style={tdStyle()}>{c.category}</td>
                  <td style={tdStyle()}>
                    <DirectionBadge dir={c.direction} lang={lang} />
                  </td>
                  <td style={tdStyle()}>{c.defaultAccountCode ?? ''}</td>
                  <td style={{ ...tdStyle(), textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setEditing(c);
                      }}
                      style={{ ...btnStyle(), marginRight: 6 }}
                    >
                      {el('cards.edit', lang)}
                    </button>
                    {c.active ? (
                      <button onClick={() => void onDeactivate(c)} style={btnDanger()}>
                        {el('cards.deactivate', lang)}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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

function ExpenseCardForm({
  api,
  companyId,
  lang,
  editing,
  onDone,
  onError,
}: {
  api: ExpenseApi;
  companyId: number;
  lang: string;
  editing: ExpenseCardDto | null;
  onDone: () => void;
  onError: (msg: string) => void;
}): JSX.Element {
  const [code, setCode] = useState<string>(editing?.code ?? '');
  const [name, setName] = useState<string>(editing?.name ?? '');
  const [category, setCategory] = useState<string>(editing?.category ?? '');
  const [direction, setDirection] = useState<FlowDirection>(editing?.direction ?? 'out');
  const [account, setAccount] = useState<string>(editing?.defaultAccountCode ?? '');
  const [note, setNote] = useState<string>(editing?.note ?? '');
  const [busy, setBusy] = useState<boolean>(false);

  const submit = async (): Promise<void> => {
    if (name.trim() === '') {
      onError(el('cards.err.nameRequired', lang));
      return;
    }
    setBusy(true);
    try {
      if (editing !== null) {
        await api.updateExpenseCard(editing.id, {
          companyId,
          name: name.trim(),
          category: category.trim(),
          direction,
          defaultAccountCode: account.trim() === '' ? null : account.trim(),
          note: note.trim() === '' ? null : note.trim(),
        });
      } else {
        const base = {
          companyId,
          name: name.trim(),
          category: category.trim(),
          direction,
          defaultAccountCode: account.trim() === '' ? null : account.trim(),
          note: note.trim() === '' ? null : note.trim(),
        };
        await api.createExpenseCard(code.trim() === '' ? base : { ...base, code: code.trim() });
      }
      onDone();
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
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        void submit();
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          placeholder={el('cards.f.name', lang)}
          style={{ ...fieldStyle(), flex: 1, minWidth: 200 }}
        />
        <input
          value={code}
          onChange={(ev) => setCode(ev.target.value)}
          placeholder={el('cards.f.code', lang)}
          disabled={editing !== null}
          style={{ ...fieldStyle(), width: 220 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={category}
          onChange={(ev) => setCategory(ev.target.value)}
          placeholder={el('cards.f.category', lang)}
          style={{ ...fieldStyle(), flex: 1, minWidth: 160 }}
        />
        <select
          value={direction}
          onChange={(ev) => setDirection(ev.target.value as FlowDirection)}
          style={{ ...fieldStyle(), width: 140 }}
        >
          <option value="out">{el('cards.dir.out', lang)}</option>
          <option value="in">{el('cards.dir.in', lang)}</option>
        </select>
        <input
          value={account}
          onChange={(ev) => setAccount(ev.target.value)}
          placeholder={el('cards.f.account', lang)}
          style={{ ...fieldStyle(), width: 180 }}
        />
      </div>
      <input
        value={note}
        onChange={(ev) => setNote(ev.target.value)}
        placeholder={el('cards.f.note', lang)}
        style={{ ...fieldStyle(), width: '100%' }}
      />
      <button type="submit" disabled={busy} style={{ ...btnPrimary(), justifySelf: 'start' }}>
        {busy ? el('cards.saving', lang) : el('cards.save', lang)}
      </button>
    </form>
  );
}

// --- stiller ----------------------------------------------------------------
function fieldStyle(): React.CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 12,
    minWidth: 0,
    background: 'var(--paper, #fff)',
    color: 'var(--ink, #111)',
  };
}
function thStyle(): React.CSSProperties {
  return { padding: '6px 8px', fontSize: 12, color: 'var(--ink-muted, #666)', fontWeight: 600 };
}
function tdStyle(): React.CSSProperties {
  return { padding: '6px 8px' };
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
function btnDanger(): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: '1px solid var(--danger, #fca5a5)',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--danger, #b91c1c)',
    cursor: 'pointer',
    fontSize: 12,
  };
}
