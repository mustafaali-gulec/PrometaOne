/**
 * M Suite Frontend ↔ Backend Köprüsü
 * ----------------------------------------
 * Bu dosya window.PROMETA_API objesi oluşturur. Backend mevcut değilse
 * frontend otomatik olarak demo modunda çalışır (localStorage + console).
 *
 * Backend ayağa kalktıysa şu endpoint'ler kullanılır:
 *  - POST /v1/auth/forgot-password
 *  - POST /v1/auth/reset-password
 */

// VITE_API_URL çıplak origin (örn. http://localhost:3000) olarak verilmiş olabilir; backend
// /v1 altında servis ettiğinden API_BASE her zaman /v1 ile bitmeli. Aksi halde /health ve
// /auth/* çağrıları 404 döner → "backend erişilemez" YANLIŞ alarmı + gereksiz demo mod.
// Varsayılan göreli '/v1' (vite proxy üzerinden çalışır).
const RAW_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = RAW_API_URL
  ? /\/v1$/.test(RAW_API_URL)
    ? RAW_API_URL
    : RAW_API_URL + '/v1'
  : '/v1';

// Backend mevcut mu kontrolü (sayfa açıldığında)
async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

window.PROMETA_API = {
  // Şifre sıfırlama talebi gönder
  sendPasswordResetEmail: async ({ username, email, token }) => {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrUsername: email || username,
        lang: window.__PROMETA_LANG__ || 'tr',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Token ile yeni şifre belirle
  resetPassword: async ({ token, newPassword }) => {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, reason: err.message || 'error' };
    }
    return res.json();
  },
};

// Backend yoksa PROMETA_API'yi sil → demo modu devreye girer
checkBackend().then((ok) => {
  if (!ok) {
    console.warn('⚠️ Backend erişilemez. Demo mod aktif. Veriler tarayıcıda saklanıyor.');
    delete window.PROMETA_API;
  } else {
    console.log('✓ Backend bağlantısı aktif (' + API_BASE + ')');
  }
});

// Eğer browser storage API yoksa basit polyfill
if (!window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      return v ? { value: v } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { ok: true };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { ok: true };
    },
    async list(prefix) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!prefix || k.startsWith(prefix)) keys.push(k);
      }
      return { keys };
    },
  };
}
