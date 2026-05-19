# 🌐 Prometa One — ML Service

Eğitilebilir Machine Learning Mikroservisi (FastAPI + scikit-learn)

## Genel Bakış

Bu servis, Prometa One'ın frontend'inde local olarak çalışan AI özelliklerini **gerçek backend ML modelleri** ile güçlendirir.

### Avantajlar (Backend vs Local)

| Özellik | Local AI (Frontend) | Backend ML (FastAPI) |
|---------|---------------------|----------------------|
| Eğitim verisi | Tarayıcıda anlık hesaplama | Persistent pickle modelleri |
| Algoritma | Basit mode/median istatistikleri | Random Forest, IsolationForest, TF-IDF |
| Doğruluk | %70-85 | %85-95 |
| Performans | Anlık | <100ms yanıt |
| Çoklu kullanıcı | Her tarayıcı kendi hesaplar | Tek model, tüm kullanıcılar paylaşır |
| Tenant izolasyonu | Yok | Var (`{tenant_id}_*.pkl`) |
| Veri minimumu | 2-3 kayıt | 5-10 kayıt |

## Mimari

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Frontend   │───▶│  Backend     │───▶│  ML Service     │
│  React      │    │  Node.js     │    │  Python FastAPI │
│  :5173      │    │  :3000       │    │  :8001          │
└─────────────┘    └──────────────┘    └─────────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ scikit-learn │
                                       │ pickle files │
                                       └──────────────┘
```

## Kurulum

### 1. Docker ile (önerilen)

`docker-compose.yml` dosyanıza `docker-compose.snippet.yml` içeriğini ekleyin:

```bash
cd C:\prometa-one\

# ml-service klasörünü ana proje köküne kopyalayın
# Yapı:
# C:\prometa-one\
#   ├── frontend\
#   ├── backend\
#   ├── ml-service\        <-- YENİ
#   │   ├── main.py
#   │   ├── requirements.txt
#   │   └── Dockerfile
#   └── docker-compose.yml

# docker-compose.yml'a ml-service bloğunu ekleyin
# Sonra:
docker-compose up -d --build ml-service

# Kontrol:
curl http://localhost:8001/health
```

### 2. Yerel Çalıştırma (geliştirme)

```bash
cd ml-service
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## Backend (Node.js) Entegrasyonu

`backend/docs/ML_SERVICE_API.md` dosyasındaki proxy kodunu backend'inize ekleyin:

```javascript
// backend/server.js veya app.js
const mlRoutes = require("./routes/ml.routes");
app.use("/api/ml", mlRoutes);
```

Backend `.env`:
```
ML_SERVICE_URL=http://ml-service:8001
```

## Frontend Entegrasyonu

`frontend/src/utils/aiBackend.js` kullanın:

```javascript
import { trainCariPattern, predictDueDate, predictAccount } from "./utils/aiBackend";

// Model eğitimi (manuel veya cron ile)
await trainCariPattern(data.invoices);

// Vade tahmini
const result = await predictDueDate({
  partyId: "party_xyz",
  invoiceType: "out",
  invoiceDate: "2026-05-16",
  amount: 12500,
});
// → { predicted_days: 32, confidence: "high", method: "random_forest", ... }

// Hesap kodu önerisi
const accountSugg = await predictAccount({
  description: "Elektrik faturası ödemesi",
  topK: 3,
});
// → { suggestions: [{ account_code: "770", confidence: 95, ... }, ...] }
```

## Eğitim Verisi Minimumları

| Model | Minimum Kayıt | Önerilen |
|-------|---------------|----------|
| Cari Pattern | 5 fatura | 50+ |
| Vade Tahmini | 3 fatura/cari | 10+ |
| Anomali Tespit | 3 fatura/cari | 10+ (IsoForest için) |
| Sezonsallık | 4 fatura/cari | 12+ |
| Yevmiye Sınıflama | 10 satır | 100+ |

## Endpoint Listesi

### Eğitim

- `POST /train/cari-pattern` — Cari pattern (vade + tutar + sezonsallık)
- `POST /train/journal-classifier` — Yevmiye hesap kodu sınıflama

### Tahmin

- `POST /predict/due-date` — Cari için vade gün sayısı
- `POST /predict/amount` — Cari için beklenen tutar aralığı
- `POST /predict/account` — Açıklamadan hesap kodu önerisi (top-K)
- `POST /predict/batch-cari-summary` — Çoklu cari özet

### Tespit

- `POST /detect/anomaly` — Fatura tutarı anomali (IsoForest veya Z-score)
- `POST /detect/payroll-anomaly` — Bordro anomali

### Yönetim

- `GET /health` — Sağlık kontrolü
- `GET /models/{tenant_id}` — Tenant'a ait modeller
- `DELETE /models/{tenant_id}` — Modelleri sil (retrain için)

## Algoritmalar

### 1. Vade Tahmini — Random Forest Regressor
- **Features**: `[total, month, day_of_week, vat_rate]`
- **Hyperparameters**: `n_estimators=20, max_depth=5`
- **Fallback**: Constant veya median değer (yetersiz veri)

### 2. Anomali Tespit — Isolation Forest
- **Contamination**: 0.1 (toplam verinin %10'u anomali kabul edilir)
- **Fallback**: Z-score (eşik: 2.5σ)
- **Severity**: high (z>3) / medium (z>2)

### 3. Hesap Kodu Sınıflama — TF-IDF + Cosine Similarity
- **Max features**: 500
- **N-gram**: (1, 2)
- **Min similarity threshold**: 0.15

### 4. Sezonsallık — İstatistiksel Mode
- Çeyrek bazlı toplam dağılımı
- Aylık dağılım
- Yıllık tekrar tespit (LAG=12 ay)

### 5. Bordro Anomali — Z-Score + Trend Break
- Brüt/Net maaş Z-score (eşik: 2.0σ)
- Mesai ratio (3× üstü = anomali)
- Trend kırılması (%25+ değişim)

## Model Storage

Modeller `{tenant_id}_{model_name}.pkl` formatında saklanır:

```
models_data/
├── company_abc123_cari_pattern.pkl
├── company_abc123_journal_classifier.pkl
├── company_xyz789_cari_pattern.pkl
└── ...
```

## Performans

- **Eğitim süresi**: 5-30 saniye (veri boyutuna göre)
- **Tahmin süresi**: <100ms
- **Bellek kullanımı**: ~50-200MB (tenant başına)
- **Disk kullanımı**: ~1-10MB per model

## Güvenlik Notları

- Tenant izolasyonu pickle dosya adı bazında (`{tenant_id}_*`)
- Backend Node.js auth middleware ile tenant_id session'dan alınmalı
- Frontend'den direkt ML servisine erişim **engellenmeli** (sadece backend proxy)
- Üretim ortamında HTTPS şart

## Yeniden Eğitim

Modelleri belirli aralıklarla yenilemek için:

```javascript
// Frontend → Settings → "Train ML Models" butonu
async function retrainAll() {
  await trainCariPattern(data.invoices);
  await trainJournalClassifier(data.accJournalEntries);
  notify("Modeller yeniden eğitildi!");
}
```

Veya backend cron job:

```bash
# Her gece 03:00'te
0 3 * * * curl -X POST http://backend:3000/api/ml/retrain
```

## Sorun Giderme

### "Model not trained yet" hatası
→ İlk önce `/train/cari-pattern` çağırın

### Eğitim "400 Bad Request" dönüyor
→ Minimum kayıt sayısını kontrol edin (5 fatura, 10 yevmiye satırı)

### Tahmin yavaş
→ Model cache'i devre dışı olabilir; servisi yeniden başlatın

### Docker container çalışmıyor
```bash
docker-compose logs ml-service
# Sıkça: bellek yetersizliği veya port çakışması
```

## Sonraki Geliştirmeler

- [ ] LSTM ile zaman serisi tahmini (vade için)
- [ ] Multi-label sınıflama (1 satırın birden fazla hesap önerisi)
- [ ] Ensemble modeller (RF + XGBoost)
- [ ] AutoML ile hyperparameter tuning
- [ ] WebSocket ile gerçek zamanlı eğitim ilerleme
- [ ] Model versiyonlama ve rollback
