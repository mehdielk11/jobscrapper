# 📄 PROJECT RULES — Antigravity AI IDE
# PRD: Job Offers Analyzer & Student Recommender (MVP)

> **Version:** 1.0  
> **Date:** April 2026  
> **Status:** MVP — Ready for Development  
> **Stakeholders:** Data Science student groups (peer clients)  
> **Presentation deadline:** 30 March (Product Backlog + Feature Demo)

---

## 🧠 PROJECT OVERVIEW

### Vision
Build a **data science web application** that automatically scrapes and analyzes job offers from Moroccan job platforms, extracts required skills using NLP, and recommends the most relevant job offers to students based on their own skill profile.

### Problem Statement
Students in Morocco struggle to identify which job offers match their current skill set. Job listings are scattered across multiple platforms (LinkedIn, Indeed, ReKrute, EmploiDiali, Emploi-public.ma, MarocAnnonces), and manually cross-referencing them is time-consuming and inefficient.

### Solution
An intelligent pipeline that:
1. **Scrapes** job offers from Moroccan job portals
2. **Extracts** skills and requirements via NLP
3. **Profiles** students based on their declared skills or uploaded CV
4. **Recommends** matching job offers with a match score

---

## 🎯 MVP SCOPE

The MVP focuses on a **working end-to-end pipeline** covering scraping → extraction → recommendation, delivered as a simple web interface.

> ⚠️ Antigravity must only build features listed under MVP scope. Post-MVP features are documented for future sprints.

---

## 📦 PRODUCT BACKLOG (Prioritized — MoSCoW)

### 🔴 MUST HAVE — Sprint 1 (Core MVP)

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| F-01 | **Job Scraper Module** | Scrape job offers from at least 2 sources: ReKrute + EmploiDiali (or static dataset fallback). Each job entry must include: title, company, location, description, date, source URL. | P0 |
| F-02 | **Skills Extraction Engine** | Use NLP (spaCy or KeyBERT) to extract required skills/keywords from job descriptions. Build a normalized skills taxonomy (e.g., "Python", "Machine Learning", "SQL", "Communication"). | P0 |
| F-03 | **Student Skill Profile Input** | Simple form UI where a student enters their name and selects/types their skills (multi-select tags). Data stored in a local JSON or SQLite DB. | P0 |
| F-04 | **Recommendation Engine** | Match student skill profile to job offers using cosine similarity or TF-IDF vector comparison. Return top-N ranked offers with a match percentage score. | P0 |
| F-05 | **Results Dashboard** | Display recommended jobs in a clean card-based UI: job title, company, match score (%), required skills, source link. | P0 |

---

### 🟠 SHOULD HAVE — Sprint 2

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| F-06 | **Multi-source Scraper** | Extend scraping to LinkedIn (public), Indeed Morocco, and MarocAnnonces. Handle pagination and anti-scraping measures gracefully. | P1 |
| F-07 | **Skill Gap Analysis** | Show students which skills they are missing for each recommended job. Highlight missing vs matched skills per offer. | P1 |
| F-08 | **Job Offer Search & Filter** | Allow users to filter jobs by city, sector, experience level, and keywords independent of recommendations. | P1 |
| F-09 | **CV Upload & Parsing** | Accept PDF CVs, extract skills automatically using NLP, and pre-fill the student skill profile. | P1 |

---

### 🟡 COULD HAVE — Sprint 3

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| F-10 | **Job Offer Detail Page** | Full page view of a job offer with all extracted metadata, skills cloud, and original source link. | P2 |
| F-11 | **Skills Trend Dashboard** | Aggregate stats on most demanded skills across all scraped offers (bar charts, word clouds). | P2 |
| F-12 | **User Authentication** | Simple login/register so multiple students can have persistent profiles. | P2 |
| F-13 | **Email Alerts** | Notify students by email when new matching offers are detected. | P2 |

---

### ⚪ WON'T HAVE (Post-MVP)

| ID | Feature |
|----|---------|
| F-14 | AI-generated cover letter per job offer |
| F-15 | Employer-facing portal |
| F-16 | Mobile app |
| F-17 | Real-time scraping (cron-based pipeline only for MVP) |

---

## 🗂️ FUNCTIONAL SPECIFICATIONS

### F-01 — Job Scraper Module
```
INPUT:  Target URLs / platform names
OUTPUT: Structured job list [{title, company, location, description, date, url, source}]

RULES:
- Use requests + BeautifulSoup or Scrapy
- If scraping is blocked, fallback to a pre-built static dataset (CSV/JSON with 100+ real offers)
- Deduplicate entries by URL
- Store results in SQLite or local JSON file
- Log scraping errors without crashing the pipeline

TARGET SOURCES (MVP):
  - ReKrute.com (primary)
  - EmploiDiali.ma (primary)
  - Emploi-public.ma (secondary)
  - LinkedIn Morocco (optional, use static dataset if blocked)
```

### F-02 — Skills Extraction Engine
```
INPUT:  Raw job description text
OUTPUT: List of normalized skills tags (e.g., ["Python", "SQL", "Agile", "NLP"])

RULES:
- Use KeyBERT or spaCy with a custom skills vocabulary
- Build a reference skills dictionary covering:
    * Technical: Python, R, SQL, Power BI, Tableau, TensorFlow, etc.
    * Soft skills: Communication, Teamwork, Leadership, etc.
    * Domain: Finance, Marketing, Data Analysis, etc.
- Normalize synonyms (e.g., "ML" → "Machine Learning")
- Store extracted skills per job in DB
```

### F-03 — Student Skill Profile Input
```
INPUT:  Student name + skills list (typed or selected)
OUTPUT: Student profile stored in DB {name, skills: [], created_at}

UI RULES:
- Tag-based multi-select input with autocomplete from the skills taxonomy
- Free-text input allowed for unlisted skills
- Profile saved locally (no auth required for MVP)
- Pre-filled if CV is uploaded (F-09, Sprint 2)
```

### F-04 — Recommendation Engine
```
INPUT:  Student skill vector + all job skill vectors
OUTPUT: Ranked list of top-10 jobs [{job_id, title, company, match_score, matched_skills, missing_skills}]

ALGORITHM (MVP):
  1. Represent each job and student as a binary skill vector
  2. Compute cosine similarity between student vector and each job vector
  3. Sort by similarity score descending
  4. Return top 10 with match percentage

OPTIONAL UPGRADE:
  - TF-IDF weighted vectors
  - Sentence-transformers (SBERT) for semantic matching
```

### F-05 — Results Dashboard
```
DISPLAY RULES:
- Cards layout (responsive grid)
- Each card shows:
    * Job title & company name
    * Location & date posted
    * Match score badge (e.g., 87% match) — color coded (green/orange/red)
    * Matched skills (green tags)
    * Missing skills (red/grey tags) — Sprint 2
    * "View Offer" button → original URL
- Sort options: by match score, by date
- Empty state message if no profile set
```

---

## 🏗️ TECHNICAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (MVP)                    │
│         Streamlit  OR  Flask + HTML/CSS/JS           │
│  Pages: Home | Profile Setup | Recommendations       │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                   BACKEND / API                      │
│              Python (Flask or FastAPI)               │
│  Routes: /scrape | /extract | /profile | /recommend  │
└─────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   SCRAPER    │  │  NLP ENGINE  │  │  RECOMMENDER │
│  BeautifulS. │  │  KeyBERT /   │  │  Cosine Sim  │
│  + Scrapy    │  │  spaCy       │  │  Sklearn     │
└──────────────┘  └──────────────┘  └──────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                  DATA STORAGE (MVP)                  │
│         SQLite DB  OR  JSON flat files               │
│  Tables: jobs | skills | students | recommendations  │
└─────────────────────────────────────────────────────┘
```

### Tech Stack (MVP)
| Layer | Technology |
|-------|-----------|
| Language | Python 3.11 (Backend), TypeScript (Frontend) |
| Web Framework | React (Vite) + shadcn/ui |
| Backend API | FastAPI + Uvicorn |
| Scraping | BeautifulSoup4 + Requests + Scrapy (optional) |
| NLP | spaCy, KeyBERT, sentence-transformers |
| ML / Similarity | scikit-learn (TF-IDF, cosine_similarity) |
| Database | Supabase (PostgreSQL with SQLAlchemy/supabase-py) |
| Data Handling | Pandas |
| Visualization | Plotly or Recharts (Frontend) |
| Version Control | Git + GitHub |

---

## 📁 PROJECT FILE STRUCTURE

```
job-recommender/
│
├── app/                        # Main application
│   ├── main.py                 # Entry point (Streamlit or Flask)
│   ├── pages/
│   │   ├── home.py
│   │   ├── profile.py
│   │   └── recommendations.py
│   └── components/
│       └── job_card.py
│
├── scraper/                    # Scraping module
│   ├── base_scraper.py
│   ├── rekrute_scraper.py
│   ├── emploidiali_scraper.py
│   └── static_dataset/
│       └── jobs_sample.json    # Fallback dataset (100+ offers)
│
├── nlp/                        # NLP & skills extraction
│   ├── skills_extractor.py
│   ├── skills_taxonomy.json    # Reference skill dictionary
│   └── normalizer.py
│
├── recommender/                # Recommendation logic
│   ├── vectorizer.py
│   ├── similarity.py
│   └── ranker.py
│
├── database/                   # DB layer
│   ├── models.py
│   ├── db_manager.py
│   └── jobs.db
│
├── tests/                      # Unit tests
│   ├── test_scraper.py
│   ├── test_nlp.py
│   └── test_recommender.py
│
├── data/                       # Raw & processed data
│   ├── raw_jobs.json
│   └── processed_jobs.json
│
├── requirements.txt
├── README.md
└── .env                        # API keys / config (gitignored)
```

---

## 🚀 DEVELOPMENT GUIDELINES FOR ANTIGRAVITY

### Code Style Rules
- Use **Python type hints** on all functions
- Write **docstrings** for every module and function
- Functions must be **pure** where possible (no hidden side effects)
- Maximum function length: **50 lines**
- Use **environment variables** for any URLs, API keys, or config values (`.env` + `python-dotenv`)

### Error Handling Rules
- Scraper must **never crash** the app — use try/except with graceful fallback to static dataset
- NLP pipeline must handle **empty or malformed** descriptions
- Recommendation engine must handle the case where student has **no skills yet** (show onboarding message)

### Data Rules
- All job entries must have at minimum: `title`, `company`, `description`, `url`, `source`
- Skills must be **normalized** before storage (lowercase, deduplicated)
- Do not store personally identifiable information beyond student name and skills

### UI/UX Rules
- Use a **sidebar** for navigation (Streamlit)
- Show **loading spinners** during scraping and NLP processing
- Every recommendation card must clearly show the **match percentage**
- Use **color coding**: green (>70% match), orange (40–70%), red (<40%)
- Mobile-responsive layout

---

## 📊 DATA MODEL

### Table: `jobs`
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER PK | Auto-increment |
| title | TEXT | Job title |
| company | TEXT | Company name |
| location | TEXT | City / region |
| description | TEXT | Full job description |
| source | TEXT | Platform name |
| url | TEXT UNIQUE | Original offer URL |
| scraped_at | DATETIME | Scraping timestamp |

### Table: `job_skills`
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER PK | |
| job_id | FK → jobs.id | |
| skill | TEXT | Normalized skill name |

### Table: `students`
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER PK | |
| name | TEXT | Student name |
| created_at | DATETIME | |

### Table: `student_skills`
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER PK | |
| student_id | FK → students.id | |
| skill | TEXT | Normalized skill name |

---

## ✅ ACCEPTANCE CRITERIA (MVP DONE WHEN)

- [ ] At least **50 real job offers** are scraped and stored from Moroccan platforms
- [ ] Skills are extracted from **100% of scraped jobs** (no null skills field)
- [ ] A student can **input their skills** and see ranked recommendations in < 3 seconds
- [ ] Top-10 recommended jobs are displayed with **match percentage**
- [ ] The app runs locally with a single command (`streamlit run app/main.py`)
- [ ] A fallback static dataset exists so the app works **without internet**
- [ ] Unit tests pass for scraper, NLP, and recommender modules
- [ ] A README explains how to install, run, and use the project

---

## 📅 SPRINT PLAN

| Sprint | Duration | Goals |
|--------|----------|-------|
| Sprint 0 | Day 1 | Project setup, repo, static dataset, DB schema |
| Sprint 1 | Days 2–5 | F-01 + F-02 + F-03 (Scraper + NLP + Profile) |
| Sprint 2 | Days 6–8 | F-04 + F-05 (Recommender + Dashboard) |
| Sprint 3 | Days 9–10 | Testing, bug fixes, README, demo prep |
| Demo | Day 11 | Present to peer groups (stakeholders) |

---

## 🗣️ PRESENTATION CHECKLIST (30 March)

For the **Product Backlog presentation** to peer groups:

- [ ] Present the **problem statement** clearly (1 slide)
- [ ] Show the **prioritized backlog** (this document)
- [ ] Live demo or mockup of the **student profile input + recommendations UI**
- [ ] Explain the **tech choices** (why spaCy, why cosine similarity)
- [ ] Show a sample of **scraped data** from Moroccan platforms
- [ ] Demonstrate **skill extraction** on a real job description
- [ ] Q&A readiness: be prepared to explain the recommendation algorithm

---

*This PRD is the single source of truth for the MVP. All Antigravity-generated code must align with the specifications above. Do not implement Post-MVP features until all MVP acceptance criteria are met.*
