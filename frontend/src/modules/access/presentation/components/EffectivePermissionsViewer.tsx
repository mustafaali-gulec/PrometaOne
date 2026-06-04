/**
 * EffectivePermissionsViewer — bir kullanici adi girilince getEffectivePermissions
 * cagirir ve hesaplanan izin listesini gosterir. RolesManager.tsx ile ayni stil.
 */
import { useState } from 'react';

import type { EffectivePermissionsDto } from '../../application/dto/AccessDtos';
import type { AccessApi } from '../../application/ports/AccessApi';

export interface EffectivePermissionsViewerProps {
  api: AccessApi;
  companyId: number;
}

export function EffectivePermissionsViewer({
  api,
  companyId,
}: EffectivePermissionsViewerProps): JSX.Element {
  const [username, setUsername] = useState<string>('');
  const [result, setResult] = useState<EffectivePermissionsDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (username.trim() === '') return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getEffectivePermissions(companyId, { username: username.trim() });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Etkin Izinler</h2>

      <form
        onSubmit={(e) => void handleResolve(e)}
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}
      >
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Kullanici adi"
          style={{ ...inputStyle(), minWidth: 220 }}
        />
        <button
          type="submit"
          disabled={loading || username.trim() === ''}
          style={{ ...btnStyle(), fontWeight: 600 }}
        >
          {loading ? 'Hesaplaniyor…' : 'Hesapla'}
        </button>
      </form>

      {error !== null ? (
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
          Hata: {error}
        </div>
      ) : null}

      {result !== null ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>{result.username}</strong>{' '}
            <span style={{ color: 'var(--muted, #6b7280)' }}>· rol: {result.role}</span>{' '}
            <span style={{ color: 'var(--muted, #9ca3af)' }}>
              ({result.permissions.length} izin)
            </span>
          </div>
          {result.permissions.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted, #6b7280)' }}>Hicbir izin yok.</p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 4,
              }}
            >
              {result.permissions.map((p) => (
                <li
                  key={p}
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    border: '1px solid var(--line, #e5e7eb)',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                  }}
                >
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
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
  };
}
