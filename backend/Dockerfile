# syntax=docker/dockerfile:1
FROM python:3.11-slim

# ── System dependencies ──────────────────────────────────────────────────────
# Required by: Playwright/Chromium, lxml, spaCy, psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libnspr4 \
    && rm -rf /var/lib/apt/lists/*

# ── Working directory ────────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependencies ──────────────────────────────────────────────────────
# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Playwright: install Chromium browser binary ──────────────────────────────
RUN playwright install chromium --with-deps

# ── spaCy language models ────────────────────────────────────────────────────
RUN python -m spacy download fr_core_news_sm && \
    python -m spacy download en_core_web_sm

# ── Copy application code ────────────────────────────────────────────────────
COPY . .

# ── Runtime ──────────────────────────────────────────────────────────────────
EXPOSE 8000

# Use $PORT from Railway env, fallback to 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
