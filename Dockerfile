# Base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (optional, depending on scraper needs)
# Note: This increases image size significantly. 
# Only uncomment if actually using Playwright in production scrapers.
# RUN playwright install chromium --with-deps

# Pre-download the transformer model used by KeyBERT
# This prevents it from being downloaded every time the container starts.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 8000

# Start command
# We use uvicorn workers with Gunicorn for a robust production setup.
CMD gunicorn backend.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
