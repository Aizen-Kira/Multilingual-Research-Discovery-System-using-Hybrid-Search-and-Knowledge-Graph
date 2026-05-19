# syntax=docker/dockerfile:1

FROM ml-base-cpu:v1

WORKDIR /app

ENV SENTENCE_TRANSFORMERS_HOME=/app/data/st_cache \
    TRANSFORMERS_CACHE=/app/data/hf_cache \
    HF_HOME=/app/data/hf_cache \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip wheel \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/logs /app/training_data /app/data/st_cache /app/data/hf_cache \
    && useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
