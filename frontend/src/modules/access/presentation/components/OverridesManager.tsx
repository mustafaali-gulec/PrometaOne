/**
 * OverridesManager — kullanici bazli izin override'lari listesi + upsert formu.
 *
 * Bir kullaniciya, katalogtan secilen resource+action icin izin (allow) verilir
 * veya kaldirilir; opsiyonel olarak bir son kullanma tarihi belirlenebilir.
 * RolesManager.tsx ile ayni stil/yapi.
 */
import { useMemo, useState } from 'react';

import type { CatalogResponse, PermissionOverrideDto } from '../../application/dto/AccessDtos';
import type { SetOverrideBody } from '../../application/ports/AccessApi';

export interface OverridesManagerProps {
  overrides: ReadonlyArray<PermissionOverrideDto>;
  catalog: CatalogResponse | null;
  companyId: number;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onUpsert: (body: SetOverrideBody) => Promise<PermissionOverrideDto>;
  onDelete: (id: number) => Promise<void>;
}

interface FormState {
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expiresAt: string;
}

const emptyForm = (): FormState => ({
  username: '',
  resource: '',
  action: '',
  allow: true,
  expiresAt: '',
});

export function OverridesManager({
  overrides,
  catalog,
  companyId,
  loading,
  error,
  onReload,
  onUpsert,
  onDelete,
}: OverridesManagerProps): JSX.Element {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resources = catalog?.resources ?? [];

  // Secili resource'un izin verdigi aksiyonlar.
  const actionsForResource = useMemo(() => {
    const res = resources.find((r) => r.resource === form.resource);
    return res?.actions ?? [];
  }, [resources, form.resource]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (form.username.trim() === '' || form.resource === '' || form.action === '') {
      setFormError('Kullanici, kaynak ve aksiyon zorunlu.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onUpsert({
        companyId,
        username: form.username.trim(),
        resource: form.resource,
        action: form.action,
        allow: form.allow,
        expiresAt: form.expiresAt.trim() === '' ? null : form.expiresAt.trim(),
      });
      setForm(emptyForm());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ov: PermissionOverrideDto): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`"${ov.username}" icin ${ov.resource}.${ov.action} override'i silinsin mi?`)
    ) {
      return;
    }
    try {
      await onDelete(ov.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }

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
        <h2 style={{ fontSize: 16, margin: 0 }}>Izin Override&apos;lari</h2>
        <button onClick={onReload} disabled={loading} style={btnStyle()}>
          {loading ? 'Yukleniyor…' : 'Yenile'}
        </button>
      </div>

      {error !== null ? <ErrorBox message={error} /> : null}

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Sol: override listesi */}
        <div className="card" style={{ padding: 12 }}>
          <strong style={{ fontSize: 14 }}>Override&apos;lar ({overrides.length})</strong>
          {overrides.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted, #6b7280)' }}>Henuz override yok.</p>
          ) : (
            <ul
              style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 6 }}
            >
              {overrides.map((ov) => (
                <li
                  key={ov.id}
                  style={{
                    border: '1px solid var(--line, #e5e7eb)',
                    borderRadius: 6,
                    padding: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ov.username}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted, #6b7280)' }}>
                      {ov.resource}.{ov.action}{' '}
                      <span
                        style={{
                          fontWeight: 600,
                          color: ov.allow ? 'var(--success, #047857)' : 'var(--danger, #b91c1c)',
                        }}
                      >
                        {ov.allow ? 'IZIN' : 'RED'}
                      </span>
                    </div>
                    {ov.expiresAt !== null ? (
                      <div style={{ fontSize: 11, color: 'var(--muted, #9ca3af)' }}>
                        bitis: {ov.expiresAt}
                      </div>
                    ) : null}
                  </div>
                  <button
                    onClick={() => void handleDelete(ov)}
                    style={{
                      ...btnStyle(),
                      color: 'var(--danger, #b91c1c)',
                      alignSelf: 'flex-start',
                    }}
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sag: upsert formu */}
        <form className="card" style={{ padding: 12 }} onSubmit={(e) => void handleSubmit(e)}>
          <strong style={{ fontSize: 14 }}>Override Ekle / Guncelle</strong>

          {formError !== null ? <ErrorBox message={formError} /> : null}

          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label style={{ fontSize: 12 }}>
              Kullanici Adi
              <input
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                required
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Kaynak
              <select
                value={form.resource}
                onChange={(e) => setForm((p) => ({ ...p, resource: e.target.value, action: '' }))}
                required
                disabled={catalog === null}
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              >
                <option value="">
                  {catalog === null ? 'Katalog yukleniyor…' : '— Kaynak secin —'}
                </option>
                {resources.map((r) => (
                  <option key={r.resource} value={r.resource}>
                    {r.label} ({r.resource})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12 }}>
              Aksiyon
              <select
                value={form.action}
                onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))}
                required
                disabled={form.resource === ''}
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              >
                <option value="">— Aksiyon secin —</option>
                {actionsForResource.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={form.allow}
                onChange={(e) => setForm((p) => ({ ...p, allow: e.target.checked }))}
              />{' '}
              Izin ver (kapaliysa reddet)
            </label>

            <label style={{ fontSize: 12 }}>
              Son Kullanma (ops.)
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="submit"
              disabled={
                saving || form.username.trim() === '' || form.resource === '' || form.action === ''
              }
              style={{ ...btnStyle(), fontWeight: 600 }}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function ErrorBox({ message }: { message: string }): JSX.Element {
  return (
    <div
      style={{
        padding: 10,
        background: 'var(--danger-bg, #fee2e2)',
        color: 'var(--danger, #b91c1c)',
        border: '1px solid var(--danger, #fca5a5)',
        borderRadius: 6,
        margin: '8px 0',
        fontSize: 13,
      }}
    >
      Hata: {message}
    </div>
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
  };
}
