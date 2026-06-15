<div align="center">
  <h1>🚀 JobScraper & AI Recommender</h1>
  <p><i>An intelligent, end-to-end pipeline that scrapes job listings, extracts required skills using NLP, and recommends matches based on user profiles.</i></p>

  <p>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React 19" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" /></a>
    <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-Auth_%26_DB-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" /></a>
    <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/Gemini_API-AI-4285F4?style=for-the-badge&logo=google" alt="Gemini API" /></a>
  </p>
</div>

---

## 🌟 Overview

JobScraper is a full-stack platform designed to automate the job hunting process. It continuously scrapes job boards (with a focus on the Moroccan market), utilizes Natural Language Processing (NLP) to extract core skills from unstructured text, and uses machine learning to match candidates to the perfect roles based on their unique profiles.

## ✨ Key Features

### 🧠 AI & Machine Learning
- **AI Skill Extraction:** Uses the `Gemini API` (gemini-2.0-flash-lite) to intelligently parse complex job descriptions and extract both technical and soft skills as structured JSON — no static taxonomy required.
- **Smart Recommendations:** Ranks job offers against candidate profiles using **TF-IDF** and **Cosine Similarity** (`scikit-learn`), providing an "AI Match Score".

### 🕷️ Autonomous Scraping Pipeline
- **Multi-Source Support:** Scrapes ReKrute, EmploiDiali, Emploi-Public, MarocAnnonces, Indeed, and LinkedIn.
- **Dynamic & Static Scraping:** Combines `BeautifulSoup4`, `Requests`, and `Playwright` to handle SPA and dynamically rendered websites.
- **Automated Scheduling:** 6-hour interval scraping natively managed by `APScheduler`.

### 🛡️ Security & Architecture
- **Enterprise-Grade Auth:** Powered by Supabase Auth with secure JWT validation and Role-Based Access Control (RBAC).
- **Bot Protection:** Cloudflare Turnstile CAPTCHA integration to prevent brute-force attacks.
- **Organization Workflows:** Dedicated flows for "Academic Managers" to manage student cohorts and invitations.

### 💻 Modern User Interface
- **Premium Design:** Built with React 19, Tailwind CSS v4, and Shadcn UI.
- **Framer Motion:** Fluid, native-app-like animations and micro-interactions.
- **Responsive:** Mobile-first design ensuring perfect usability on all devices.
- **Admin Command Center:** Centralized dashboard to track scraper health, manage NLP queues, and monitor live system logs.

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Shadcn UI, React Router |
| **Backend** | Python 3.11, FastAPI, Uvicorn, SQLAlchemy |
| **Data & AI** | Gemini API, Scikit-Learn, Pandas, NumPy |
| **Scraping** | BeautifulSoup4, Playwright, Requests |
| **Infra & DB** | Supabase (PostgreSQL, Auth), Cloudflare Turnstile, Vercel (Frontend), Railway (Backend) |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18+)
- Python 3.11+
- A [Supabase](https://supabase.com) project

### 1. Clone the repository
```bash
git clone https://github.com/your-username/jobscrapper.git
cd jobscrapper
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install
```

**Environment Variables (`backend/.env`):**
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
GEMINI_API_KEY=your_gemini_api_key              # Required for skill extraction
GEMINI_API_KEY_2=your_second_key_optional       # Optional: doubles extraction throughput
```

**Run the API:**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*API docs available at `http://localhost:8000/docs`.*

### 3. Frontend Setup
```bash
cd frontend
npm install
```

**Environment Variables (`frontend/.env.local`):**
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TURNSTILE_SITE_KEY=your_cloudflare_site_key # Optional
```

**Start the Development Server:**
```bash
npm run dev
```
*UI available at `http://localhost:5173`.*

---

## 🧪 Testing Architecture

The project maintains a rigorous testing standard:
- **Backend Tests:** Built with `pytest`. Covers scraper utility parsing, NLP extraction, recommendation calculations, and protected API routes.
```bash
cd backend
pytest tests/
```

---

## 🌐 Core API Architecture

The FastAPI backend exposes the following primary domains:

- **`/api/jobs`**: Job retrieval and filtering.
- **`/api/user`**: Profile management and skill synchronization.
- **`/api/recommend`**: On-the-fly ML ranking calculation.
- **`/api/scrape`**: Admin-only scraper triggers and status polling.
- **`/api/org`**: Academic institution management and invite generation.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
