/* =====================================================================
   PROMETA ONE — AI BACKEND CLIENT
   ---------------------------------------------------------------------
   Backend ML servisi ile iletişim kuran utility'ler.
   Tüm fonksiyonlar local AI fallback'e izin verir.
   ===================================================================== */

const ML_API_BASE = (typeof window !== "undefined" && window.__ML_API_BASE__) || "/api/ml";
const ML_HEALTH_CACHE_KEY = "ml_service_status";
const ML_HEALTH_CACHE_DURATION = 30000; // 30 saniye

/* ------------------- Düşük seviye fetch yardımcısı ------------------- */
async function mlFetch(path, options = {}) {
  const url = `${ML_API_BASE}${path}`;
  const opts = {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...(options.body && { body: JSON.stringify(options.body) }),
  };

  const controller = new AbortController();
  const timeoutMs = options.timeout || 10000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  opts.signal = controller.signal;

  try {
    const res = await fetch(url, opts);
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `ML API ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error("ML request timeout");
    throw err;
  }
}

/* ------------------- ML Service Sağlık Kontrolü ------------------- */
let _healthCache = null;
let _healthCacheTime = 0;

export async function checkMLServiceHealth(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _healthCache && (now - _healthCacheTime) < ML_HEALTH_CACHE_DURATION) {
    return _healthCache;
  }
  try {
    const result = await mlFetch("/health", { timeout: 3000 });
    _healthCache = { available: true, ...result };
    _healthCacheTime = now;
    return _healthCache;
  } catch (err) {
    _healthCache = { available: false, error: err.message };
    _healthCacheTime = now;
    return _healthCache;
  }
}

/* ------------------- Eğitim Fonksiyonları ------------------- */

// Cari pattern modelini eğit (vade, tutar, sezonsallık)
export async function trainCariPattern(invoices) {
  // Frontend'deki invoice formatını ML servisin beklediği formata dönüştür
  const transformed = invoices.map(inv => ({
    id: inv.id,
    party_id: inv.partyId || null,
    invoice_no: inv.invoiceNo || "",
    type: inv.type || "out",
    date: inv.date,
    due_date: inv.dueDate || null,
    total: Number(inv.total) || 0,
    net_amount: Number(inv.netAmount) || 0,
    vat_rate: Number(inv.vatRate) || 0,
    vat_amount: Number(inv.vatAmount) || 0,
    currency: inv.currency || "TRY",
    paid_amount: Number(inv.paidAmount) || 0,
    payments: inv.payments || [],
    description: inv.description || "",
    cashflow_cat_id: inv.cashflowCatId || null,
  })).filter(inv => inv.party_id); // Sadece cari ile bağlı olanlar

  if (transformed.length < 5) {
    throw new Error("En az 5 cari-bağlı fatura gerekli (mevcut: " + transformed.length + ")");
  }

  return await mlFetch("/train/cari-pattern", {
    method: "POST",
    body: { invoices: transformed },
    timeout: 60000,
  });
}

// Yevmiye sınıflayıcı modelini eğit
export async function trainJournalClassifier(entries) {
  const transformed = entries
    .filter(e => e.status === "posted")
    .map(e => ({
      id: e.id,
      date: e.date,
      description: e.description || "",
      status: "posted",
      lines: (e.lines || []).filter(l => l.accountCode && l.description).map(l => ({
        account_code: l.accountCode,
        description: l.description,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      })),
    }))
    .filter(e => e.lines.length > 0);

  const totalLines = transformed.reduce((s, e) => s + e.lines.length, 0);
  if (totalLines < 10) {
    throw new Error("En az 10 hesap kodlu satır gerekli (mevcut: " + totalLines + ")");
  }

  return await mlFetch("/train/journal-classifier", {
    method: "POST",
    body: { entries: transformed },
    timeout: 60000,
  });
}

/* ------------------- Tahmin Fonksiyonları ------------------- */

// Vade tahmini
export async function predictDueDate({ partyId, invoiceType, invoiceDate, amount }) {
  return await mlFetch("/predict/due-date", {
    method: "POST",
    body: { partyId, invoiceType, invoiceDate, amount },
    timeout: 5000,
  });
}

// Tutar tahmini
export async function predictAmount({ partyId, invoiceType, invoiceDate, description }) {
  return await mlFetch("/predict/amount", {
    method: "POST",
    body: { partyId, invoiceType, invoiceDate, description },
    timeout: 5000,
  });
}

// Hesap kodu önerisi
export async function predictAccount({ description, topK = 3 }) {
  return await mlFetch("/predict/account", {
    method: "POST",
    body: { description, topK },
    timeout: 5000,
  });
}

// Anomali tespit
export async function detectAnomaly({ partyId, invoiceType, total, vatRate }) {
  return await mlFetch("/detect/anomaly", {
    method: "POST",
    body: { partyId, invoiceType, total, vatRate },
    timeout: 5000,
  });
}

// Bordro anomali tespit
export async function detectPayrollAnomaly({ employeeId, current, history }) {
  return await mlFetch("/detect/payroll-anomaly", {
    method: "POST",
    body: {
      employeeId,
      current: {
        employee_id: current.employeeId,
        period: current.period,
        gross_salary: Number(current.grossSalary) || 0,
        net_salary: Number(current.netSalary) || 0,
        overtime: Number(current.overtime) || 0,
        pay_items_count: current.payItemsCount || 0,
      },
      history: history.map(h => ({
        employee_id: h.employeeId,
        period: h.period,
        gross_salary: Number(h.grossSalary) || 0,
        net_salary: Number(h.netSalary) || 0,
        overtime: Number(h.overtime) || 0,
        pay_items_count: h.payItemsCount || 0,
      })),
    },
    timeout: 5000,
  });
}

// Toplu cari özet tahmini
export async function batchCariSummary({ partyIds, invoiceType = "out" }) {
  return await mlFetch("/predict/batch-cari-summary", {
    method: "POST",
    body: { partyIds, invoiceType },
    timeout: 10000,
  });
}

/* ------------------- Yönetim Fonksiyonları ------------------- */

// Bu tenant'a ait modelleri listele
export async function listModels() {
  return await mlFetch("/models");
}

// Bu tenant'ın tüm modellerini sil (retrain için)
export async function purgeModels() {
  return await mlFetch("/models", { method: "DELETE" });
}

/* ------------------- Yüksek Seviye Yardımcı: Hibrit Mod ------------------- */

/**
 * Backend'de modeli kontrol et, varsa kullan, yoksa local AI'a düş.
 * Bu fonksiyon mevcut local AI komponentlerini değiştirmeden eklenir.
 */
export async function getHybridPrediction(localPrediction, backendCall) {
  try {
    const health = await checkMLServiceHealth();
    if (!health.available) return { source: "local", ...localPrediction };
    const backendResult = await backendCall();
    return { source: "backend", ...backendResult };
  } catch (err) {
    console.warn("ML backend prediction failed, falling back to local:", err.message);
    return { source: "local", ...localPrediction };
  }
}

/* ------------------- Tek Erişim Noktası (default export) ------------------- */

export default {
  // Health
  checkMLServiceHealth,
  // Train
  trainCariPattern,
  trainJournalClassifier,
  // Predict
  predictDueDate,
  predictAmount,
  predictAccount,
  detectAnomaly,
  detectPayrollAnomaly,
  batchCariSummary,
  // Manage
  listModels,
  purgeModels,
  // Hybrid
  getHybridPrediction,
};
