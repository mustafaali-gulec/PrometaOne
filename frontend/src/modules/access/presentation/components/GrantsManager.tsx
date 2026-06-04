/**
 * GrantsManager — rol atamalari (grants) listesi + yeni atama formu.
 *
 * Bir rol bir ozneye (kullanici / personel / unvan / departman / org birim)
 * atanir; opsiyonel olarak alt birimlere cascade edilebilir ve gecerlilik
 * tarih araligi verilebilir. RolesManager.tsx ile ayni stil/yapi.
 */
import { useState } from 'react';

import type { CustomRoleDto, RoleGrantDto, SubjectType } from '../../application/dto/AccessDtos';
import type { CreateGrantBody } from '../../application/ports/AccessApi';

export interface GrantsManagerProps {
  grants: ReadonlyArray<RoleGrantDto>;
  roles: ReadonlyArray<CustomRoleDto>;
  companyId: number;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onCreate: (body: CreateGrantBody) => Promise<RoleGrantDto>;
  onDelete: (id: number) => Promise<void>;
}

const SUBJECT_TYPE_OPTIONS: ReadonlyArray<{ value: SubjectType; label: string }> = [
  { value: 'user', label: 'Kullanici' },
  { value: 'employee', label: 'Personel' },
  { value: 'job_title', label: 'Unvan' },
  { value: 'department', label: 'Departman' },
  { value: 'org_unit', label: 'Organizasyon Birimi' },
];

function subjectTypeLabel(t: SubjectType): string {
  return SUBJECT_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

interface FormState {
  roleId: number | null;
  subjectType: SubjectType;
  subjectId: string;
  cascade: boolean;
  validFrom: string;
  validUntil: string;
}

const emptyForm = (): FormState => ({
  roleId: null,
  subjectType: 'user',
  subjectId: '',
  cascade: false,
  validFrom: '',
  validUntil: '',
});

export function GrantsManager({
  grants,
  roles,
  companyId,
  loading,
  error,
  onReload,
  onCreate,
  onDelete,
}: GrantsManagerProps): JSX.Element {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function roleName(roleId: number): string {
    return roles.find((r) => r.id === roleId)?.name ?? `#${roleId}`;
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (form.roleId === null || form.subjectId.trim() === '') {
      setFormError('Rol ve ozne kimligi zorunlu.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onCreate({
        companyId,
        roleId: form.roleId,
        subjectType: form.subjectType,
        subjectId: form.subjectId.trim(),
        cascade: form.cascade,
        validFrom: form.validFrom.trim() === '' ? null : form.validFrom.trim(),
        validUntil: form.validUntil.trim() === '' ? null : form.validUntil.trim(),
      });
      setForm(emptyForm());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(grant: RoleGrantDto): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`"${roleName(grant.roleId)}" atamasi silinsin mi?`)
    ) {
      return;
    }
    try {
      await onDelete(grant.id);
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
        <h2 style={{ fontSize: 16, margin: 0 }}>Rol Atamalari</h2>
        <button onClick={onReload} disabled={loading} style={btnStyle()}>
          {loading ? 'Yukleniyor…' : 'Yenile'}
        </button>
      </div>

      {error !== null ? <ErrorBox message={error} /> : null}

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Sol: atama listesi */}
        <div className="card" style={{ padding: 12 }}>
          <strong style={{ fontSize: 14 }}>Atamalar ({grants.length})</strong>
          {grants.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted, #6b7280)' }}>Henuz atama yok.</p>
          ) : (
            <ul
              style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 6 }}
            >
              {grants.map((g) => (
                <li
                  key={g.id}
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
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{roleName(g.roleId)}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted, #6b7280)' }}>
                      {subjectTypeLabel(g.subjectType)}: {g.subjectId}
                      {g.cascade ? ' · cascade' : ''}
                    </div>
                    {g.validFrom !== null || g.validUntil !== null ? (
                      <div style={{ fontSize: 11, color: 'var(--muted, #9ca3af)' }}>
                        {g.validFrom ?? '…'} → {g.validUntil ?? '…'}
                      </div>
                    ) : null}
                  </div>
                  <button
                    onClick={() => void handleDelete(g)}
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

        {/* Sag: yeni atama formu */}
        <form className="card" style={{ padding: 12 }} onSubmit={(e) => void handleSubmit(e)}>
          <strong style={{ fontSize: 14 }}>Yeni Atama</strong>

          {formError !== null ? <ErrorBox message={formError} /> : null}

          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label style={{ fontSize: 12 }}>
              Rol
              <select
                value={form.roleId ?? ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    roleId: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                required
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              >
                <option value="">— Rol secin —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12 }}>
              Ozne Tipi
              <select
                value={form.subjectType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, subjectType: e.target.value as SubjectType }))
                }
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              >
                {SUBJECT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12 }}>
              Ozne Kimligi
              <input
                value={form.subjectId}
                onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}
                placeholder="orn. kullanici adi veya id"
                required
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={form.cascade}
                onChange={(e) => setForm((p) => ({ ...p, cascade: e.target.checked }))}
              />{' '}
              Alt birimlere uygula (cascade)
            </label>

            <label style={{ fontSize: 12 }}>
              Gecerlilik Baslangici (ops.)
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))}
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Gecerlilik Bitisi (ops.)
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))}
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="submit"
              disabled={saving || form.roleId === null || form.subjectId.trim() === ''}
              style={{ ...btnStyle(), fontWeight: 600 }}
            >
              {saving ? 'Kaydediliyor…' : 'Ata'}
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
