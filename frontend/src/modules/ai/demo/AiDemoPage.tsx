/**
 * AiDemoPage — login formu + AiAssistantWidget.
 *
 * Strangler Fig: App.jsx'in 12386. satirindaki eski AIAssistantWidget
 * yerinde duruyor; yeni modüler chat ayri bir entry'de sunuluyor.
 */
import { useEffect, useState } from 'react';

import type { AuthTokenProvider } from '../application/ports/AuthTokenProvider';
import { AiAssistantApiClient } from '../infrastructure/api/AiAssistantApiClient';
import { AiAssistantWidget } from '../presentation/components/AiAssistantWidget';

const STORAGE_KEY = 'prometa.ai-demo.token';

export interface AiDemoPageProps {
  apiBaseUrl: string;
}

interface LoginResponse {
  accessToken: string;
  user: { id: number; username: string; fullName: string | null; role: string };
}

export function AiDemoPage({ apiBaseUrl }: AiDemoPageProps) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState<LoginResponse['user'] | null>(null);

  const tokenProvider: AuthTokenProvider = {
    getAccessToken: () => token,
  };

  const api = new AiAssistantApiClient(apiBaseUrl, tokenProvider);

  useEffect(() => {
    if (token !== null) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  }, [token]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">M Suite — AI Asistan Modülü Demo</h1>
        <p className="mt-1 text-sm text-slate-600">
          Strangler Fig: App.jsx&apos;in 12386. satırındaki eski AIAssistantWidget yerinde, yeni
          modüler widget burada.
        </p>
      </header>

      {token === null ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm
            apiBaseUrl={apiBaseUrl}
            onLogin={(t, u) => {
              setToken(t);
              setUser(u);
            }}
          />
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm flex items-center justify-between">
            <span className="text-sm text-slate-700">
              {user?.fullName ?? user?.username ?? 'Giriş yapıldı'}{' '}
              <span className="text-slate-400">({user?.role ?? 'admin'})</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setToken(null);
                setUser(null);
              }}
              className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
            >
              Çıkış
            </button>
          </section>

          <AiAssistantWidget
            api={api}
            options={{
              system:
                'Sen M Suite adlı Türk finans + İK yazılımının yardımcı asistanısın. Türkçe, kısa ve net cevaplar ver.',
            }}
          />
        </>
      )}

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

function ArchitectureNotes() {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-slate-700">
      <h3 className="font-semibold text-emerald-900">Mimari notlar</h3>
      <ul className="mt-3 space-y-1.5 list-disc pl-5">
        <li>
          Bu sayfa <code>frontend/ai-demo.html</code> entry&apos;sinden çağrılıyor.{' '}
          <code>App.jsx</code>&apos;e dokunulmadı.
        </li>
        <li>
          Widget <code>frontend/src/modules/ai/</code> altındaki SOLID-katmanlı modülden geliyor.
        </li>
        <li>
          Backend <code>/v1/ai/chat</code> endpoint&apos;i ile gerçek HTTP üzerinden konuşuyor;
          backend modülünün use-case&apos;i Claude API&apos;ye iletiyor.
        </li>
        <li>
          ANTHROPIC_API_KEY eklenmemişse &quot;AI servisi yapılandırılmamış&quot; mesajı görürsün —
          bu doğru davranış (ClaudeApiNotConfiguredError).
        </li>
      </ul>
    </section>
  );
}
