# Frontend → API Migration Guide

`promet_cf.jsx` (8427 satırlık React app) bu API server'a nasıl bağlanır — adım adım.

> **Hedef:** Frontend'deki `S` (storage abstraction) object'ini bir `APIClient` ile değiştirmek. Mevcut UI kodunun çoğunu değiştirmek gerekmez — sadece state hydration ve mutation katmanı.

---

## İçerik

1. [Mevcut Durum Analizi](#1-mevcut-durum-analizi)
2. [Genel Strateji](#2-genel-strateji)
3. [API Client](#3-api-client)
4. [Auth Akışı](#4-auth-akışı)
5. [Bootstrap (Şirket State'i)](#5-bootstrap-şirket-statei)
6. [Modül-bazlı Mapping](#6-modül-bazlı-mapping)
7. [Optimistic Updates](#7-optimistic-updates)
8. [Error Handling](#8-error-handling)
9. [Loading States](#9-loading-states)
10. [Real-time (Opsiyonel)](#10-real-time-opsiyonel)

---

## 1. Mevcut Durum Analizi

Mevcut React app, bir `S` (Storage) object'i üzerinden window.storage API'sini kullanıyor:

```javascript
// Mevcut kullanım (artifact içinde)
const S = {
  async get(key) {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : null;
  },
  async set(key, value) {
    return window.storage.set(key, JSON.stringify(value));
  },
  async delete(key) { return window.storage.delete(key); },
  async list(prefix) { return window.storage.list(prefix); },
};

// Örnek: faturalar
await S.set(`invoices:${companyId}:${invoiceId}`, invoiceData);
const invoices = await S.list(`invoices:${companyId}:`);
```

**Anahtar yapısı:**
- `users` — kullanıcı listesi (sistem)
- `session` — aktif kullanıcı
- `companies:list` — şirket listesi
- `companies:${cid}` — şirket detayı + state
- `categories:${cid}:${section}` — kategoriler
- `cells:${cid}:${categoryId}:${monthIdx}` — hücre değerleri
- `invoices:${cid}:${invoiceId}` — faturalar
- `kasaEntries:${cid}:${entryId}` — kasa hareketleri
- `transfers:${cid}:${transferId}` — transferler
- `revaluations:${cid}:${revalId}` — kur değerlemeleri
- `archives:${cid}:${year}` — mali yıl arşivleri
- `notificationSettings:${cid}` — bildirim ayarları
- `auditLog:${cid}:${logId}` — denetim kayıtları

---

## 2. Genel Strateji

**3 adım yaklaşımı:**

| Adım | Eylem | Süresi |
|---|---|---|
| 1 | `S` object'ini `APIClient` ile değiştir, aynı interface'i koru | 1 gün |
| 2 | Bootstrap (`getState()`) ile tek seferde tüm veriyi al, state hydrate et | 0.5 gün |
| 3 | Login ekranı + token yönetimi | 0.5 gün |

Mevcut UI kodunun **%90'ı değişmez** — sadece veri katmanı.

### Önemli kavramsal değişiklik

`S` her zaman tek bir entity üzerinde çalışıyordu (`get/set/delete/list`). API ise:
- **Bootstrap'ta** tüm şirket state'ini tek seferde getirir (`/companies/:cid/state`)
- Mutation'lar **tek bir endpoint** hit eder (örn. `PUT /cells/:catId/:monthIdx`)
- **Listeleri yeniden çekme** yerine, mutation sonrası **lokal state'i optimistic güncelle**

---

## 3. API Client

`src/lib/api.js` (yeni dosya):

```javascript
// ============================================================================
// Promet CF — API Client
// Storage abstraction'ı yerine alır. Aynı kullanım patterni:
//   const data = await api.companies.list();
//   await api.cells.update(cid, catId, monthIdx, value);
// ============================================================================

const API_BASE = import.meta.env.VITE_API_BASE ?? "/v1";

// =================== Token storage ===================
const TOKEN_KEY = "promet_cf_access_token";
const REFRESH_KEY = "promet_cf_refresh_token";
const USER_KEY = "promet_cf_user";

export const tokens = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set(access, refresh) {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const currentUser = {
  get: () => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  set: (u) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clear: () => localStorage.removeItem(USER_KEY),
};

// =================== Refresh logic ===================
let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refresh = tokens.getRefresh();
    if (!refresh) throw new Error("No refresh token");
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      tokens.clear();
      window.location.href = "/login";
      throw new Error("Refresh failed");
    }
    const data = await res.json();
    tokens.set(data.accessToken, refresh);
    return data.accessToken;
  })();
  try { return await refreshPromise; }
  finally { refreshPromise = null; }
}

// =================== Fetch wrapper ===================
async function request(method, path, body, opts = {}) {
  let token = tokens.getAccess();
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers ?? {}),
  };
  if (token && !opts.noAuth) headers.Authorization = `Bearer ${token}`;

  const init = { method, headers };
  if (body !== undefined && body !== null) {
    init.body = JSON.stringify(body);
  }

  let res = await fetch(`${API_BASE}${path}`, init);

  // 401 → refresh dene
  if (res.status === 401 && !opts.noAuth && !opts.didRefresh) {
    try {
      token = await refreshAccessToken();
      headers.Authorization = `Bearer ${token}`;
      res = await fetch(`${API_BASE}${path}`, init);
    } catch {
      throw new APIError(401, "Oturum süresi doldu", {});
    }
  }

  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch {}
    throw new APIError(res.status, body.message ?? res.statusText, body.details ?? {});
  }

  if (res.status === 204) return null;
  return await res.json();
}

export class APIError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// =================== API surface ===================
export const api = {
  // Auth
  auth: {
    login: (username, password) =>
      request("POST", "/auth/login", { username, password }, { noAuth: true }),
    refresh: () => refreshAccessToken(),
    logout: () => request("POST", "/auth/logout"),
    me: () => request("GET", "/auth/me"),
    changePassword: (currentPassword, newPassword) =>
      request("POST", "/auth/change-password", { currentPassword, newPassword }),
  },

  // Companies
  companies: {
    list: () => request("GET", "/companies"),
    get: (cid) => request("GET", `/companies/${cid}`),
    state: (cid) => request("GET", `/companies/${cid}/state`),   // BOOTSTRAP
    create: (data) => request("POST", "/companies", data),
    update: (cid, data) => request("PATCH", `/companies/${cid}`, data),
    delete: (cid) => request("DELETE", `/companies/${cid}`),
  },

  // Categories
  categories: {
    list: (cid, section) => request("GET", `/companies/${cid}/categories${section ? `?section=${section}` : ""}`),
    create: (cid, data) => request("POST", `/companies/${cid}/categories`, data),
    update: (cid, id, data) => request("PATCH", `/companies/${cid}/categories/${id}`, data),
    delete: (cid, id) => request("DELETE", `/companies/${cid}/categories/${id}`),
  },

  // Cells
  cells: {
    list: (cid, fiscalYear) =>
      request("GET", `/companies/${cid}/cells${fiscalYear ? `?fiscalYear=${fiscalYear}` : ""}`),
    update: (cid, catId, monthIdx, value) =>
      request("PUT", `/companies/${cid}/cells/${catId}/${monthIdx}`, { value }),
    bulkUpdate: (cid, cells, fiscalYear) =>
      request("PUT", `/companies/${cid}/cells`, { cells, fiscalYear }),
  },

  // Banks
  banks: {
    listSystem: () => request("GET", "/banks"),
    accounts: (cid) => request("GET", `/companies/${cid}/bank-accounts`),
    createAccount: (cid, data) => request("POST", `/companies/${cid}/bank-accounts`, data),
    updateAccount: (cid, id, data) => request("PATCH", `/companies/${cid}/bank-accounts/${id}`, data),
    deleteAccount: (cid, id) => request("DELETE", `/companies/${cid}/bank-accounts/${id}`),
  },

  // Kasa
  kasa: {
    accounts: (cid) => request("GET", `/companies/${cid}/kasa-accounts`),
    createAccount: (cid, data) => request("POST", `/companies/${cid}/kasa-accounts`, data),
    entries: (cid) => request("GET", `/companies/${cid}/kasa-entries`),
    createEntry: (cid, data) => request("POST", `/companies/${cid}/kasa-entries`, data),
    deleteEntry: (cid, id) => request("DELETE", `/companies/${cid}/kasa-entries/${id}`),
  },

  // Transfers
  transfers: {
    list: (cid) => request("GET", `/companies/${cid}/transfers`),
    create: (cid, data) => request("POST", `/companies/${cid}/transfers`, data),
    delete: (cid, id) => request("DELETE", `/companies/${cid}/transfers/${id}`),
  },

  // Invoices
  invoices: {
    list: (cid, filters = {}) => {
      const qs = new URLSearchParams(filters).toString();
      return request("GET", `/companies/${cid}/invoices${qs ? `?${qs}` : ""}`);
    },
    create: (cid, data) => request("POST", `/companies/${cid}/invoices`, data),
    update: (cid, id, data) => request("PATCH", `/companies/${cid}/invoices/${id}`, data),
    delete: (cid, id) => request("DELETE", `/companies/${cid}/invoices/${id}`),
    addPayment: (cid, invoiceId, payment) =>
      request("POST", `/companies/${cid}/invoices/${invoiceId}/payments`, payment),
    bulkCommit: (cid) => request("POST", `/companies/${cid}/invoices/bulk-commit`),
  },

  // FX
  fx: {
    current: () => request("GET", "/exchange-rates"),
    fetchTCMB: () => request("POST", "/exchange-rates/fetch-tcmb"),
    history: (currency, from, to) => {
      const qs = new URLSearchParams({ currency, from, to }).toString();
      return request("GET", `/exchange-rates/history?${qs}`);
    },
    revaluations: (cid) => request("GET", `/companies/${cid}/revaluations`),
    createRevaluation: (cid, data) => request("POST", `/companies/${cid}/revaluations`, data),
  },

  // Archives
  archives: {
    list: (cid) => request("GET", `/companies/${cid}/archives`),
    get: (cid, year) => request("GET", `/companies/${cid}/archives/${year}`),
    closeYear: (cid, data) => request("POST", `/companies/${cid}/archives/close-year`, data),
    delete: (cid, year) => request("DELETE", `/companies/${cid}/archives/${year}`),
  },

  // Notifications
  notifications: {
    settings: (cid) => request("GET", `/companies/${cid}/notification-settings`),
    updateSettings: (cid, data) => request("PATCH", `/companies/${cid}/notification-settings`, data),
    generate: (cid) => request("POST", `/companies/${cid}/notifications/generate`),
    send: (cid) => request("POST", `/companies/${cid}/notifications/send`),
  },

  // AI predictions
  ai: {
    predictions: (cid, horizon = 3, useArchives = true) =>
      request("GET", `/companies/${cid}/ai/predictions?horizon=${horizon}&useArchives=${useArchives}`),
  },

  // Audit
  audit: {
    list: (filters = {}) => {
      const qs = new URLSearchParams(filters).toString();
      return request("GET", `/audit-logs${qs ? `?${qs}` : ""}`);
    },
  },
};
```

---

## 4. Auth Akışı

### Login ekranı (yeni component)

```jsx
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { accessToken, refreshToken, user } = await api.auth.login(username, password);
      tokens.set(accessToken, refreshToken);
      currentUser.set(user);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="...">
      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Kullanıcı adı" required />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Şifre" required />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>{loading ? "Giriş yapılıyor..." : "Giriş Yap"}</button>
    </form>
  );
}
```

### App.jsx başlangıç akışı

```jsx
function App() {
  const [user, setUser] = useState(currentUser.get());
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [state, setState] = useState(null); // şirket state'i

  // İlk açılışta token varsa kullanıcı bilgisini çek
  useEffect(() => {
    if (!tokens.getAccess()) return;
    api.auth.me()
      .then(u => { currentUser.set(u); setUser(u); })
      .catch(() => { tokens.clear(); setUser(null); });
  }, []);

  // Login sonrası şirket listesi al
  useEffect(() => {
    if (!user) return;
    api.companies.list().then(setCompanies);
  }, [user]);

  // Aktif şirket değişince state'i bootstrap et
  useEffect(() => {
    if (!activeCompanyId) return;
    setState(null); // loading state
    api.companies.state(activeCompanyId).then(setState);
  }, [activeCompanyId]);

  if (!user) return <LoginScreen onLogin={setUser} />;
  if (!companies.length) return <div>Erişim verilen şirket yok</div>;
  if (!activeCompanyId) return <CompanySelector companies={companies} onSelect={setActiveCompanyId} />;
  if (!state) return <div>Yükleniyor...</div>;

  return <MainApp state={state} setState={setState} cid={activeCompanyId} />;
}
```

---

## 5. Bootstrap (Şirket State'i)

`GET /companies/:cid/state` çağrısı tek seferde her şeyi getirir. Eski `S.list(...)` çağrılarının yerini alır.

### Önce (eski)

```javascript
const inflows = await S.list(`categories:${cid}:inflows:`);
const outflows = await S.list(`categories:${cid}:outflows:`);
const cells = {};
const cellKeys = await S.list(`cells:${cid}:`);
for (const k of cellKeys.keys) {
  cells[k.replace(`cells:${cid}:`, "")] = (await S.get(k)).value;
}
const invoices = await S.list(`invoices:${cid}:`);
// ...
```

### Sonra (yeni)

```javascript
const state = await api.companies.state(cid);
// state.inflows, state.outflows, state.cells (zaten "catId:monthIdx" map),
// state.invoices, state.bankAccounts, state.kasaAccounts, ...
```

### State shape

```typescript
{
  company: { id, name, fiscalYear, openingCash, ... },
  inflows: Category[],
  outflows: Category[],
  nonPnlOutflows: Category[],
  kasaCategories: Category[],
  cells: { "12:0": 350000, "12:1": 380000, ... },  // "catId:monthIdx" → value
  bankAccounts: BankAccount[],  // .balance hesaplanmış olarak gelir
  kasaAccounts: KasaAccount[],   // .balance hesaplanmış
  kasaEntries: KasaEntry[],
  transfers: Transfer[],
  invoices: Invoice[],           // .payments dahil
  revaluations: Revaluation[],
  notificationSettings: { enabled, recipients, cronSchedule, ... },
  archives: Archive[],           // metadata; full snapshot için /archives/:year
}
```

---

## 6. Modül-bazlı Mapping

| Mevcut S çağrısı | Yeni API çağrısı | Notlar |
|---|---|---|
| `S.set(\`cells:${cid}:${catId}:${m}\`, v)` | `api.cells.update(cid, catId, m, v)` | Sıfırsa otomatik silinir |
| `S.list(\`cells:${cid}:\`)` (bootstrap) | `state.cells` (bootstrap içinde) | Ayrı çağrı yok |
| Toplu hücre güncelleme (Excel import) | `api.cells.bulkUpdate(cid, cellsMap)` | Tek transaction |
| `S.set(\`invoices:${cid}:${id}\`, data)` create | `api.invoices.create(cid, data)` | Backend ID üretir |
| `S.set(\`invoices:${cid}:${id}\`, data)` update | `api.invoices.update(cid, id, changes)` | PATCH, sadece değişen alanlar |
| `S.delete(\`invoices:${cid}:${id}\`)` | `api.invoices.delete(cid, id)` | |
| Manuel paid_amount güncelleme | `api.invoices.addPayment(cid, id, payment)` | Backend paid_amount otomatik |
| **Toplu yansıt** (bulk commit) | `api.invoices.bulkCommit(cid)` | Tek transaction, response: counts |
| Kasa entry create | `api.kasa.createEntry(cid, data)` | |
| Transfer create | `api.transfers.create(cid, data)` | |
| Banka hesabı bakiyesi (manuel hesaplama) | `state.bankAccounts[i].balance` | Backend `v_bank_balances` view |
| TCMB kurları çekme | `api.fx.fetchTCMB()` | Backend cron da çeker |
| Yıl sonu kapanışı (manuel snapshot) | `api.archives.closeYear(cid, { newFiscalYear, ... })` | Backend transaction içinde |
| AI tahmin (frontend hesaplama) | `api.ai.predictions(cid, horizon)` | Backend ensemble |
| Bildirim raporu üret | `api.notifications.generate(cid)` | Text + summary döner |
| E-mail gönder | `api.notifications.send(cid)` | SMTP üzerinden |

---

## 7. Optimistic Updates

Hücre düzenleme gibi sık operasyonlar için UI'yı hemen güncelle, sonra backend'e gönder. Hata olursa geri al.

```javascript
const updateCell = async (catId, monthIdx, newValue) => {
  const key = `${catId}:${monthIdx}`;
  const oldValue = state.cells[key];

  // 1. Optimistic UI update
  setState(s => ({ ...s, cells: { ...s.cells, [key]: newValue } }));

  // 2. Backend'e gönder
  try {
    await api.cells.update(cid, catId, monthIdx, newValue);
  } catch (err) {
    // 3. Rollback + hata toast
    setState(s => ({ ...s, cells: { ...s.cells, [key]: oldValue } }));
    toast.error(`Hücre kaydedilemedi: ${err.message}`);
  }
};
```

### Bulk commit gibi büyük operasyonlar

```javascript
const doBulkCommit = async () => {
  const confirmed = await confirmModal("Bekleyen tüm kayıtları yansıtmak istediğinize emin misiniz?");
  if (!confirmed) return;

  setLoading(true);
  try {
    const result = await api.invoices.bulkCommit(cid);
    toast.success(
      `${result.toplam} kayıt yansıtıldı (${result.etkilenenHücre} hücre, ${formatTL(result.toplamTRY)} TL)`
    );
    // State'i refresh
    const newState = await api.companies.state(cid);
    setState(newState);
  } catch (err) {
    toast.error(err.message);
  } finally {
    setLoading(false);
  }
};
```

---

## 8. Error Handling

Tüm API çağrıları `APIError` fırlatabilir:

```javascript
try {
  await api.invoices.create(cid, invoiceData);
  toast.success("Fatura oluşturuldu");
} catch (err) {
  if (err instanceof APIError) {
    if (err.status === 403) {
      toast.error("Bu işlem için yetkiniz yok");
    } else if (err.status === 400 && err.details) {
      // Validation hatası — details: { field: ["error1", "error2"] }
      const messages = Object.entries(err.details)
        .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
        .join("; ");
      toast.error(`Doğrulama hatası: ${messages}`);
    } else {
      toast.error(err.message);
    }
  } else {
    toast.error("Beklenmedik hata");
    console.error(err);
  }
}
```

### Global error boundary

```jsx
<ErrorBoundary fallback={<ErrorScreen />}>
  <App />
</ErrorBoundary>
```

---

## 9. Loading States

Bootstrap yüklenirken skeleton göster:

```jsx
function CompanyView({ cid }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setState(null);
    setError(null);
    api.companies.state(cid)
      .then(setState)
      .catch(setError);
  }, [cid]);

  if (error) return <div className="error">{error.message}</div>;
  if (!state) return <CompanyViewSkeleton />;
  return <MainGrid state={state} />;
}

function CompanyViewSkeleton() {
  return (
    <div className="grid">
      {/* Skeleton rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
```

### Mutation loading

Buton-bazlı:

```jsx
<button
  onClick={doBulkCommit}
  disabled={loading}
>
  {loading ? "Yansıtılıyor..." : `Toplu Yansıt (${pendingCount})`}
</button>
```

---

## 10. Real-time (Opsiyonel — Gelecek Sürüm)

Çoklu kullanıcı senaryosunda başkasının yaptığı değişiklikleri görmek için WebSocket eklenebilir:

```javascript
// Backend tarafında socket.io veya native WebSocket
// Frontend:
const ws = new WebSocket(`wss://api.../v1/ws?token=${accessToken}`);
ws.onmessage = (e) => {
  const event = JSON.parse(e.data);
  if (event.type === "cell_update" && event.cid === activeCompanyId) {
    setState(s => ({ ...s, cells: { ...s.cells, [event.key]: event.value } }));
  }
};
```

**MVP için gerekli değil** — tek kullanıcı senaryosunda mevcut tasarım yeterli.

---

## Migration Checklist

- [ ] `src/lib/api.js` oluşturuldu (yukarıdaki kod)
- [ ] `S` referansları silindi veya `api`'ye yönlendirildi
- [ ] LoginScreen component'i eklendi
- [ ] App.jsx initial state akışı güncellendi (token kontrol → me → companies → state)
- [ ] Şirket dropdown'u `api.companies.list()` kullanıyor
- [ ] Şirket değişimi `api.companies.state(cid)` ile bootstrap yapıyor
- [ ] Hücre güncellemeleri optimistic + `api.cells.update()`
- [ ] Fatura CRUD `api.invoices.*` kullanıyor
- [ ] Bulk commit `api.invoices.bulkCommit()` kullanıyor
- [ ] Kasa/transfer modulları API'ye bağlandı
- [ ] TCMB kur çekme `api.fx.fetchTCMB()` kullanıyor (cron sunucu tarafında çalışır)
- [ ] AI predictions `api.ai.predictions()` kullanıyor (server-side)
- [ ] Yıl kapanışı `api.archives.closeYear()` kullanıyor
- [ ] Bildirim ayarları + send `api.notifications.*`
- [ ] Audit log görüntüleme `api.audit.list()` (cfo+)
- [ ] Logout: `api.auth.logout()` + `tokens.clear()` + redirect

---

## Vite proxy konfigürasyonu (dev)

`vite.config.js`:

```javascript
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/v1": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

Bu sayede frontend `/v1/auth/login` yazınca arkadan `http://localhost:3000/v1/auth/login`'a gider, CORS sorunu yok.

---

## Sonuç

Migration süresi tahmini: **2-3 gün** (tek geliştirici).
- Gün 1: api.js + login flow + bootstrap
- Gün 2: CRUD modulleri (invoices, cells, kasa, transfers)
- Gün 3: AI/FX/archives/notifications + test + bug fix

UI kodunun büyük çoğunluğu olduğu gibi kalır — sadece state hydration ve mutation katmanı yer değiştirir.
