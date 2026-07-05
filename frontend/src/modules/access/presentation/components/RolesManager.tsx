/**
 * RolesManager — özel rol listesi + oluştur/düzenle formu.
 *
 * İzinler katalogdan modüle göre gruplanmış checkbox'larla seçilir.
 * Plain CSS sınıfları (`card`, `grid`) + inline stiller kullanır.
 */
import { useMemo, useState } from 'react';

import { confirmDialog } from '../../../../shared/feedback';
import type {
  CatalogResource,
  CatalogResponse,
  CustomRoleDto,
} from '../../application/dto/AccessDtos';
import type { CreateRoleBody, UpdateRoleBody } from '../../application/ports/AccessApi';

export interface RolesManagerProps {
  roles: ReadonlyArray<CustomRoleDto>;
  catalog: CatalogResponse | null;
  companyId: number;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onCreate: (body: CreateRoleBody) => Promise<CustomRoleDto>;
  onUpdate: (id: number, body: UpdateRoleBody) => Promise<CustomRoleDto>;
  onDelete: (id: number) => Promise<void>;
}

interface FormState {
  /** null → yeni rol; sayı → düzenlenen rolün id'si. */
  editingId: number | null;
  name: string;
  description: string;
  permissions: Set<string>;
}

const emptyForm = (): FormState => ({
  editingId: null,
  name: '',
  description: '',
  permissions: new Set<string>(),
});

export function RolesManager({
  roles,
  catalog,
  companyId,
  loading,
  error,
  onReload,
  onCreate,
  onUpdate,
  onDelete,
}: RolesManagerProps): JSX.Element {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Katalog: modüle göre grupla
  const groupedResources = useMemo(() => {
    const groups = new Map<string, CatalogResource[]>();
    for (const r of catalog?.resources ?? []) {
      const list = groups.get(r.module) ?? [];
      list.push(r);
      groups.set(r.module, list);
    }
    return [...groups.entries()];
  }, [catalog]);

  function startEdit(role: CustomRoleDto): void {
    setForm({
      editingId: role.id,
      name: role.name,
      description: role.description ?? '',
      permissions: new Set(role.permissions),
    });
    setFormError(null);
  }

  function startNew(): void {
    setForm(emptyForm());
    setFormError(null);
  }

  function togglePermission(perm: string): void {
    setForm((prev) => {
      const next = new Set(prev.permissions);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return { ...prev, permissions: next };
    });
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const permissions = [...form.permissions];
      if (form.editingId === null) {
        await onCreate({
          companyId,
          name: form.name.trim(),
          description: form.description.trim() === '' ? null : form.description.trim(),
          permissions,
        });
      } else {
        await onUpdate(form.editingId, {
          companyId,
          name: form.name.trim(),
          description: form.description.trim() === '' ? null : form.description.trim(),
          permissions,
        });
      }
      setForm(emptyForm());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role: CustomRoleDto): Promise<void> {
    const L = (typeof window !== 'undefined' && window.__PROMETA_LANG__) || 'tr';
    if (
      !(await confirmDialog({
        title:
          L === 'en'
            ? `Delete role "${role.name}"?`
            : L === 'de'
              ? `Rolle "${role.name}" löschen?`
              : L === 'ar'
                ? `حذف دور "${role.name}"؟`
                : `"${role.name}" rolü silinsin mi?`,
        tone: 'danger',
      }))
    ) {
      return;
    }
    try {
      await onDelete(role.id);
      if (form.editingId === role.id) setForm(emptyForm());
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
        <h2 style={{ fontSize: 16, margin: 0 }}>Özel Roller</h2>
        <button onClick={onReload} disabled={loading} style={btnStyle()}>
          {loading ? 'Yükleniyor…' : 'Yenile'}
        </button>
      </div>

      {error !== null ? <ErrorBox message={error} /> : null}

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        {/* Sol: rol listesi */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>Roller ({roles.length})</strong>
            <button onClick={startNew} style={btnStyle()}>
              + Yeni Rol
            </button>
          </div>
          {roles.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted, #6b7280)' }}>
              Henüz özel rol tanımlanmamış.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {roles.map((role) => (
                <li
                  key={role.id}
                  style={{
                    border: '1px solid var(--line, #e5e7eb)',
                    borderRadius: 6,
                    padding: 8,
                    background:
                      form.editingId === role.id ? 'var(--accent-bg, #eff6ff)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{role.name}</div>
                      {role.description !== null ? (
                        <div style={{ fontSize: 12, color: 'var(--muted, #6b7280)' }}>
                          {role.description}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 11, color: 'var(--muted, #9ca3af)' }}>
                        {role.permissions.length} izin
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button onClick={() => startEdit(role)} style={btnStyle()}>
                        Düzenle
                      </button>
                      <button
                        onClick={() => void handleDelete(role)}
                        style={{ ...btnStyle(), color: 'var(--danger, #b91c1c)' }}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sağ: form */}
        <form className="card" style={{ padding: 12 }} onSubmit={(e) => void handleSubmit(e)}>
          <strong style={{ fontSize: 14 }}>
            {form.editingId === null ? 'Yeni Rol' : 'Rolü Düzenle'}
          </strong>

          {formError !== null ? <ErrorBox message={formError} /> : null}

          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label style={{ fontSize: 12 }}>
              Rol Adı
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              Açıklama
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                style={{ ...inputStyle(), width: '100%', display: 'block', marginTop: 2 }}
              />
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13 }}>İzinler</strong>
            {catalog === null ? (
              <p style={{ fontSize: 12, color: 'var(--muted, #6b7280)' }}>Katalog yükleniyor…</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  marginTop: 8,
                  maxHeight: 360,
                  overflowY: 'auto',
                }}
              >
                {groupedResources.map(([moduleName, resources]) => (
                  <div key={moduleName}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--muted, #6b7280)',
                        marginBottom: 4,
                      }}
                    >
                      {moduleName}
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {resources.map((res) => (
                        <div key={res.resource} style={{ fontSize: 12 }}>
                          <span style={{ display: 'inline-block', minWidth: 160 }}>
                            {res.label}
                          </span>
                          {res.actions.map((action) => {
                            const perm = `${res.resource}.${action}`;
                            return (
                              <label key={perm} style={{ marginRight: 10 }}>
                                <input
                                  type="checkbox"
                                  checked={form.permissions.has(perm)}
                                  onChange={() => togglePermission(perm)}
                                />{' '}
                                {action}
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="submit"
              disabled={saving || form.name.trim() === ''}
              style={{ ...btnStyle(), fontWeight: 600 }}
            >
              {saving ? 'Kaydediliyor…' : form.editingId === null ? 'Oluştur' : 'Güncelle'}
            </button>
            {form.editingId !== null ? (
              <button type="button" onClick={startNew} style={btnStyle()}>
                İptal
              </button>
            ) : null}
            <span style={{ fontSize: 12, color: 'var(--muted, #6b7280)', alignSelf: 'center' }}>
              {form.permissions.size} izin seçili
            </span>
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
