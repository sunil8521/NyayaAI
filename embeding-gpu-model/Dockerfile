# ── Rocky Legal GPU Embedding & Reranker Service ──────────────────
# Base image: Official lightweight Python 3.12 runtime with CUDA support
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    HF_HOME=/app/model_cache \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

WORKDIR /app

# Install minimal system dependencies required for torch/git
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv for blazingly fast dependency installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependencies list
COPY requirements.txt ./

# Install CUDA 12.4 PyTorch and all dependencies directly into system python
RUN uv pip install --no-cache --system -r requirements.txt

# Copy application source code
COPY main.py ./

EXPOSE 8000

# Run uvicorn with 1 worker (GPU inference uses internal CUDA execution queues)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
