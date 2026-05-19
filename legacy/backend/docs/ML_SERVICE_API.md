# ML Service — Backend (Node.js) Proxy Integration

## Genel Bakış

Frontend (React) doğrudan ML servisine değil, **Node.js backend** üzerinden erişir. Bu sayede:

- ✅ Tenant izolasyonu (her şirket sadece kendi modelini eğitir/sorgular)
- ✅ Auth/JWT doğrulaması
- ✅ Rate limiting
- ✅ Veri filtreleme (frontend'in göndereceği veri minimize edilir)

## Mimari

```
Frontend (React) ───▶ Backend (Node.js) ───▶ ML Service (Python)
       :5173               :3000                    :8001
```

## Proxy Endpoint'leri (Backend Node.js'de eklenecek)

### Express.js Örnek Kodu

```javascript
// backend/routes/ml.routes.js
const express = require("express");
const axios = require("axios");
const router = express.Router();
const { requireAuth, requireTenant } = require("../middleware/auth");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://ml-service:8001";

// Yardımcı: Tenant ID'yi session'dan al
function getTenantId(req) {
  return req.session?.companyId || req.user?.tenantId || "default";
}

// =========================================
// EĞİTİM ENDPOINT'LERİ
// =========================================

// POST /api/ml/train/cari-pattern
router.post("/train/cari-pattern", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    // Frontend'den gelen invoices listesini ML'e ilet
    const response = await axios.post(`${ML_SERVICE_URL}/train/cari-pattern`, {
      tenant_id: tenantId,
      invoices: req.body.invoices || [],
    }, { timeout: 60000 });
    res.json(response.data);
  } catch (err) {
    console.error("ML train cari-pattern error:", err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/ml/train/journal-classifier
router.post("/train/journal-classifier", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const response = await axios.post(`${ML_SERVICE_URL}/train/journal-classifier`, {
      tenant_id: tenantId,
      entries: req.body.entries || [],
    }, { timeout: 60000 });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// =========================================
// TAHMİN ENDPOINT'LERİ
// =========================================

// POST /api/ml/predict/due-date
router.post("/predict/due-date", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const response = await axios.post(`${ML_SERVICE_URL}/predict/due-date`, {
      tenant_id: tenantId,
      party_id: req.body.partyId,
      invoice_type: req.body.invoiceType || "out",
      invoice_date: req.body.invoiceDate,
      amount: req.body.amount,
    }, { timeout: 5000 });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/ml/predict/amount
router.post("/predict/amount", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const response = await axios.post(`${ML_SERVICE_URL}/predict/amount`, {
      tenant_id: tenantId,
      party_id: req.body.partyId,
      invoice_type: req.body.invoiceType || "out",
      invoice_date: req.body.invoiceDate,
      description: req.body.description || "",
    }, { timeout: 5000 });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/ml/predict/account
router.post("/predict/account", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const response = await axios.post(`${ML_SERVICE_URL}/predict/account`, {
      tenant_id: tenantId,
      description: req.body.description,
      top_k: req.body.topK || 3,
    }, { timeout: 5000 });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/ml/detect/anomaly
router.post("/detect/anomaly", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const response = await axios.post(`${ML_SERVICE_URL}/detect/anomaly`, {
      tenant_id: tenantId,
      party_id: req.body.partyId,
      invoice_type: req.body.invoiceType || "out",
      total: req.body.total,
      vat_rate: req.body.vatRate || 20,
    }, { timeout: 5000 });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/ml/detect/payroll-anomaly
router.post("/detect/payroll-anomaly", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const response = await axios.post(`${ML_SERVICE_URL}/detect/payroll-anomaly`, {
      tenant_id: tenantId,
      employee_id: req.body.employeeId,
      current: req.body.current,
      history: req.body.history || [],
    }, { timeout: 5000 });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// POST /api/ml/predict/batch-cari-summary
router.post("/predict/batch-cari-summary", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const response = await axios.post(`${ML_SERVICE_URL}/predict/batch-cari-summary`, {
      tenant_id: tenantId,
      party_ids: req.body.partyIds || [],
      invoice_type: req.body.invoiceType || "out",
    }, { timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// =========================================
// YÖNETİM ENDPOINT'LERİ
// =========================================

// GET /api/ml/models — Bu tenant'a ait modelleri listele
router.get("/models", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const response = await axios.get(`${ML_SERVICE_URL}/models/${tenantId}`);
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// DELETE /api/ml/models — Bu tenant'ın tüm modellerini sil
router.delete("/models", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const response = await axios.delete(`${ML_SERVICE_URL}/models/${tenantId}`);
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || err.message,
    });
  }
});

// GET /api/ml/health — ML servisin durumu
router.get("/health", async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 3000 });
    res.json({ ml_service: "up", ...response.data });
  } catch (err) {
    res.status(503).json({ ml_service: "down", error: err.message });
  }
});

module.exports = router;
```

## Backend Ana Server'a Ekleme

`server.js` veya `app.js`'de:

```javascript
const mlRoutes = require("./routes/ml.routes");
app.use("/api/ml", mlRoutes);
```

## Auth Middleware Örneği

Eğer henüz yoksa:

```javascript
// middleware/auth.js
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

module.exports = { requireAuth };
```

## Bağımlılık Yükleme

```bash
cd backend
npm install axios
```

## Test

```bash
# ML servis sağlığı
curl http://localhost:3000/api/ml/health

# Beklenen yanıt:
# {"ml_service":"up","status":"ok","models_cached":0}
```

## Notlar

- **Timeout süreleri**: Eğitim 60s, tahminler 5s, batch 10s
- **Tenant izolasyonu**: Her tenant kendi pickle dosyasını kullanır
- **Veri akışı**: Frontend → Backend (auth + tenant) → ML Service → Pickle dosyası
- **Performans**: Modeller in-memory cache'lenir, ilk istek diskten yüklenir
