/**
 * @vitest-environment node
 *
 * Token auto-refresh (401 → /v1/auth/refresh → retry-once) testleri.
 *
 * Hem AccessApiClient'in reaktif retry mantigi hem de
 * createTokenRefresher'in localStorage + /v1/auth/refresh akisi mock'lanmis
 * fetch ile dogrulanir. happy-dom yerine `node` ortami secilir; bu testin
 * DOM'a ihtiyaci yoktur, localStorage manuel stub'lanir.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessApiClient } from '../infrastructure/api/AccessApiClient';
import {
  ACCESS_TOKEN_KEY,
  LocalStorageAuthTokenProvider,
  REFRESH_TOKEN_KEY,
  createTokenRefresher,
} from '../infrastructure/auth/RefreshingAuthTokenProvider';

const BASE = 'http://api.test';

// ---------------------------------------------------------------------------
// localStorage stub (node ortaminda window yok)
// ---------------------------------------------------------------------------
function installLocalStorage(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map<string, string>(Object.entries(initial));
  const ls = {
    getItem: (k: string): string | null => store.get(k) ?? null,
    setItem: (k: string, v: string): void => void store.set(k, v),
    removeItem: (k: string): void => void store.delete(k),
    clear: (): void => store.clear(),
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage: ls };
  return store;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('createTokenRefresher', () => {
  beforeEach(() => {
    installLocalStorage({ [REFRESH_TOKEN_KEY]: 'refresh-abc' });
  });

  it('POSTs the stored refresh token to /v1/auth/refresh and stores the new access token', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ accessToken: 'new-access', expiresIn: 900 }),
    );
    const refresh = createTokenRefresher(BASE, fetchMock);

    const token = await refresh();

    expect(token).toBe('new-access');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/v1/auth/refresh`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'refresh-abc' });
    // localStorage'a yazildi mi?
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('new-access');
  });

  it('stores a rotated refresh token if the backend returns one', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ accessToken: 'new-access', refreshToken: 'rotated-xyz' }),
    );
    const refresh = createTokenRefresher(BASE, fetchMock);

    await refresh();

    expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('rotated-xyz');
  });

  it('returns null and does not fetch when no refresh token is stored', async () => {
    installLocalStorage({}); // refresh token yok
    const fetchMock = vi.fn();
    const refresh = createTokenRefresher(BASE, fetchMock);

    const token = await refresh();

    expect(token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when /v1/auth/refresh responds non-OK', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'invalid' }, 401));
    const refresh = createTokenRefresher(BASE, fetchMock);

    expect(await refresh()).toBeNull();
  });
});

describe('AccessApiClient — 401 retry-once', () => {
  beforeEach(() => {
    installLocalStorage({
      [ACCESS_TOKEN_KEY]: 'stale-access',
      [REFRESH_TOKEN_KEY]: 'refresh-abc',
    });
  });

  it('refreshes once on 401 and retries the original request with the new token', async () => {
    const refreshSpy = vi.fn(async (): Promise<string | null> => {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, 'fresh-access');
      return 'fresh-access';
    });

    // 1) ilk istek 401, 2) refresh sonrasi tekrar → 200
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'token expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ roles: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new AccessApiClient(BASE, new LocalStorageAuthTokenProvider(), refreshSpy);
    const result = await client.listRoles(1);

    expect(result).toEqual({ roles: [] });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // ilk cagri stale token, ikinci cagri fresh token ile gitmeli
    const firstAuth = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<
      string,
      string
    >;
    const secondAuth = (fetchMock.mock.calls[1]![1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(firstAuth.Authorization).toBe('Bearer stale-access');
    expect(secondAuth.Authorization).toBe('Bearer fresh-access');
  });

  it('does not retry more than once — a second 401 surfaces as an error', async () => {
    const refreshSpy = vi.fn(async (): Promise<string | null> => 'fresh-access');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'token expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'still unauthorized' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    const client = new AccessApiClient(BASE, new LocalStorageAuthTokenProvider(), refreshSpy);

    await expect(client.listRoles(1)).rejects.toThrow('still unauthorized');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('without a refresh callback, a 401 is not retried (static behavior preserved)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'token expired' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    const client = new AccessApiClient(BASE, new LocalStorageAuthTokenProvider());

    await expect(client.listRoles(1)).rejects.toThrow('token expired');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('end-to-end: real createTokenRefresher drives the retry', async () => {
    // ilk listRoles → 401; sonra refresh çağrısı → 200 (yeni access);
    // sonra listRoles retry → 200.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401)) // listRoles #1
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh-access', expiresIn: 900 })) // refresh
      .mockResolvedValueOnce(jsonResponse({ roles: [] })); // listRoles #2
    vi.stubGlobal('fetch', fetchMock);

    const client = new AccessApiClient(
      BASE,
      new LocalStorageAuthTokenProvider(),
      createTokenRefresher(BASE, fetch),
    );

    const result = await client.listRoles(1);

    expect(result).toEqual({ roles: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]![0] as string).toBe(`${BASE}/v1/auth/refresh`);
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('fresh-access');
  });
});
