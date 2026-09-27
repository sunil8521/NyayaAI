# ── Stage 1: Build & Sync dependencies ─────────────────────────────
FROM python:3.11-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    HF_HOME=/app/model_cache

WORKDIR /app

# Install basic system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pull uv tool
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Sync standard dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

# Copy your application source code
COPY main.py ./

# Pre-download models natively during build layer compilation
# This prevents downloading gigabytes of models every time the server restarts
RUN uv run python -c ' \
from FlagEmbedding import BGEM3FlagModel; \
from transformers import AutoModelForSequenceClassification, AutoTokenizer; \
BGEM3FlagModel("BAAI/bge-m3", use_fp16=False); \
AutoTokenizer.from_pretrained("BAAI/bge-reranker-v2-m3"); \
AutoModelForSequenceClassification.from_pretrained("BAAI/bge-reranker-v2-m3")'

# ── Stage 2: Minimal Runtime ──────────────────────────────────────
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/app/model_cache \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Copy python environment, application framework, and weights from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/model_cache /app/model_cache
COPY --from=builder /app/main.py /app/main.py

EXPOSE 8000

# Run with single worker to keep thread execution focused on CPU cores
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
