# Prometa One — ML Service (FastAPI + scikit-learn)
# Port: 8001
# Endpoint'ler: /train/*, /predict/*, /detect/*

import os
import json
import pickle
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler

# === Uygulama Ayarları ===
app = FastAPI(
    title="Prometa One ML Service",
    description="Pattern analizi ve tahmin servisi — Cari, Fatura, Bordro, Yevmiye",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model storage path
MODEL_DIR = Path(os.getenv("ML_MODEL_DIR", "./models_data"))
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# In-memory model cache
MODELS: Dict[str, Any] = {}


# =============================================================================
# PYDANTIC MODELLER
# =============================================================================

class Invoice(BaseModel):
    id: str
    party_id: Optional[str] = None
    invoice_no: Optional[str] = None
    type: str  # "in" | "out"
    date: str
    due_date: Optional[str] = None
    total: float
    net_amount: Optional[float] = 0
    vat_rate: Optional[float] = 0
    vat_amount: Optional[float] = 0
    currency: str = "TRY"
    paid_amount: Optional[float] = 0
    payments: Optional[List[Dict[str, Any]]] = []
    description: Optional[str] = ""
    cashflow_cat_id: Optional[str] = None


class TrainInvoiceRequest(BaseModel):
    tenant_id: str = Field(..., description="Şirket/tenant ID — model izolasyonu için")
    invoices: List[Invoice] = Field(..., min_items=5, description="Eğitim için en az 5 fatura")


class PredictDueDateRequest(BaseModel):
    tenant_id: str
    party_id: str
    invoice_type: str
    invoice_date: str
    amount: Optional[float] = None


class PredictAmountRequest(BaseModel):
    tenant_id: str
    party_id: str
    invoice_type: str
    invoice_date: str
    description: Optional[str] = ""


class DetectAnomalyRequest(BaseModel):
    tenant_id: str
    party_id: str
    invoice_type: str
    total: float
    vat_rate: Optional[float] = 20


class JournalLine(BaseModel):
    account_code: str
    description: str
    debit: float = 0
    credit: float = 0


class JournalEntry(BaseModel):
    id: str
    date: str
    description: Optional[str] = ""
    lines: List[JournalLine]
    status: str = "posted"


class TrainJournalRequest(BaseModel):
    tenant_id: str
    entries: List[JournalEntry] = Field(..., min_items=10)


class PredictAccountRequest(BaseModel):
    tenant_id: str
    description: str
    top_k: int = 3


class PayrollHistory(BaseModel):
    employee_id: str
    period: str  # "YYYY-MM"
    gross_salary: float
    net_salary: float
    overtime: Optional[float] = 0
    pay_items_count: Optional[int] = 0


class DetectPayrollAnomalyRequest(BaseModel):
    tenant_id: str
    employee_id: str
    current: PayrollHistory
    history: List[PayrollHistory]


# =============================================================================
# YARDIMCI FONKSİYONLAR
# =============================================================================

def get_model_path(tenant_id: str, model_name: str) -> Path:
    """Tenant bazlı model dosya yolu."""
    safe_tenant = "".join(c for c in tenant_id if c.isalnum() or c in "-_")
    return MODEL_DIR / f"{safe_tenant}_{model_name}.pkl"


def save_model(tenant_id: str, model_name: str, model_obj: Any):
    """Model'i diske kaydet."""
    path = get_model_path(tenant_id, model_name)
    with open(path, "wb") as f:
        pickle.dump(model_obj, f)
    MODELS[f"{tenant_id}_{model_name}"] = model_obj


def load_model(tenant_id: str, model_name: str) -> Optional[Any]:
    """Model'i yükle (cache veya disk)."""
    cache_key = f"{tenant_id}_{model_name}"
    if cache_key in MODELS:
        return MODELS[cache_key]
    path = get_model_path(tenant_id, model_name)
    if path.exists():
        with open(path, "rb") as f:
            model = pickle.load(f)
        MODELS[cache_key] = model
        return model
    return None


def days_between(date1: str, date2: str) -> Optional[int]:
    """İki tarih arası gün farkı."""
    try:
        d1 = datetime.strptime(date1, "%Y-%m-%d")
        d2 = datetime.strptime(date2, "%Y-%m-%d")
        return (d2 - d1).days
    except Exception:
        return None


# =============================================================================
# ENDPOINT: STATUS / HEALTH
# =============================================================================

@app.get("/")
def root():
    return {
        "service": "Prometa One ML Service",
        "version": "1.0.0",
        "endpoints": [
            "POST /train/cari-pattern",
            "POST /train/journal-classifier",
            "POST /predict/due-date",
            "POST /predict/amount",
            "POST /predict/account",
            "POST /detect/anomaly",
            "POST /detect/payroll-anomaly",
            "GET  /models/{tenant_id}",
            "DELETE /models/{tenant_id}",
        ],
    }


@app.get("/health")
def health():
    return {"status": "ok", "models_cached": len(MODELS)}


@app.get("/models/{tenant_id}")
def list_models(tenant_id: str):
    """Bir tenant'a ait tüm modelleri listele."""
    safe_tenant = "".join(c for c in tenant_id if c.isalnum() or c in "-_")
    files = list(MODEL_DIR.glob(f"{safe_tenant}_*.pkl"))
    models = []
    for f in files:
        models.append({
            "name": f.stem.replace(f"{safe_tenant}_", ""),
            "size_bytes": f.stat().st_size,
            "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
        })
    return {"tenant_id": tenant_id, "models": models}


@app.delete("/models/{tenant_id}")
def delete_models(tenant_id: str):
    """Bir tenant'ın tüm modellerini sil."""
    safe_tenant = "".join(c for c in tenant_id if c.isalnum() or c in "-_")
    files = list(MODEL_DIR.glob(f"{safe_tenant}_*.pkl"))
    count = 0
    for f in files:
        f.unlink()
        count += 1
        MODELS.pop(f.stem, None)
    return {"deleted": count}


# =============================================================================
# ENDPOINT: CARI PATTERN EĞİTİMİ
# =============================================================================

@app.post("/train/cari-pattern")
def train_cari_pattern(req: TrainInvoiceRequest):
    """
    Cari faturalardan pattern öğren:
    - Vade süresi tahmini
    - Tutar dağılımı (anomali tespit için)
    - Sezonsallık
    """
    df = pd.DataFrame([inv.dict() for inv in req.invoices])
    if df.empty or len(df) < 5:
        raise HTTPException(400, "En az 5 fatura gerekli")

    # === 1. Vade tahmini modeli (Random Forest) ===
    df["date_dt"] = pd.to_datetime(df["date"], errors="coerce")
    df["due_date_dt"] = pd.to_datetime(df["due_date"], errors="coerce")
    df["due_days"] = (df["due_date_dt"] - df["date_dt"]).dt.days
    df_due = df.dropna(subset=["due_days"])
    df_due = df_due[(df_due["due_days"] >= 0) & (df_due["due_days"] <= 365)]

    due_models = {}
    for party_id, group in df_due.groupby("party_id"):
        if len(group) < 3 or pd.isna(party_id):
            continue
        # Features: amount, month, day_of_week, vat_rate
        group = group.copy()
        group["month"] = group["date_dt"].dt.month
        group["dayofweek"] = group["date_dt"].dt.dayofweek
        X = group[["total", "month", "dayofweek", "vat_rate"]].fillna(0).values
        y = group["due_days"].values
        if len(np.unique(y)) == 1:
            # Tek bir değer varsa → constant model
            due_models[party_id] = {
                "type": "constant",
                "value": int(y[0]),
                "samples": len(group),
            }
        else:
            model = RandomForestRegressor(n_estimators=20, max_depth=5, random_state=42)
            model.fit(X, y)
            due_models[party_id] = {
                "type": "rf",
                "model": model,
                "median": float(np.median(y)),
                "samples": len(group),
            }

    # === 2. Tutar dağılımı ve anomali eşikleri ===
    amount_stats = {}
    for party_id, group in df.groupby("party_id"):
        if pd.isna(party_id) or len(group) < 3:
            continue
        amounts = group["total"].values
        amount_stats[party_id] = {
            "mean": float(np.mean(amounts)),
            "median": float(np.median(amounts)),
            "std": float(np.std(amounts)),
            "min": float(np.min(amounts)),
            "max": float(np.max(amounts)),
            "p25": float(np.percentile(amounts, 25)),
            "p75": float(np.percentile(amounts, 75)),
            "samples": len(group),
        }
        # Isolation Forest (anomali tespit) — sadece yeterli veri varsa
        if len(amounts) >= 10:
            iso = IsolationForest(contamination=0.1, random_state=42)
            iso.fit(amounts.reshape(-1, 1))
            amount_stats[party_id]["isolation_forest"] = iso

    # === 3. Sezonsallık ===
    seasonality = {}
    for party_id, group in df.groupby("party_id"):
        if pd.isna(party_id) or len(group) < 4:
            continue
        group = group.copy()
        group["month"] = group["date_dt"].dt.month
        group["quarter"] = group["date_dt"].dt.quarter
        quarter_totals = group.groupby("quarter")["total"].sum().to_dict()
        month_totals = group.groupby("month")["total"].sum().to_dict()
        seasonality[party_id] = {
            "quarter_totals": {int(k): float(v) for k, v in quarter_totals.items()},
            "month_totals": {int(k): float(v) for k, v in month_totals.items()},
            "samples": len(group),
        }

    # Model paketi
    model_pkg = {
        "trained_at": datetime.utcnow().isoformat(),
        "sample_count": len(df),
        "party_count": df["party_id"].nunique(),
        "due_models": due_models,
        "amount_stats": amount_stats,
        "seasonality": seasonality,
    }
    save_model(req.tenant_id, "cari_pattern", model_pkg)

    return {
        "status": "trained",
        "sample_count": len(df),
        "party_count": df["party_id"].nunique(),
        "due_models_trained": len(due_models),
        "anomaly_detectors": sum(1 for s in amount_stats.values() if "isolation_forest" in s),
    }


# =============================================================================
# ENDPOINT: VADE TAHMİNİ
# =============================================================================

@app.post("/predict/due-date")
def predict_due_date(req: PredictDueDateRequest):
    """Cari için vade tarihi tahmin et."""
    model_pkg = load_model(req.tenant_id, "cari_pattern")
    if not model_pkg:
        raise HTTPException(404, "Model not trained yet. Call /train/cari-pattern first.")

    due_models = model_pkg.get("due_models", {})
    party_model = due_models.get(req.party_id)

    if not party_model:
        # Genel ortalama dön
        return {
            "predicted_days": 30,
            "confidence": "low",
            "method": "default",
            "message": "No history for this party, using default 30 days",
        }

    try:
        date_dt = pd.to_datetime(req.invoice_date)
        if party_model["type"] == "constant":
            return {
                "predicted_days": party_model["value"],
                "confidence": "high" if party_model["samples"] >= 5 else "medium",
                "method": "constant",
                "samples_used": party_model["samples"],
            }
        # RF model
        features = np.array([[
            req.amount or 0,
            date_dt.month,
            date_dt.dayofweek,
            20,  # default vat
        ]])
        predicted = float(party_model["model"].predict(features)[0])
        # Sınırla 0-180 arası
        predicted = max(0, min(180, predicted))
        confidence = "high" if party_model["samples"] >= 10 else "medium"
        return {
            "predicted_days": int(round(predicted)),
            "confidence": confidence,
            "method": "random_forest",
            "samples_used": party_model["samples"],
            "median_fallback": party_model["median"],
        }
    except Exception as e:
        return {
            "predicted_days": int(party_model.get("median", 30)),
            "confidence": "low",
            "method": "fallback_median",
            "error": str(e),
        }


# =============================================================================
# ENDPOINT: TUTAR TAHMİNİ
# =============================================================================

@app.post("/predict/amount")
def predict_amount(req: PredictAmountRequest):
    """Cari için beklenen tutar aralığı."""
    model_pkg = load_model(req.tenant_id, "cari_pattern")
    if not model_pkg:
        raise HTTPException(404, "Model not trained yet.")

    stats = model_pkg.get("amount_stats", {}).get(req.party_id)
    if not stats:
        return {
            "predicted_amount": None,
            "confidence": "none",
            "message": "No amount history for this party",
        }

    return {
        "predicted_amount": stats["median"],
        "mean": stats["mean"],
        "std": stats["std"],
        "expected_range": {
            "low": stats["p25"],
            "high": stats["p75"],
        },
        "absolute_range": {
            "min": stats["min"],
            "max": stats["max"],
        },
        "confidence": "high" if stats["samples"] >= 10 else "medium" if stats["samples"] >= 5 else "low",
        "samples_used": stats["samples"],
    }


# =============================================================================
# ENDPOINT: ANOMALI TESPİT
# =============================================================================

@app.post("/detect/anomaly")
def detect_anomaly(req: DetectAnomalyRequest):
    """
    Fatura tutarı için anomali tespit.
    Iki yöntem:
    1. Isolation Forest (eğer eğitilmişse)
    2. Z-score (mean ± 2*std)
    """
    model_pkg = load_model(req.tenant_id, "cari_pattern")
    if not model_pkg:
        return {"is_anomaly": False, "method": "no_model"}

    stats = model_pkg.get("amount_stats", {}).get(req.party_id)
    if not stats:
        return {"is_anomaly": False, "method": "no_party_history"}

    result = {
        "is_anomaly": False,
        "score": 0.0,
        "method": "z_score",
        "samples_used": stats["samples"],
        "reference": {
            "mean": stats["mean"],
            "median": stats["median"],
            "std": stats["std"],
            "p25": stats["p25"],
            "p75": stats["p75"],
        },
    }

    # Isolation Forest varsa onu kullan
    if "isolation_forest" in stats:
        iso = stats["isolation_forest"]
        pred = iso.predict([[req.total]])
        score = iso.score_samples([[req.total]])
        result["is_anomaly"] = bool(pred[0] == -1)
        result["score"] = float(score[0])
        result["method"] = "isolation_forest"
    else:
        # Z-score fallback
        if stats["std"] > 0:
            z = abs(req.total - stats["mean"]) / stats["std"]
            result["score"] = float(z)
            result["is_anomaly"] = bool(z > 2.5)
            result["z_score"] = float(z)

    # Severity sınıfı
    if result["is_anomaly"]:
        if req.total > stats["mean"] * 2:
            result["severity"] = "high"
            result["direction"] = "above"
        elif req.total < stats["mean"] * 0.3:
            result["severity"] = "high"
            result["direction"] = "below"
        else:
            result["severity"] = "medium"
            result["direction"] = "above" if req.total > stats["mean"] else "below"

    return result


# =============================================================================
# ENDPOINT: YEVMİYE HESAP KODU SINIFLAYICI
# =============================================================================

@app.post("/train/journal-classifier")
def train_journal_classifier(req: TrainJournalRequest):
    """
    Yevmiye satırı açıklamalarından hesap kodu sınıflama.
    TF-IDF + cosine similarity.
    """
    # Veriyi düzleştir
    rows = []
    for entry in req.entries:
        if entry.status != "posted":
            continue
        for line in entry.lines:
            if not line.description or not line.account_code:
                continue
            rows.append({
                "description": line.description.lower().strip(),
                "account_code": line.account_code,
            })

    df = pd.DataFrame(rows)
    if len(df) < 10:
        raise HTTPException(400, "En az 10 satır gerekli")

    # TF-IDF vektörleştirici
    vectorizer = TfidfVectorizer(
        max_features=500,
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.95,
    )
    try:
        X = vectorizer.fit_transform(df["description"].values)
    except Exception as e:
        raise HTTPException(400, f"TF-IDF failed: {e}")

    model_pkg = {
        "trained_at": datetime.utcnow().isoformat(),
        "sample_count": len(df),
        "vectorizer": vectorizer,
        "tfidf_matrix": X,
        "descriptions": df["description"].tolist(),
        "account_codes": df["account_code"].tolist(),
        "unique_accounts": df["account_code"].nunique(),
    }
    save_model(req.tenant_id, "journal_classifier", model_pkg)

    return {
        "status": "trained",
        "sample_count": len(df),
        "unique_accounts": int(df["account_code"].nunique()),
        "vocabulary_size": len(vectorizer.vocabulary_),
    }


@app.post("/predict/account")
def predict_account(req: PredictAccountRequest):
    """Yevmiye satırı açıklamasından hesap kodu öner (top-K)."""
    model_pkg = load_model(req.tenant_id, "journal_classifier")
    if not model_pkg:
        raise HTTPException(404, "Journal classifier not trained.")

    vectorizer = model_pkg["vectorizer"]
    tfidf_matrix = model_pkg["tfidf_matrix"]
    descriptions = model_pkg["descriptions"]
    account_codes = model_pkg["account_codes"]

    desc = req.description.lower().strip()
    if not desc:
        return {"suggestions": []}

    try:
        query_vec = vectorizer.transform([desc])
        similarities = cosine_similarity(query_vec, tfidf_matrix).flatten()

        # En benzer top-K (kümülatif score)
        account_scores = {}
        for i, sim in enumerate(similarities):
            if sim < 0.15:  # Çok düşükse atla
                continue
            code = account_codes[i]
            if code not in account_scores:
                account_scores[code] = {"score": 0, "count": 0, "matched_descs": []}
            account_scores[code]["score"] += sim
            account_scores[code]["count"] += 1
            if len(account_scores[code]["matched_descs"]) < 2:
                account_scores[code]["matched_descs"].append(descriptions[i])

        # Sırala ve top-K dön
        sorted_codes = sorted(
            account_scores.items(),
            key=lambda x: x[1]["score"],
            reverse=True,
        )[: req.top_k]

        suggestions = []
        max_score = sorted_codes[0][1]["score"] if sorted_codes else 1
        for code, info in sorted_codes:
            confidence = min(99, int(round((info["score"] / max_score) * 100)))
            suggestions.append({
                "account_code": code,
                "confidence": confidence,
                "matched_samples": info["count"],
                "example_descriptions": info["matched_descs"][:2],
            })

        return {"suggestions": suggestions, "query": req.description}
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {e}")


# =============================================================================
# ENDPOINT: BORDRO ANOMALİ TESPİT
# =============================================================================

@app.post("/detect/payroll-anomaly")
def detect_payroll_anomaly(req: DetectPayrollAnomalyRequest):
    """
    Bordro anomali tespit:
    - Brüt maaş, net maaş, mesai için Z-score
    - Trend kırılması
    """
    if len(req.history) < 3:
        return {
            "anomalies": [],
            "message": "Insufficient history (min 3 periods needed)",
        }

    history_df = pd.DataFrame([h.dict() for h in req.history])
    current = req.current

    anomalies = []

    # 1. Brüt maaş anomali
    gross_values = history_df["gross_salary"].values
    if len(gross_values) >= 3 and np.std(gross_values) > 0:
        z = (current.gross_salary - np.mean(gross_values)) / np.std(gross_values)
        if abs(z) > 2.0:
            anomalies.append({
                "type": "gross_salary",
                "severity": "high" if abs(z) > 3 else "medium",
                "z_score": float(z),
                "current_value": current.gross_salary,
                "mean": float(np.mean(gross_values)),
                "std": float(np.std(gross_values)),
                "direction": "above" if z > 0 else "below",
                "message": f"Brüt maaş ortalamadan {abs(z):.1f}σ "
                            f"{'yüksek' if z > 0 else 'düşük'} "
                            f"({current.gross_salary:.0f} vs ort. {np.mean(gross_values):.0f})",
            })

    # 2. Net maaş anomali
    net_values = history_df["net_salary"].values
    if len(net_values) >= 3 and np.std(net_values) > 0:
        z = (current.net_salary - np.mean(net_values)) / np.std(net_values)
        if abs(z) > 2.0:
            anomalies.append({
                "type": "net_salary",
                "severity": "high" if abs(z) > 3 else "medium",
                "z_score": float(z),
                "current_value": current.net_salary,
                "mean": float(np.mean(net_values)),
                "direction": "above" if z > 0 else "below",
                "message": f"Net maaş anomali (z={z:.1f})",
            })

    # 3. Mesai anomali (varsa)
    overtime_values = history_df["overtime"].fillna(0).values
    if len(overtime_values) >= 3 and np.mean(overtime_values) > 0:
        if current.overtime > np.mean(overtime_values) * 3:
            anomalies.append({
                "type": "overtime",
                "severity": "medium",
                "current_value": current.overtime,
                "mean": float(np.mean(overtime_values)),
                "ratio": float(current.overtime / max(1, np.mean(overtime_values))),
                "message": f"Mesai olağandan {current.overtime / max(1, np.mean(overtime_values)):.1f}× yüksek",
            })

    # 4. Trend kırılması (son 3 ay → mevcut)
    if len(net_values) >= 4:
        recent_3 = net_values[-3:]
        recent_avg = np.mean(recent_3)
        if recent_avg > 0:
            change_pct = ((current.net_salary - recent_avg) / recent_avg) * 100
            if abs(change_pct) > 25:
                anomalies.append({
                    "type": "trend_break",
                    "severity": "high" if abs(change_pct) > 50 else "medium",
                    "change_pct": float(change_pct),
                    "recent_avg": float(recent_avg),
                    "current_value": current.net_salary,
                    "message": f"Son trend'den %{change_pct:+.0f} değişim",
                })

    return {
        "employee_id": req.employee_id,
        "anomalies": anomalies,
        "history_size": len(history_df),
    }


# =============================================================================
# ENDPOINT: BATCH TAHMİN (cariler için bir anda)
# =============================================================================

class BatchPredictRequest(BaseModel):
    tenant_id: str
    party_ids: List[str]
    invoice_type: str = "out"


@app.post("/predict/batch-cari-summary")
def batch_cari_summary(req: BatchPredictRequest):
    """Birden fazla cari için özet tahminler."""
    model_pkg = load_model(req.tenant_id, "cari_pattern")
    if not model_pkg:
        return {"summaries": [], "message": "Model not trained"}

    summaries = []
    for pid in req.party_ids:
        stats = model_pkg.get("amount_stats", {}).get(pid)
        due = model_pkg.get("due_models", {}).get(pid)
        seasonality = model_pkg.get("seasonality", {}).get(pid)

        if not stats:
            continue

        summary = {
            "party_id": pid,
            "expected_amount": stats["median"],
            "amount_range": {"low": stats["p25"], "high": stats["p75"]},
            "samples": stats["samples"],
        }
        if due:
            summary["expected_due_days"] = due.get("value") if due["type"] == "constant" else int(due.get("median", 30))
        if seasonality:
            peak_q = max(seasonality["quarter_totals"].items(), key=lambda x: x[1])
            summary["peak_quarter"] = f"Q{peak_q[0]}"
        summaries.append(summary)

    return {"summaries": summaries, "count": len(summaries)}


# =============================================================================
# PROJE ÖNERİSİ (Fatura → Proje Eşleştirme)
# =============================================================================

class ProjectSuggestionRequest(BaseModel):
    """Fatura bilgisinden proje önerisi isteği"""
    invoice_description: str = ""
    invoice_partyId: Optional[str] = None
    invoice_amount: float = 0.0
    invoice_date: Optional[str] = None
    invoice_dealId: Optional[str] = None
    projects: List[Dict[str, Any]]  # tüm projeler
    historical_invoices: List[Dict[str, Any]] = []  # geçmiş faturalar (projectId'leri olan)
    deals: List[Dict[str, Any]] = []  # CRM deal'leri


class ProjectSuggestion(BaseModel):
    projectId: str
    project_code: str
    project_name: str
    score: float
    confidence: str  # high | medium | low
    reasons: List[str]


@app.post("/v1/suggest-project")
def suggest_project_for_invoice(req: ProjectSuggestionRequest):
    """
    Fatura bilgisinden uygun proje öner.

    Mantık:
    1. TF-IDF benzerlik — fatura açıklaması ile proje adı/açıklaması
    2. Aynı cariden geçmiş projelere bağlı faturalar (frekans)
    3. Tutar aralığı eşleşmesi
    4. Tarih yakınlığı (proje aktif tarih aralığında)
    5. Deal bağlı proje
    """
    description = (req.invoice_description or "").lower()
    party_id = req.invoice_partyId
    amount = float(req.invoice_amount or 0)
    inv_date = req.invoice_date

    scores: Dict[str, Dict] = {}

    def add_score(pid: str, points: float, reason: str):
        if not pid:
            return
        if pid not in scores:
            scores[pid] = {"score": 0.0, "reasons": []}
        scores[pid]["score"] += points
        scores[pid]["reasons"].append(reason)

    # === 1. TF-IDF benzerlik ===
    project_texts = []
    project_ids = []
    for p in req.projects:
        if not p.get("id"):
            continue
        text = f"{p.get('code', '')} {p.get('name', '')} {p.get('description', '')}".strip().lower()
        if text:
            project_texts.append(text)
            project_ids.append(p["id"])

    if description and len(description) > 5 and len(project_texts) > 0:
        try:
            vectorizer = TfidfVectorizer(
                max_features=200,
                ngram_range=(1, 2),
                min_df=1,
            )
            tfidf_matrix = vectorizer.fit_transform([description] + project_texts)
            similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
            for idx, sim in enumerate(similarities):
                if sim > 0.1:  # Minimum eşik
                    pid = project_ids[idx]
                    add_score(pid, sim * 60, f"metin benzerliği ({sim*100:.0f}%)")
        except Exception:
            pass  # TF-IDF başarısızsa skip

    # === 2. Proje kodu açıklamada geçiyorsa ===
    for p in req.projects:
        code = (p.get("code") or "").lower()
        if code and code in description:
            add_score(p["id"], 80, "proje kodu açıklamada")

    # === 3. Cari Geçmişi ===
    if party_id:
        from collections import Counter
        party_projects = Counter()
        party_amounts: Dict[str, List[float]] = {}

        for inv in req.historical_invoices:
            if inv.get("partyId") == party_id and inv.get("projectId"):
                pid = inv["projectId"]
                party_projects[pid] += 1
                if pid not in party_amounts:
                    party_amounts[pid] = []
                party_amounts[pid].append(float(inv.get("total", 0)))

        for pid, freq in party_projects.items():
            add_score(pid, 30 + freq * 5, f"cari geçmişi ({freq}x)")

            # Tutar aralığı
            if amount > 0 and pid in party_amounts:
                amounts = party_amounts[pid]
                if amounts:
                    avg = sum(amounts) / len(amounts)
                    if abs(avg - amount) / max(avg, amount) < 0.3:
                        add_score(pid, 20, "benzer tutar")

    # === 4. Deal'den ===
    if req.invoice_dealId:
        for d in req.deals:
            if d.get("id") == req.invoice_dealId:
                if d.get("linkedProjectId"):
                    add_score(d["linkedProjectId"], 60, "deal'den")
                if d.get("partyId"):
                    for p in req.projects:
                        if p.get("customerId") == d["partyId"] and p.get("status") == "active":
                            add_score(p["id"], 25, "müşterinin aktif projesi")

    # === 5. Müşterinin aktif projeleri ===
    if party_id:
        customer_active = [p for p in req.projects
                          if p.get("customerId") == party_id and p.get("status") == "active"]
        if len(customer_active) == 1:
            add_score(customer_active[0]["id"], 40, "müşterinin tek aktif projesi")
        elif len(customer_active) > 1:
            for p in customer_active:
                add_score(p["id"], 10, "müşteriye ait aktif proje")

    # === 6. Aktif tarih aralığında ===
    if inv_date:
        for p in req.projects:
            if (p.get("startDate") and inv_date >= p["startDate"] and
                (not p.get("deadline") or inv_date <= p["deadline"])):
                if p.get("status") == "active":
                    add_score(p["id"], 15, "proje süresi içinde")

    # === Sonuçları topla ===
    project_map = {p["id"]: p for p in req.projects}
    suggestions = []

    for pid, data in scores.items():
        p = project_map.get(pid)
        if not p:
            continue
        score = data["score"]
        confidence = "high" if score >= 80 else ("medium" if score >= 40 else "low")
        suggestions.append({
            "projectId": pid,
            "project_code": p.get("code", ""),
            "project_name": p.get("name", ""),
            "score": round(score, 1),
            "confidence": confidence,
            "reasons": data["reasons"][:3],  # Top 3 reason
        })

    suggestions.sort(key=lambda x: -x["score"])

    return {
        "suggestions": suggestions[:5],
        "method": "tfidf_hybrid",
        "model": "Prometa Project Matcher v1.0",
    }


# =============================================================================
# AI FEEDBACK ENDPOINT — Kullanıcı geri bildirimini kaydet
# =============================================================================

FEEDBACK_LOG_PATH = MODEL_DIR / "feedback.jsonl"
FEEDBACK_STATS_PATH = MODEL_DIR / "feedback_stats.json"


class FeedbackEntry(BaseModel):
    """Frontend'den gelen AI feedback kaydı"""
    id: str
    type: str                              # "project_match" | "category_match" vb.
    suggestionData: Dict[str, Any] = {}
    userAction: str                        # "accepted" | "rejected" | "modified"
    accepted: bool
    rejectedFor: Optional[str] = None
    userId: Optional[str] = None
    createdAt: Optional[str] = None


@app.post("/v1/feedback")
def record_feedback(entry: FeedbackEntry):
    """
    Kullanıcı geri bildirimini kaydeder ve özet istatistiği günceller.
    Bu veri ileride model retraining için kullanılabilir.
    """
    try:
        # JSONL formatında append (her satır bir feedback)
        with open(FEEDBACK_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry.dict(), ensure_ascii=False) + "\n")

        # Hızlı istatistik güncelle (in-memory + diske)
        stats = _load_feedback_stats()
        ftype = entry.type
        if ftype not in stats:
            stats[ftype] = {"total": 0, "accepted": 0, "rejected": 0, "modified": 0}
        stats[ftype]["total"] += 1
        if entry.accepted:
            stats[ftype]["accepted"] += 1
        else:
            stats[ftype]["rejected"] += 1
        if entry.userAction == "modified":
            stats[ftype]["modified"] += 1

        _save_feedback_stats(stats)

        return {
            "status": "recorded",
            "feedback_id": entry.id,
            "current_stats": stats.get(ftype, {}),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record feedback: {str(e)}")


@app.get("/v1/feedback/stats")
def get_feedback_stats():
    """Tüm feedback'lerin özet istatistiğini döndürür."""
    stats = _load_feedback_stats()

    # Accuracy hesapla
    result = {}
    for ftype, st in stats.items():
        total = st.get("total", 0)
        accepted = st.get("accepted", 0)
        result[ftype] = {
            **st,
            "accuracy": round((accepted / total) * 100, 2) if total > 0 else 0,
        }

    return {
        "by_type": result,
        "total_feedback": sum(s.get("total", 0) for s in stats.values()),
        "avg_accuracy": (
            round(sum(r["accuracy"] for r in result.values()) / len(result), 2)
            if result else 0
        ),
    }


@app.get("/v1/feedback/recent")
def get_recent_feedback(limit: int = 50, type: Optional[str] = None):
    """Son N feedback kaydını döndürür (debug/inceleme için)."""
    if not FEEDBACK_LOG_PATH.exists():
        return {"feedback": [], "count": 0}

    entries = []
    try:
        with open(FEEDBACK_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if type and entry.get("type") != type:
                        continue
                    entries.append(entry)
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Son N
    entries = entries[-limit:]
    return {"feedback": entries, "count": len(entries)}


def _load_feedback_stats() -> Dict[str, Dict]:
    if FEEDBACK_STATS_PATH.exists():
        try:
            with open(FEEDBACK_STATS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_feedback_stats(stats: Dict[str, Dict]):
    try:
        with open(FEEDBACK_STATS_PATH, "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[FEEDBACK] Failed to save stats: {e}")


# =============================================================================
# KREDİ BELGESİ AYRIŞTIRMA (kural tabanlı — harici AI yok)
# PDF (pdfplumber) / Excel (pandas+openpyxl/xlrd) -> metin -> regex/anahtar kelime
# =============================================================================

import base64 as _base64
import io as _io
import re as _re

# Türkiye'deki yaygın bankalar (kanonik ad -> eşleşme kalıpları, küçük harf)
_BANKS = [
    ("Ziraat Bankası", ["ziraat"]),
    ("Türkiye İş Bankası", ["iş bankası", "is bankasi", "türkiye iş", "isbank"]),
    ("Garanti BBVA", ["garanti"]),
    ("Yapı Kredi", ["yapı kredi", "yapi kredi", "yapıkredi", "yapikredi"]),
    ("Akbank", ["akbank"]),
    ("Halkbank", ["halkbank", "halk bankası", "halk bankasi"]),
    ("VakıfBank", ["vakıfbank", "vakifbank", "vakıflar bankası", "vakiflar bankasi"]),
    ("QNB Finansbank", ["qnb", "finansbank"]),
    ("DenizBank", ["denizbank", "deniz bank"]),
    ("Türk Ekonomi Bankası (TEB)", ["teb", "türk ekonomi", "turk ekonomi"]),
    ("ING", ["ing bank", "ing "]),
    ("HSBC", ["hsbc"]),
    ("Şekerbank", ["şekerbank", "sekerbank"]),
    ("Albaraka Türk", ["albaraka"]),
    ("Kuveyt Türk", ["kuveyt türk", "kuveyt turk", "kuveytturk"]),
    ("Türkiye Finans", ["türkiye finans", "turkiye finans"]),
    ("Anadolubank", ["anadolubank", "anadolu bank"]),
    ("Fibabanka", ["fibabanka", "fiba banka"]),
    ("Odeabank", ["odeabank", "odea bank"]),
    ("Burgan Bank", ["burgan"]),
    ("ICBC Turkey", ["icbc"]),
]

_LOAN_TYPES = {"installment", "spot", "bch", "kmh", "rotatif"}
_CURRENCIES = {"TRY", "USD", "EUR"}


class ParseLoanDocRequest(BaseModel):
    fileName: str = Field(..., description="Dosya adı (uzantı tip tespiti için)")
    mimeType: Optional[str] = Field(None, description="MIME tipi (opsiyonel ipucu)")
    contentBase64: str = Field(..., description="Dosyanın base64 içeriği")


def _detect_loan_format(file_name: str, mime: Optional[str], raw: bytes) -> str:
    name = (file_name or "").lower()
    if name.endswith(".pdf") or (mime == "application/pdf"):
        return "pdf"
    if raw[:5] == b"%PDF-":
        return "pdf"
    if name.endswith(".xlsx") or name.endswith(".xls"):
        return "excel"
    if mime and ("spreadsheet" in mime or "excel" in mime):
        return "excel"
    if raw[:2] == b"PK":  # xlsx = zip
        return "excel"
    if raw[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":  # eski .xls (OLE2)
        return "excel"
    return "unknown"


def _extract_pdf_text(raw: bytes) -> str:
    import pdfplumber
    parts = []
    with pdfplumber.open(_io.BytesIO(raw)) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def _extract_excel_text(raw: bytes, file_name: str) -> str:
    engine = "xlrd" if file_name.lower().endswith(".xls") else "openpyxl"
    sheets = pd.read_excel(_io.BytesIO(raw), sheet_name=None, header=None, dtype=str, engine=engine)
    lines = []
    for sheet_name, df in sheets.items():
        lines.append(f"### Sayfa: {sheet_name}")
        for _, row in df.iterrows():
            cells = ["" if pd.isna(c) else str(c) for c in row.tolist()]
            line = "\t".join(cells).rstrip()
            if line.strip():
                lines.append(line)
    return "\n".join(lines)


def _parse_tr_number(s: str) -> Optional[float]:
    if s is None:
        return None
    t = _re.sub(r"[^\d.,-]", "", str(s))
    if t in ("", "-", ".", ","):
        return None
    has_dot, has_comma = "." in t, "," in t
    if has_dot and has_comma:
        # Son görünen ayraç ondalıktır
        if t.rfind(",") > t.rfind("."):
            t = t.replace(".", "").replace(",", ".")  # 1.500.000,50
        else:
            t = t.replace(",", "")                     # 1,500,000.50
    elif has_comma:
        # Sadece virgül -> ondalık varsay
        t = t.replace(",", ".")
    # sadece nokta -> binlik mi ondalık mı? "1.234" binlik kabul, "1.5" ondalık
    elif has_dot:
        parts = t.split(".")
        if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
            t = t.replace(".", "")
    try:
        return float(t)
    except ValueError:
        return None


def _norm_date(s: str) -> Optional[str]:
    if not s:
        return None
    s = s.strip()
    m = _re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", s)
    if m:
        y, mo, d = m.group(1), int(m.group(2)), int(m.group(3))
        return f"{y}-{mo:02d}-{d:02d}"
    m = _re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        if len(y) == 2:
            y = "20" + y
        if 1 <= d <= 31 and 1 <= mo <= 12:
            return f"{y}-{mo:02d}-{d:02d}"
    return None


_DATE_RE = r"(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"
_NUM_RE = r"([\d.,]+)"


# Türkçe karakterleri ASCII'ye katlar (1:1, indeks korunur) — böylece hem
# "Başlangıç" hem aksanı sıyrılmış "Baslangic" aynı kalıpla yakalanır.
_TR_FOLD_MAP = str.maketrans({
    "İ": "i", "I": "i", "ı": "i",
    "Ş": "s", "ş": "s", "Ğ": "g", "ğ": "g",
    "Ç": "c", "ç": "c", "Ö": "o", "ö": "o", "Ü": "u", "ü": "u",
})


def _fold(s: str) -> str:
    """Küçük harf + Türkçe->ASCII katlama. Karakter sayısı korunur (1:1)."""
    return s.translate(_TR_FOLD_MAP).lower()


def _first(text: str, patterns) -> Optional[str]:
    for p in patterns:
        m = _re.search(p, text)
        if m:
            return m.group(1).strip()
    return None


def _extract_loan_fields(text: str) -> Dict[str, Any]:
    # Tüm eşleme aksandan bağımsız olsun diye metni katla; sayı/tarih/kod
    # değerleri ASCII olduğundan grup indeksleri/değerleri değişmez.
    low = _fold(text)

    # Banka
    bank_name = None
    for canonical, keys in _BANKS:
        if any(_fold(k) in low for k in keys):
            bank_name = canonical
            break

    # Kredi türü
    loan_type = None
    if _re.search(r"rotatif", low):
        loan_type = "rotatif"
    elif _re.search(r"kredili\s*mevduat|\bkmh\b|ek\s*hesap|arti\s*para", low):
        loan_type = "kmh"
    elif _re.search(r"borclu\s*cari|\bbch\b", low):
        loan_type = "bch"
    elif _re.search(r"\bspot\b", low):
        loan_type = "spot"
    elif _re.search(r"taksitli|esit\s*taksit|taksit\s*sayi", low):
        loan_type = "installment"

    # Para birimi
    currency = None
    if _re.search(r"(usd|abd\s*dolari|amerikan\s*dolari|\$)", low):
        currency = "USD"
    elif _re.search(r"(eur|euro|avro|€)", low):
        currency = "EUR"
    elif _re.search(r"(try|\btl\b|₺|turk\s*lirasi)", low):
        currency = "TRY"

    # Anapara / tutar / limit
    principal = _parse_tr_number(_first(low, [
        r"kredi\s*tutari\s*[:\-]?\s*" + _NUM_RE,
        r"anapara\s*[:\-]?\s*" + _NUM_RE,
        r"kredi\s*limiti?\s*[:\-]?\s*" + _NUM_RE,
        r"tahsis\s*(?:edilen\s*)?tutari?\s*[:\-]?\s*" + _NUM_RE,
        r"kullandirilan\s*tutar\s*[:\-]?\s*" + _NUM_RE,
        r"kredi\s*miktari\s*[:\-]?\s*" + _NUM_RE,
        r"toplam\s*kredi\s*[:\-]?\s*" + _NUM_RE,
    ]))

    # Faiz oranı (yıllık ondalık) — aylıksa 12 ile çarp
    rate_ctx = _first(low, [
        r"(yillik\s*faiz[^\d]{0,20}" + _NUM_RE + r")",
        r"(akdi\s*faiz[^\d]{0,20}" + _NUM_RE + r")",
        r"(aylik\s*faiz[^\d]{0,20}" + _NUM_RE + r")",
        r"(faiz\s*orani[^\d]{0,20}" + _NUM_RE + r")",
    ])
    interest_rate = None
    if rate_ctx:
        mnum = _re.search(_NUM_RE, rate_ctx)
        val = _parse_tr_number(mnum.group(1)) if mnum else None
        if val is not None:
            # yüzde sayısı -> ondalık (4,5 -> 0.045); zaten <1 ise olduğu gibi
            rate = val / 100.0 if val >= 1 else val
            if _re.search(r"aylik", rate_ctx):
                rate *= 12
            interest_rate = round(rate, 6)

    # Vade (ay)
    term_months = None
    mterm = _re.search(r"(vade|taksit\s*sayisi|geri\s*odeme\s*suresi|kredi\s*vadesi)\s*[:\-]?\s*(\d{1,3})\s*(ay|taksit|yil)?", low)
    if mterm:
        n = int(mterm.group(2))
        unit = mterm.group(3) or ""
        term_months = n * 12 if unit.startswith("y") else n

    # Sözleşme / kredi no (değer ASCII; katlanmış metinden alınır)
    contract_no = _first(low, [
        r"sozlesme\s*(?:no|numarasi)\s*[:\-]?\s*([a-z0-9][a-z0-9\-\/]{2,})",
        r"kredi\s*(?:no|numarasi)\s*[:\-]?\s*([a-z0-9][a-z0-9\-\/]{2,})",
        r"referans\s*(?:no|numarasi)\s*[:\-]?\s*([a-z0-9][a-z0-9\-\/]{2,})",
        r"dosya\s*(?:no|numarasi)\s*[:\-]?\s*([a-z0-9][a-z0-9\-\/]{2,})",
    ])
    if contract_no:
        contract_no = contract_no.upper()

    # Kullandırım / başlangıç tarihi
    disb = _first(low, [
        r"kullandirim\s*tarihi\s*[:\-]?\s*" + _DATE_RE,
        r"vade\s*baslangici\s*[:\-]?\s*" + _DATE_RE,
        r"baslangic\s*tarihi\s*[:\-]?\s*" + _DATE_RE,
        r"kredi\s*tarihi\s*[:\-]?\s*" + _DATE_RE,
        r"duzenleme\s*tarihi\s*[:\-]?\s*" + _DATE_RE,
    ])
    disbursement_date = _norm_date(disb) if disb else None

    # Ödeme günü
    payment_day = None
    mpd = _re.search(r"(odeme\s*gunu|taksit\s*gunu)\s*[:\-]?\s*(\d{1,2})", low)
    if mpd:
        payment_day = max(1, min(28, int(mpd.group(2))))
    elif disbursement_date:
        try:
            payment_day = max(1, min(28, int(disbursement_date.split("-")[2])))
        except (ValueError, IndexError):
            payment_day = None

    # BSMV / KKDF (varsa)
    def _rate_after(label):
        m = _re.search(label + r"[^\d]{0,15}" + _NUM_RE, low)
        if m:
            v = _parse_tr_number(m.group(1))
            if v is not None:
                return round(v / 100.0 if v >= 1 else v, 6)
        return None
    bsmv_rate = _rate_after(r"bsmv")
    kkdf_rate = _rate_after(r"kkdf")

    # Ad (türetilmiş) — banka varsa kullanıcı kolaylığı için
    name = None
    if bank_name:
        type_label = {
            "installment": "Taksitli Kredi", "spot": "Spot Kredi",
            "bch": "BCH", "kmh": "KMH", "rotatif": "Rotatif Kredi",
        }.get(loan_type, "Kredi")
        name = f"{bank_name} {type_label}"

    return {
        "type": loan_type if loan_type in _LOAN_TYPES else None,
        "name": name,
        "contractNo": contract_no,
        "bankName": bank_name,
        "principal": principal,
        "currency": currency if currency in _CURRENCIES else None,
        "interestRate": interest_rate,
        "bsmvRate": bsmv_rate,
        "kkdfRate": kkdf_rate,
        "disbursementDate": disbursement_date,
        "termMonths": term_months,
        "paymentDay": payment_day,
        "note": None,
    }


@app.post("/parse/loan-document")
def parse_loan_document(req: ParseLoanDocRequest):
    """Kredi belgesinden (PDF/Excel) kural tabanlı kredi alanı çıkarımı (harici AI yok)."""
    try:
        raw = _base64.b64decode(req.contentBase64)
    except Exception:
        raise HTTPException(400, "Geçersiz base64 içerik")

    fmt = _detect_loan_format(req.fileName, req.mimeType, raw)
    if fmt == "unknown":
        raise HTTPException(415, f"Desteklenmeyen belge tipi: {req.fileName} (yalnızca PDF, XLSX, XLS)")

    try:
        text = _extract_pdf_text(raw) if fmt == "pdf" else _extract_excel_text(raw, req.fileName)
    except Exception as e:
        raise HTTPException(422, f"Belge okunamadı: {e}")

    if not text or not text.strip():
        raise HTTPException(
            422,
            "Belgeden metin çıkarılamadı (taranmış/görüntü PDF olabilir). "
            "Metin tabanlı PDF veya Excel deneyin ya da alanları elle girin.",
        )

    fields = _extract_loan_fields(text)
    filled = [k for k, v in fields.items() if v is not None]
    return {
        "fields": fields,
        "filledFields": filled,
        "format": fmt,
        "inputTokens": None,
        "outputTokens": None,
    }


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
