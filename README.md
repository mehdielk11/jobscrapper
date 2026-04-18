# Job Offers Analyzer & Recommender

> An intelligent, end-to-end pipeline that scrapes job listings, extracts required skills using NLP, and recommends matches based on user skill profiles. Focuses primarily on Moroccan job platforms.

---

## 🎯 Features

- **Automated Data Pipeline:** Headless scraping using BeautifulSoup4, Requests, and **Playwright** for dynamic rendering scenarios.
- **Extensive Source Support:** Scrape jobs directly from ReKrute, EmploiDiali, Emploi-Public, MarocAnnonces, Indeed, and LinkedIn (with offline static dataset contingencies).
- **Scheduled Cron Jobs:** Autonomous 6-hour scrape intervals managed natively by APScheduler.
- **NLP Skill Extraction:** Extracts core technical and soft skills from unstructured job descriptions via SpaCy's natural language processing.
- **Smart Recommendations:** Ranks job offers against a candidate's profile utilizing TF-IDF and Cosine Similarity through Scikit-Learn.
- **Secure Admin Dashboard:** Centralized operation command center relying on Supabase JWT verification. Features real-time status tracking for active scrapers, NLP extraction queues, and live system logs.
- **Modern UI:** Built with React, Vite, and Tailwind CSS (Deep Navy & Glassmorphism aesthetics) prioritizing data density and rapid interaction.
- **API-First Engine:** Fully typed, scalable, and responsive RESTful backend built with FastAPI.

---

## 🛠️ Tech Stack

**Backend**
- Python 3.11
- FastAPI + Uvicorn
- Requests, BeautifulSoup4, Playwright, Scrapy (Data Extraction)
- SpaCy + Scikit-Learn (NLP & Machine Learning)
- Supabase / PostgreSQL (Data persistence via SQLAlchemy)
- APScheduler (Task orchestration)
- Pytest (Testing framework)

**Frontend**
- React 19 + TypeScript
- Vite
- Tailwind CSS v4 + Framer Motion
- Shadcn UI (Radix)

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18+)
- Python 3.11+
- A [Supabase](https://supabase.com) project (for PostgreSQL database access & Auth)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/jobscrapper.git
cd jobscrapper
```

### 2. Backend Setup
Navigate to the backend directory, initialize a virtual environment, and start the FastAPI server:

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser dependencies
playwright install
```

**Environment Variables:**
Create a `.env` file in the `backend/` directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

**Run the API:**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*The API docs will be available at `http://localhost:8000/docs`.*

### 3. Frontend Setup
Open a new terminal session, navigate to the frontend directory:

```bash
cd frontend

# Install package dependencies
npm install
```

**Environment Variables:**
Create a `.env.local` file in the `frontend/` directory to communicate with the local backend and Supabase:
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Start the Development Server:**
```bash
npm run dev
```

*The UI will be available at `http://localhost:5173`.*

---

## 🧪 Testing

The backend includes a comprehensive suite of tests covering the scrape-to-recommendation pipeline. To run the tests, ensure your virtual environment is active:

```bash
cd backend
pytest tests/
```

---

## 🌐 Core API Endpoints

Once the backend is running, you can interact with the core REST endpoints:

- `GET /api/jobs`: Retrieve processed jobs from the database.
- `GET /api/user/profile/{user_id}`: Fetch user skill profiles.
- `POST /api/recommend/{user_id}`: Trigger a machine-learning recommendation calculation against current jobs.
- `POST /api/scrape/run`: Manually trigger the parallel scraper pipeline (Requires Admin Auth).
- `GET /api/scraper-runs`: Poll the status of background scraper instances (Requires Admin Auth).
- `GET /api/logs`: View recent pipeline stdout/error logs (Requires Admin Auth).
- `GET /health`: Production deployment healthcheck for container verification.

> **Tip:** For the full, interactive OpenAPI specification, navigate to `/docs` on the running backend server.

---

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
