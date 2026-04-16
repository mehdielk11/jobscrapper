# 🚀 ANTIGRAVITY BUILD PROMPT — Deployment Split
## Fix 5GB Vercel Build: Separate Frontend (Vercel) + Backend (Railway)
### Use Planning Mode + Claude Sonnet model. Read the entire file before touching anything.

---

## WHY THIS IS HAPPENING

Vercel is a JavaScript/edge platform with a 500MB build limit.
The project currently tries to deploy everything together, which includes:
- `torch` + `transformers` (via sentence-transformers/KeyBERT) → ~2.5GB
- `playwright` + Chromium browser binary → ~600MB
- `spaCy` + language models → ~500MB
- `scikit-learn`, `pandas`, `numpy`, etc. → ~200MB

**Total: ~5GB. Vercel limit: 500MB. Solution: split into two deployments.**

```
React/Vite frontend  →  Vercel          (unchanged, ~50MB)
FastAPI backend      →  Railway.app     (Docker, no size limit)
```

The React app already calls FastAPI via HTTP. Only the base URL config changes.
Nothing in the business logic changes. No feature is removed.

---

## CURRENT REPO STRUCTURE (assumed)

Inspect the actual repo structure before proceeding. Adapt paths if different.

```
project-root/
├── frontend/          OR   src/ (React + Vite)
├── backend/           OR   api/ (FastAPI + scrapers + nlp)
├── scraper/
├── nlp/
├── recommender/
├── database/
├── requirements.txt
├── main.py
└── vercel.json        ← THIS IS THE PROBLEM
```

---

## STEP 1 — REORGANIZE REPO INTO TWO CLEAN ROOTS

> ⚠️ Do this with `git mv` commands to preserve history. Never use plain `mv`.

### 1.1 — Create the two root folders if they don't exist

```bash
mkdir -p frontend
mkdir -p backend
```

### 1.2 — Move Python backend files into `backend/`

Move ALL of the following into `backend/` (adapt to actual structure):

```bash
git mv main.py backend/main.py
git mv requirements.txt backend/requirements.txt
git mv scraper/ backend/scraper/
git mv nlp/ backend/nlp/
git mv recommender/ backend/recommender/
git mv database/ backend/database/
git mv .env backend/.env
```

If there is an `api/` folder for FastAPI routes:
```bash
git mv api/ backend/api/
```

### 1.3 — Move React/Vite frontend files into `frontend/`

If React files are already in a `frontend/` folder, skip this.
If they are at the root (alongside `package.json`, `vite.config.ts`, `src/`):

```bash
git mv src/ frontend/src/
git mv public/ frontend/public/
git mv package.json frontend/package.json
git mv package-lock.json frontend/package-lock.json
git mv vite.config.ts frontend/vite.config.ts
git mv tsconfig.json frontend/tsconfig.json
git mv tsconfig.app.json frontend/tsconfig.app.json
git mv index.html frontend/index.html
git mv tailwind.config.js frontend/tailwind.config.js
git mv postcss.config.js frontend/postcss.config.js
```

Move any frontend-specific config files (`eslint.config.js`, `.prettierrc`, etc.) too.

### 1.4 — Final structure after reorganization

```
project-root/
├── frontend/                ← Vercel deploys only this
│   ├── src/
│   │   ├── admin/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── contexts/
│   │   └── lib/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── .env.development      ← create this
│   └── .env.production       ← create this
│
├── backend/                 ← Railway deploys only this
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile            ← create this
│   ├── railway.json          ← create this
│   ├── .env
│   ├── scraper/
│   ├── nlp/
│   ├── recommender/
│   ├── database/
│   └── api/
│
├── .gitignore               ← stays at root
└── README.md                ← stays at root
```

---

## STEP 2 — CREATE ALL MISSING FILES

### 2.1 — `backend/Dockerfile`

Create this file exactly:

```dockerfile
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
```

### 2.2 — `backend/railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 2.3 — `frontend/vercel.json`

**Delete any existing `vercel.json` at the project root first.**
Create this one inside `frontend/`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "installCommand": "npm install",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### 2.4 — `frontend/.env.development`

```env
# Local development — points to local FastAPI server
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2.5 — `frontend/.env.production`

```env
# Production — points to Railway backend
# IMPORTANT: fill in the Railway URL after Step 4
VITE_API_URL=https://REPLACE_WITH_YOUR_RAILWAY_URL.up.railway.app
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> ⚠️ `.env.production` contains NO secrets — only the public anon key and public URL.
> The Supabase service role key stays ONLY in the backend `.env` (Railway env vars). Never in frontend.

### 2.6 — Add health check to `backend/main.py`

Find the FastAPI app instantiation in `main.py` and add this endpoint if it doesn't exist:

```python
@app.get("/health", tags=["system"])
async def health_check():
    """Railway uses this endpoint to verify the container is alive."""
    return {"status": "ok", "service": "job-recommender-api"}
```

Also ensure CORS allows the Vercel domain. Find the CORS middleware config and update it:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",          # Vite dev server
        "http://localhost:4173",          # Vite preview
        "https://*.vercel.app",           # Vercel preview deployments
        "https://REPLACE_WITH_YOUR_VERCEL_DOMAIN.vercel.app",  # production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> After deploying to Vercel, come back and replace the placeholder with the real domain.

---

## STEP 3 — REDUCE BACKEND IMAGE SIZE (Cut ~2.5GB)

The single biggest win is replacing `sentence-transformers` + `torch` with lighter alternatives.
Your pipeline uses KeyBERT + taxonomy matching. The taxonomy matching does the real work —
BERT embeddings are overkill for a skills taxonomy of ~100 terms.

### 3.1 — Audit `backend/requirements.txt`

Open the file and make these changes:

**REMOVE these lines entirely** (they pull in PyTorch, ~2.5GB total):
```
# REMOVE:
torch
torchvision
torchaudio
sentence-transformers
transformers
tokenizers
```

**REPLACE with:**
```
# Lightweight NLP — no PyTorch
keybert==0.8.5
# KeyBERT can run with a sklearn TF-IDF backend instead of transformers
scikit-learn==1.4.2
```

### 3.2 — Update `backend/nlp/skills_extractor.py`

Find where KeyBERT is initialized and change it to use the TF-IDF backend:

```python
# BEFORE (requires PyTorch + transformers):
# from keybert import KeyBERT
# kw_model = KeyBERT(model='all-MiniLM-L6-v2')

# AFTER (no PyTorch needed — uses CountVectorizer + cosine similarity):
from keybert import KeyBERT
from sklearn.feature_extraction.text import CountVectorizer

# Passing model=None or a sklearn vectorizer avoids loading any transformer model
# KeyBERT falls back to TF-IDF keyword extraction — perfectly sufficient for
# matching against a fixed skills taxonomy of ~100 terms
kw_model = KeyBERT()

# When calling extract_keywords, set vectorizer explicitly:
# keywords = kw_model.extract_keywords(
#     text,
#     vectorizer=CountVectorizer(ngram_range=(1, 2), stop_words="english"),
#     top_n=20,
# )
```

> **Why this works:** Your NLP pipeline extracts keywords then matches against
> `skills_taxonomy.json`. The matching step is what finds "Python", "SQL", etc.
> You don't need semantic embeddings — TF-IDF finds the same keywords from
> structured job descriptions. This alone removes ~2.5GB from the Docker image.

### 3.3 — Final `backend/requirements.txt` (clean version)

Replace the entire file with this optimized version:

```txt
# ── Web framework ──────────────────────────────────────────────────────────
fastapi==0.111.0
uvicorn[standard]==0.30.1
python-multipart==0.0.9

# ── Database ───────────────────────────────────────────────────────────────
supabase==2.4.6
python-dotenv==1.0.1

# ── Scraping ───────────────────────────────────────────────────────────────
playwright==1.44.0
playwright-stealth==1.0.6
requests==2.31.0
beautifulsoup4==4.12.3
lxml==5.2.1
fake-useragent==1.5.1

# ── NLP (no PyTorch) ───────────────────────────────────────────────────────
spacy==3.7.4
keybert==0.8.5
scikit-learn==1.4.2
numpy==1.26.4
pandas==2.2.2

# ── Utilities ──────────────────────────────────────────────────────────────
tqdm==4.66.4
```

**Estimated Docker image size after this change: ~800MB** (down from ~5GB).

---

## STEP 4 — UPDATE FRONTEND API CLIENT

Every place in the React app that calls the backend must use the environment variable.

### 4.1 — Create `frontend/src/lib/api.ts`

If an API client file already exists, update it. If not, create it:

```typescript
/**
 * Centralized API client.
 * Base URL switches automatically between local dev and Railway production
 * via the VITE_API_URL environment variable.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Generic fetch wrapper ─────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error ${res.status}: ${error}`);
  }

  return res.json() as Promise<T>;
}

// ── Scraper endpoints ─────────────────────────────────────────────────────

export const scraperApi = {
  runAll: (limitPerSource = 30) =>
    request<{ task_id: string }>("/api/scrape/run", {
      method: "POST",
      body: JSON.stringify({ limit_per_source: limitPerSource }),
    }),

  runOne: (source: string, limit = 30) =>
    request<{ task_id: string }>(`/api/scrape/${source}`, {
      method: "POST",
      body: JSON.stringify({ limit }),
    }),

  getStatus: () =>
    request<Record<string, { status: string; jobs_found: number; last_run: string }>>(
      "/api/scrape/status"
    ),
};

// ── Jobs endpoints ────────────────────────────────────────────────────────

export const jobsApi = {
  getAll: (page = 1, limit = 25) =>
    request<{ jobs: Job[]; total: number }>(`/api/jobs?page=${page}&limit=${limit}`),

  search: (query: string, source?: string) =>
    request<{ jobs: Job[] }>(`/api/jobs/search?q=${query}${source ? `&source=${source}` : ""}`),

  delete: (jobId: string) =>
    request<void>(`/api/jobs/${jobId}`, { method: "DELETE" }),

  rerunNlp: (jobId: string) =>
    request<void>(`/api/jobs/${jobId}/nlp`, { method: "POST" }),
};

// ── NLP endpoints ─────────────────────────────────────────────────────────

export const nlpApi = {
  processAll: () => request<{ processed: number }>("/api/nlp/process", { method: "POST" }),
};

// ── Health ────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => request<{ status: string }>("/health"),
};

// ── Types ─────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  source: string;
  url: string;
  scraped_at: string;
  skills?: string[];
}
```

### 4.2 — Find and replace all hardcoded backend URLs

Search the entire `frontend/src/` directory for any hardcoded references to `localhost:8000`
or any direct `fetch(` calls not going through the API client.

**Search pattern:** `localhost:8000` OR `http://127.0.0.1` OR `fetch("/api/`

Replace every instance with a call through `api.ts` using the correct API client method.

---

## STEP 5 — FIX `.gitignore`

Update the root `.gitignore` to cover both workspaces:

```gitignore
# ── Python backend ──────────────────────────────────────────────────────────
backend/.env
backend/__pycache__/
backend/**/__pycache__/
backend/*.pyc
backend/*.pyo
backend/venv/
backend/.venv/
backend/*.egg-info/
backend/database/*.db
backend/database/*.sqlite3
backend/.pytest_cache/

# ── Node / React frontend ───────────────────────────────────────────────────
frontend/node_modules/
frontend/dist/
frontend/.env.local
frontend/.env.*.local

# ── spaCy models (large, not committed) ────────────────────────────────────
backend/nlp/models/
*.en
*.fr

# ── Playwright ──────────────────────────────────────────────────────────────
backend/test-results/
backend/playwright-report/

# ── OS ──────────────────────────────────────────────────────────────────────
.DS_Store
Thumbs.db

# ── IDE ──────────────────────────────────────────────────────────────────────
.vscode/
.idea/
*.swp
```

---

## STEP 6 — VERIFY LOCAL SETUP STILL WORKS

Before touching any deployment platform, confirm both apps run locally.

### 6.1 — Test backend locally

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate      # Mac/Linux
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/health` — expect: `{"status": "ok"}`
Visit `http://localhost:8000/docs` — expect: FastAPI Swagger UI

### 6.2 — Test frontend locally

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` — the app should load and connect to `localhost:8000`.

### 6.3 — Test the build (catches import errors before deployment)

```bash
cd frontend
npm run build
```

This must complete with **no errors** and output `dist/` folder under 500MB.
If there are TypeScript errors, fix them before proceeding.

---

## STEP 7 — DEPLOY BACKEND TO RAILWAY

> Do this manually — Antigravity cannot log into Railway. Follow these steps exactly.

**7.1** — Go to [railway.app](https://railway.app) and sign in with GitHub.

**7.2** — Click **"New Project"** → **"Deploy from GitHub repo"**

**7.3** — Select your repository. When asked for the root directory, type: `backend`

**7.4** — Railway detects the `Dockerfile` automatically. Click **Deploy**.

**7.5** — While it builds (takes 5–10 min for first deploy), add environment variables:
- Click your service → **Variables** tab → **"Add Variable"** for each:

```
SUPABASE_URL              = your_supabase_project_url
SUPABASE_ANON_KEY         = your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY = your_supabase_service_role_key
DB_PATH                   = database/jobs.db
SCRAPING_DELAY            = 2
MAX_PAGES                 = 5
USE_STATIC_FALLBACK       = true
```

**7.6** — Once deployed, click **Settings** → **Networking** → **"Generate Domain"**.
Copy the URL — it looks like `https://your-app-name.up.railway.app`.

**7.7** — Verify: visit `https://your-app-name.up.railway.app/health`
Expect: `{"status": "ok", "service": "job-recommender-api"}`

---

## STEP 8 — DEPLOY FRONTEND TO VERCEL

> Do this manually. These are Vercel dashboard settings.

**8.1** — Go to [vercel.com](https://vercel.com) → your existing project → **Settings**

**8.2** — Under **"General"** → **"Root Directory"** → set to: `frontend`

**8.3** — Under **"Build & Development Settings"**:
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**8.4** — Under **"Environment Variables"**, add:

```
VITE_API_URL              = https://your-app-name.up.railway.app
VITE_SUPABASE_URL         = your_supabase_project_url
VITE_SUPABASE_ANON_KEY    = your_supabase_anon_key
```

> ⚠️ Only add `VITE_` prefixed variables to Vercel. Never put the service role key here.

**8.5** — Go to **Deployments** → click the three dots on the latest deployment → **"Redeploy"**

**8.6** — Wait for build to complete. Expected build size: **under 5MB**.

---

## STEP 9 — FIX CORS AFTER GETTING VERCEL URL

Once Vercel gives you the production URL (e.g. `https://your-app.vercel.app`):

Go back to `backend/main.py` and add the real Vercel domain to `allow_origins`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://*.vercel.app",
        "https://your-app.vercel.app",     # ← replace with real URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Commit, push → Railway auto-redeploys.

---

## STEP 10 — END-TO-END VERIFICATION CHECKLIST

Complete every item before considering this done:

**Backend (Railway)**
- [ ] `https://your-railway-url/health` returns `{"status": "ok"}`
- [ ] `https://your-railway-url/docs` shows FastAPI Swagger UI with all endpoints
- [ ] `POST /api/scrape/run` triggers a scraper run without 500 error
- [ ] Railway logs show no import errors on startup

**Frontend (Vercel)**
- [ ] Vercel build log shows size under 500MB (should be ~5MB)
- [ ] `https://your-app.vercel.app` loads the React UI
- [ ] Network tab in browser dev tools shows API calls going to Railway URL, not localhost
- [ ] Login/signup works (Supabase auth)
- [ ] Admin panel loads and "Run All Scrapers" button works end-to-end

**CORS**
- [ ] No `Access-Control-Allow-Origin` errors in browser console
- [ ] API calls from Vercel domain reach Railway and return 200

---

## TROUBLESHOOTING REFERENCE

| Symptom | Cause | Fix |
|---------|-------|-----|
| Railway build fails: `playwright install` timeout | Docker build timeout | Add `ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` before install step in Dockerfile |
| `spacy` model download fails in Docker | No internet in build step | Move to `RUN` step before `COPY . .` — already in Dockerfile above |
| Vercel still shows 5GB build | Old `vercel.json` at repo root still being read | Delete root-level `vercel.json` AND set Root Directory to `frontend/` in Vercel settings |
| CORS error on API call | Vercel URL not in `allow_origins` | Add exact Vercel URL to CORS config in `main.py`, redeploy Railway |
| `VITE_API_URL` is undefined in prod | Env var not added to Vercel dashboard | Add it under Project Settings → Environment Variables |
| Railway `$PORT` error | CMD uses hardcoded 8000 | Dockerfile CMD already uses `${PORT:-8000}` — check it was saved correctly |
| KeyBERT import fails after removing torch | Old cached import somewhere | Search for `SentenceTransformer` in all Python files and remove |
| `playwright install` runs but Chrome missing | `--with-deps` flag missing | Dockerfile uses `playwright install chromium --with-deps` — verify this line is present |

---

## SUMMARY OF WHAT CHANGES VS WHAT STAYS THE SAME

| Item | Change |
|------|--------|
| React component code | ❌ No change |
| Supabase schema / tables | ❌ No change |
| FastAPI route logic | ❌ No change |
| Scraper logic | ❌ No change |
| NLP pipeline logic | ✅ KeyBERT init updated (no PyTorch) |
| API base URL in React | ✅ Now reads from `VITE_API_URL` env var |
| `requirements.txt` | ✅ Removed torch/transformers |
| Deployment target for backend | ✅ Railway (was Vercel) |
| Vercel root directory | ✅ Set to `frontend/` |
| CORS config | ✅ Vercel URL added |
| New files added | ✅ `Dockerfile`, `railway.json`, `.env.development`, `.env.production`, `frontend/vercel.json` |
