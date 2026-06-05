/**
 * NotificationsDemoPage — login formu + NotificationBell.
 *
 * Strangler Fig demo: App.jsx'e hiç dokunmadan, yeni modülün gerçek
 * backend'le konuşabildiğini kanıtlar.
 */
import { useEffect, useState } from 'react';

import type { AuthTokenProvider } from '../application/ports/AuthTokenProvider';
import { NotificationsApiClient } from '../infrastructure/api/NotificationsApiClient';
import { NotificationBell } from '../presentation/components/NotificationBell';

const STORAGE_KEY = 'prometa.demo.token';

export interface NotificationsDemoPageProps {
  apiBaseUrl: string;
}

interface LoginResponse {
  accessToken: string;
  user: { id: number; username: string; fullName: string | null; role: string };
}

export function NotificationsDemoPage({ apiBaseUrl }: NotificationsDemoPageProps) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState<LoginResponse['user'] | null>(null);

  const tokenProvider: AuthTokenProvider = {
    getAccessToken: () => token,
  };

  const api = new NotificationsApiClient(apiBaseUrl, tokenProvider);

  useEffect(() => {
    if (token !== null) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">M Suite — Notifications Modülü Demo</h1>
          <p className="mt-1 text-sm text-slate-600">
            Strangler Fig: App.jsx&apos;e dokunmadan yeni modülü test eder.
          </p>
        </div>
        {token !== null && <NotificationBell api={api} />}
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {token === null ? (
          <LoginForm
            apiBaseUrl={apiBaseUrl}
            onLogin={(t, u) => {
              setToken(t);
              setUser(u);
            }}
          />
        ) : (
          <LoggedInPanel
            user={user}
            onLogout={() => {
              setToken(null);
              setUser(null);
            }}
          />
        )}
      </section>

      <ArchitectureNotes />
    </main>
  );
}

interface LoginFormProps {
  apiBaseUrl: string;
  onLogin: (token: string, user: LoginResponse['user']) => void;
}

function LoginForm({ apiBaseUrl, onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const data = (await res.json()) as LoginResponse;
      onLogin(data.accessToken, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <h2 className="text-base font-semibold text-slate-800">Login</h2>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-slate-700 font-medium">Kullanıcı adı</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoComplete="username"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700 font-medium">Şifre</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoComplete="current-password"
          />
        </label>
      </div>
      {error !== null && (
        <p className="rounded bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center rounded bg-emerald-600 px-4 py-2 text-sm font-medium
                   text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </button>
    </form>
  );
}

interface LoggedInPanelProps {
  user: LoginResponse['user'] | null;
  onLogout: () => void;
}

function LoggedInPanel({ user, onLogout }: LoggedInPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">Giriş yaptın</h2>
        <button
          type="button"
          onClick={onLogout}
          className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
        >
          Çıkış
        </button>
      </div>
      {user !== null && (
        <p className="text-sm text-slate-700">
          {user.fullName ?? user.username} <span className="text-slate-400">({user.role})</span>
        </p>
      )}
      <p className="text-sm text-slate-600">
        Sağ üstteki <strong>bell ikonuna</strong> tıkla. Backend boş cevap dönerse &quot;Henüz
        bildirim yok&quot; göreceksin. Demo&apos;da elle bildirim eklemek için Adminer veya SQL ile{' '}
        <code>notifications</code> tablosuna kayıt at.
      </p>
    </div>
  );
}

function ArchitectureNotes() {
  return (
    <section className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-slate-700">
      <h3 className="text-sm font-semibold text-emerald-900">Mimari notlar</h3>
      <ul className="mt-3 space-y-2 list-disc pl-5">
        <li>
          Bu sayfa <code>frontend/notifications-demo.html</code> entry&apos;sinden çağrılıyor.{' '}
          <code>App.jsx</code>&apos;e hiç dokunmadık.
        </li>
        <li>
          Bell <code>frontend/src/modules/notifications/</code> altındaki SOLID-katmanlı modülden
          geliyor.
        </li>
        <li>
          Backend <code>/v1/notifications</code> endpoint&apos;i ile gerçek HTTP üzerinden konuşuyor
          (port 3000).
        </li>
        <li>
          Faz 1&apos;in sonunda App.jsx&apos;in 79804. satırındaki eski local{' '}
          <code>NotificationBell</code> silinecek ve üst-bar&apos;a bu modüler bell yerleşecek.
        </li>
      </ul>
    </section>
  );
}
