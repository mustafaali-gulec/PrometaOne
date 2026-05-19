# Prometa One — ML Service Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Sistem bağımlılıkları (numpy/scikit-learn için)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Python bağımlılıkları
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodu
COPY main.py .

# Model dosyaları için klasör
RUN mkdir -p /app/models_data
ENV ML_MODEL_DIR=/app/models_data

# Port
EXPOSE 8001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health').read()" || exit 1

# Çalıştır
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
