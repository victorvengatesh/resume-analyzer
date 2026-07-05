# ── Backend Dockerfile ─────────────────────────────────────────────────────
# Multi-stage build: slim final image, non-root user, health check.
FROM python:3.11-slim AS base

# System dependencies: gcc + libpq for psycopg2; libmagic for python-magic (optional)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer-cached unless requirements change)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r ./backend/requirements.txt

# Copy source
COPY backend/ ./backend/

# Create uploads directory and non-root user
RUN mkdir -p /app/uploads \
 && groupadd --gid 1001 appgroup \
 && useradd  --uid 1001 --gid appgroup --no-create-home appuser \
 && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

ENV PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Health check — hits the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--timeout-keep-alive", "30"]
