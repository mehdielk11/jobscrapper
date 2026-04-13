# Phase 2: Supabase Migration + Scrapers + Bug Fixes


---

## CONTEXT

The Streamlit app is running at localhost:8501 with 3 pages (main, profile, recommendations).
Screenshots confirm the UI is rendered correctly. However there are 4 critical issues to fix:

1. **No persistence** — Student profile form data is not saved anywhere (no DB connected)
2. **Recommendations broken** — Page shows "No job offers found in database" (empty state)
3. **Scrapers not functional** — Code may exist but scrapers are not implemented, connected, or verified working
4. **Local SQLite must be replaced** — Use Supabase (PostgreSQL) for all storage + user authentication

---

## TASK OVERVIEW

Perform the following in order. Do NOT skip any step.

1. Set up Supabase client and schema
2. Replace all SQLite/SQLAlchemy code with Supabase client calls
3. Add Supabase Auth for student login/register
4. Fix profile page to persist data to Supabase
5. Fix recommendations page end-to-end
6. Implement and verify all 6 scrapers
7. Add a scraper runner UI in the app

---

## STEP 1 — SUPABASE SETUP INSTRUCTIONS (read before coding)

### 1.1 Install the Supabase Python client

```bash
pip install supabase
```

Add to requirements.txt:
```
supabase==2.4.6
```

### 1.2 Environment variables

Add these to the `.env` file (the user will fill in real values from their Supabase dashboard):

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 1.3 Supabase client singleton

Create `database/supabase_client.py`:

```python
"""
Supabase client singleton for the job recommender app.
Loads credentials from .env and exposes a single client instance.
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None

def get_client() -> Client:
    """Return the singleton Supabase client. Creates it on first call."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
            raise EnvironmentError(
                "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
            )
        _client = create_client(url, key)
    return _client
```

### 1.4 Supabase SQL schema

Create `database/schema.sql` with this exact content.
The user must run this in their Supabase SQL Editor (Dashboard → SQL Editor → New Query):

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Jobs table
create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  company text not null,
  location text,
  description text,
  source text not null,
  url text unique not null,
  scraped_at timestamp with time zone default now()
);

-- Job skills table
create table if not exists job_skills (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs(id) on delete cascade,
  skill text not null
);

-- Student profiles table (linked to Supabase auth users)
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  unique(auth_user_id)
);

-- Student skills table
create table if not exists student_skills (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  skill text not null
);

-- Row Level Security (RLS)
alter table students enable row level security;
alter table student_skills enable row level security;

-- RLS Policies: students can only read/write their own data
create policy "Students can read own profile"
  on students for select using (auth.uid() = auth_user_id);

create policy "Students can insert own profile"
  on students for insert with check (auth.uid() = auth_user_id);

create policy "Students can update own profile"
  on students for update using (auth.uid() = auth_user_id);

create policy "Students can read own skills"
  on student_skills for select
  using (student_id in (select id from students where auth_user_id = auth.uid()));

create policy "Students can insert own skills"
  on student_skills for insert
  with check (student_id in (select id from students where auth_user_id = auth.uid()));

create policy "Students can delete own skills"
  on student_skills for delete
  using (student_id in (select id from students where auth_user_id = auth.uid()));

-- Jobs and job_skills are public read, service-role write (scrapers use service key)
alter table jobs enable row level security;
alter table job_skills enable row level security;

create policy "Anyone can read jobs"
  on jobs for select using (true);

create policy "Anyone can read job skills"
  on job_skills for select using (true);
```

---

## STEP 2 — DATABASE MANAGER (Supabase version)

Replace `database/db_manager.py` entirely with:

```python
"""
Database manager using Supabase client.
All DB operations go through this module — no direct SQL strings in app code.
"""
import os
import logging
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def get_service_client() -> Client:
    """
    Return a Supabase client using the SERVICE ROLE key.
    Use ONLY for scraper writes (bypasses RLS). Never expose this key in the frontend.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    return create_client(url, key)


def get_anon_client() -> Client:
    """Return the anon client for authenticated user operations."""
    from database.supabase_client import get_client
    return get_client()


# ─── JOBS ────────────────────────────────────────────────────────────────────

def save_job(job: dict) -> Optional[str]:
    """
    Upsert a single job into Supabase. Returns the job UUID or None on error.
    Uses service role key (scrapers need to bypass RLS).
    """
    try:
        client = get_service_client()
        result = (
            client.table("jobs")
            .upsert(
                {
                    "title": job["title"],
                    "company": job["company"],
                    "location": job.get("location", ""),
                    "description": job.get("description", ""),
                    "source": job["source"],
                    "url": job["url"],
                },
                on_conflict="url",
            )
            .execute()
        )
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        logger.error(f"save_job error: {e}")
    return None


def save_skills_for_job(job_id: str, skills: list[str]) -> bool:
    """Delete old skills for a job and insert the new normalized list."""
    try:
        client = get_service_client()
        client.table("job_skills").delete().eq("job_id", job_id).execute()
        if skills:
            rows = [{"job_id": job_id, "skill": s.lower().strip()} for s in skills if s.strip()]
            client.table("job_skills").insert(rows).execute()
        return True
    except Exception as e:
        logger.error(f"save_skills_for_job error: {e}")
        return False


def get_all_jobs() -> list[dict]:
    """Return all jobs with their extracted skills list."""
    try:
        client = get_anon_client()
        jobs_result = client.table("jobs").select("*, job_skills(skill)").execute()
        jobs = []
        for job in jobs_result.data:
            job["skills"] = [s["skill"] for s in job.get("job_skills", [])]
            jobs.append(job)
        return jobs
    except Exception as e:
        logger.error(f"get_all_jobs error: {e}")
        return []


def get_jobs_without_skills() -> list[dict]:
    """Return jobs that have no skills extracted yet (for NLP pipeline)."""
    try:
        client = get_service_client()
        all_jobs = client.table("jobs").select("id, description").execute().data
        jobs_with_skills_ids = {
            row["job_id"]
            for row in client.table("job_skills").select("job_id").execute().data
        }
        return [j for j in all_jobs if j["id"] not in jobs_with_skills_ids]
    except Exception as e:
        logger.error(f"get_jobs_without_skills error: {e}")
        return []


# ─── STUDENTS ────────────────────────────────────────────────────────────────

def save_student_profile(auth_user_id: str, name: str, skills: list[str]) -> Optional[str]:
    """
    Upsert student profile and replace all skills.
    Returns the student UUID or None on error.
    Requires an authenticated session — uses anon client with user JWT.
    """
    try:
        client = get_service_client()  # service key needed to bypass RLS for upsert

        # Upsert student row
        student_result = (
            client.table("students")
            .upsert({"auth_user_id": auth_user_id, "name": name}, on_conflict="auth_user_id")
            .execute()
        )
        student_id = student_result.data[0]["id"]

        # Replace skills
        client.table("student_skills").delete().eq("student_id", student_id).execute()
        if skills:
            rows = [{"student_id": student_id, "skill": s.lower().strip()} for s in skills if s.strip()]
            client.table("student_skills").insert(rows).execute()

        return student_id
    except Exception as e:
        logger.error(f"save_student_profile error: {e}")
        return None


def get_student_skills(auth_user_id: str) -> list[str]:
    """Return the skill list for a student identified by their auth user ID."""
    try:
        client = get_service_client()
        student = (
            client.table("students")
            .select("id")
            .eq("auth_user_id", auth_user_id)
            .single()
            .execute()
        )
        if not student.data:
            return []
        student_id = student.data["id"]
        skills_result = (
            client.table("student_skills")
            .select("skill")
            .eq("student_id", student_id)
            .execute()
        )
        return [row["skill"] for row in skills_result.data]
    except Exception as e:
        logger.error(f"get_student_skills error: {e}")
        return []
```

---

## STEP 3 — SUPABASE AUTH IN STREAMLIT

Create `app/auth.py`:

```python
"""
Supabase Auth helpers for Streamlit.
Manages login, register, logout, and session state.
"""
import streamlit as st
from database.supabase_client import get_client


def render_auth_ui() -> bool:
    """
    Render login/register form in the Streamlit sidebar.
    Returns True if the user is authenticated, False otherwise.
    Stores session in st.session_state["supabase_session"].
    """
    client = get_client()

    # Already authenticated
    if st.session_state.get("supabase_session"):
        user = st.session_state["supabase_session"].user
        st.sidebar.success(f"✅ Signed in as\n**{user.email}**")
        if st.sidebar.button("🚪 Sign Out"):
            client.auth.sign_out()
            del st.session_state["supabase_session"]
            st.rerun()
        return True

    st.sidebar.markdown("---")
    st.sidebar.subheader("🔐 Account")
    tab_login, tab_register = st.sidebar.tabs(["Login", "Register"])

    with tab_login:
        email = st.text_input("Email", key="login_email")
        password = st.text_input("Password", type="password", key="login_pass")
        if st.button("Login", key="btn_login"):
            try:
                session = client.auth.sign_in_with_password(
                    {"email": email, "password": password}
                )
                st.session_state["supabase_session"] = session.session
                st.rerun()
            except Exception as e:
                st.error(f"Login failed: {e}")

    with tab_register:
        email_r = st.text_input("Email", key="reg_email")
        password_r = st.text_input("Password (min 6 chars)", type="password", key="reg_pass")
        if st.button("Create Account", key="btn_register"):
            try:
                client.auth.sign_up({"email": email_r, "password": password_r})
                st.success("✅ Account created! Check your email to confirm, then login.")
            except Exception as e:
                st.error(f"Registration failed: {e}")

    return False


def get_current_user_id() -> str | None:
    """Return the current user's Supabase UUID, or None if not authenticated."""
    session = st.session_state.get("supabase_session")
    if session:
        return session.user.id
    return None
```

---

## STEP 4 — FIX `app/pages/profile.py`

Replace the entire file:

```python
"""Student Skill Profile page — creates and persists profile in Supabase."""
import json
import streamlit as st
from pathlib import Path
from app.auth import get_current_user_id
from database.db_manager import save_student_profile, get_student_skills


def _load_taxonomy() -> list[str]:
    path = Path("nlp/skills_taxonomy.json")
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        return sorted(data.get("skills", []))
    return []


def render():
    st.title("👤 Student Skill Profile")
    st.caption("Create or update your skill profile to get personalized job recommendations.")

    user_id = get_current_user_id()
    if not user_id:
        st.warning("⚠️ Please login or create an account using the sidebar to save your profile.")
        st.stop()

    taxonomy = _load_taxonomy()

    # Pre-fill from saved profile
    existing_skills = get_student_skills(user_id)

    with st.container(border=True):
        st.subheader("Your Information")
        name = st.text_input("Full Name", placeholder="e.g. Mehdi")

        st.subheader("Your Skills")
        st.caption("Select from the predefined list or add your own custom skills below.")

        selected_standard = st.multiselect(
            "Select Standard Skills",
            options=taxonomy,
            default=[s for s in existing_skills if s in taxonomy],
            placeholder="Choose your skills...",
        )

        custom_input = st.text_input(
            "Add Custom Skills",
            placeholder="e.g. FastAPI, OpenCV (comma separated)",
            value=", ".join([s for s in existing_skills if s not in taxonomy]),
        )

        if st.button("💾 Save Profile", type="primary"):
            if not name.strip():
                st.error("Please enter your name.")
                st.stop()

            custom_skills = [s.strip() for s in custom_input.split(",") if s.strip()]
            all_skills = list(set(selected_standard + custom_skills))

            student_id = save_student_profile(user_id, name.strip(), all_skills)
            if student_id:
                st.success(f"✅ Profile saved! {len(all_skills)} skill(s) recorded.")
                st.balloons()
            else:
                st.error("❌ Failed to save profile. Check your Supabase connection.")
```

---

## STEP 5 — FIX `app/pages/recommendations.py`

Replace the entire file:

```python
"""Personalized Job Recommendations page — reads from Supabase."""
import streamlit as st
from app.auth import get_current_user_id
from database.db_manager import get_all_jobs, get_student_skills
from recommender.ranker import get_recommendations


def _skill_badge(skill: str, color: str) -> str:
    return (
        f'<span style="background:{color};color:#fff;padding:2px 8px;'
        f'border-radius:12px;font-size:12px;margin:2px;display:inline-block">{skill}</span>'
    )


def _match_badge(score: float) -> str:
    if score >= 70:
        color, label = "#16a34a", f"{score:.0f}% match"
    elif score >= 40:
        color, label = "#d97706", f"{score:.0f}% match"
    else:
        color, label = "#dc2626", f"{score:.0f}% match"
    return (
        f'<span style="background:{color};color:#fff;padding:4px 12px;'
        f'border-radius:16px;font-weight:bold;font-size:14px">{label}</span>'
    )


def render():
    st.title("⭐ Personalized Job Recommendations")
    st.caption("Discover the best job matches based on your unique skill profile.")

    user_id = get_current_user_id()
    if not user_id:
        st.warning("⚠️ Please login from the sidebar to see your recommendations.")
        st.stop()

    student_skills = get_student_skills(user_id)
    if not student_skills:
        st.info("👤 You haven't set up a skill profile yet. Go to the **Profile** page first.")
        st.stop()

    with st.spinner("🔍 Finding your best job matches..."):
        jobs = get_all_jobs()

    if not jobs:
        st.warning("No job offers found in the database.")
        st.info("💡 Ask an admin to run the scrapers to populate job offers.")
        st.stop()

    with st.spinner("🧠 Computing match scores..."):
        recommendations = get_recommendations(student_skills, jobs, top_n=10)

    if not recommendations:
        st.info("No recommendations found. Try adding more skills to your profile.")
        st.stop()

    st.markdown(f"### Showing top {len(recommendations)} matches for your profile")
    st.markdown(f"Your skills: " + " ".join(_skill_badge(s, "#4f46e5") for s in student_skills), unsafe_allow_html=True)
    st.divider()

    for rec in recommendations:
        with st.container(border=True):
            col1, col2 = st.columns([4, 1])
            with col1:
                st.markdown(f"#### {rec['title']}")
                st.markdown(f"🏢 **{rec['company']}** &nbsp;|&nbsp; 📍 {rec.get('location','N/A')} &nbsp;|&nbsp; 🌐 {rec['source']}")
            with col2:
                st.markdown(_match_badge(rec["match_score"]), unsafe_allow_html=True)

            if rec.get("matched_skills"):
                matched_html = " ".join(_skill_badge(s, "#16a34a") for s in rec["matched_skills"])
                st.markdown(f"✅ **Matched:** {matched_html}", unsafe_allow_html=True)

            if rec.get("missing_skills"):
                missing_html = " ".join(_skill_badge(s, "#6b7280") for s in rec["missing_skills"][:5])
                st.markdown(f"📚 **To learn:** {missing_html}", unsafe_allow_html=True)

            st.link_button("View Offer →", rec["url"], use_container_width=False)
```

---

## STEP 6 — FIX RECOMMENDER (detach from DB, accept data as args)

Replace `recommender/ranker.py`:

```python
"""
Recommendation ranker — pure function, no DB calls.
Accepts pre-loaded data so it can be tested independently.
"""
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from recommender.vectorizer import build_skill_vector, get_all_skills


def get_recommendations(
    student_skills: list[str],
    jobs: list[dict],
    top_n: int = 10,
) -> list[dict]:
    """
    Rank jobs by cosine similarity to the student skill vector.

    Args:
        student_skills: List of normalized skill strings for the student.
        jobs: List of job dicts, each must have a 'skills' key (list[str]).
        top_n: Number of top results to return.

    Returns:
        List of job dicts with added keys: match_score, matched_skills, missing_skills.
        Sorted by match_score descending.
    """
    if not student_skills or not jobs:
        return []

    jobs_with_skills = [j for j in jobs if j.get("skills")]
    if not jobs_with_skills:
        return []

    taxonomy = get_all_skills(student_skills, jobs_with_skills)

    student_vec = build_skill_vector(student_skills, taxonomy).reshape(1, -1)
    job_vecs = np.array([
        build_skill_vector(job["skills"], taxonomy) for job in jobs_with_skills
    ])

    scores = cosine_similarity(student_vec, job_vecs)[0]

    results = []
    for job, score in zip(jobs_with_skills, scores):
        job_skill_set = set(job["skills"])
        student_set = set(student_skills)
        results.append({
            **job,
            "match_score": round(float(score) * 100, 1),
            "matched_skills": sorted(student_set & job_skill_set),
            "missing_skills": sorted(job_skill_set - student_set),
        })

    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results[:top_n]
```

Replace `recommender/vectorizer.py`:

```python
"""Skill vectorization utilities."""
import numpy as np


def get_all_skills(student_skills: list[str], jobs: list[dict]) -> list[str]:
    """Build the full unified skill vocabulary from student + all jobs."""
    all_skills: set[str] = set(student_skills)
    for job in jobs:
        all_skills.update(job.get("skills", []))
    return sorted(all_skills)


def build_skill_vector(skills: list[str], taxonomy: list[str]) -> np.ndarray:
    """Return a binary numpy vector: 1 if skill is in taxonomy, 0 otherwise."""
    skill_set = set(s.lower().strip() for s in skills)
    return np.array([1.0 if s in skill_set else 0.0 for s in taxonomy])
```

---

## STEP 7 — IMPLEMENT ALL 6 SCRAPERS

Each scraper must follow this contract:
- Function `scrape(limit: int = 50) -> list[dict]`
- Returns list of job dicts: `{title, company, location, description, source, url}`
- Wraps everything in try/except — never raises, returns empty list on full failure
- Uses `fake_useragent` for User-Agent rotation
- Respects a 1–2 second delay between requests (`time.sleep`)
- Falls back to loading `scraper/static_dataset/jobs_sample.json` if all requests fail

### 7.1 — Create `scraper/base_scraper.py`

```python
"""Base scraper with shared utilities for all scrapers."""
import time
import logging
import requests
from fake_useragent import UserAgent
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)
_ua = UserAgent()


def get_soup(url: str, delay: float = 1.5) -> BeautifulSoup | None:
    """Fetch a URL and return a BeautifulSoup object, or None on failure."""
    try:
        time.sleep(delay)
        headers = {"User-Agent": _ua.random, "Accept-Language": "fr-MA,fr;q=0.9,en;q=0.8"}
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        logger.warning(f"get_soup failed for {url}: {e}")
        return None


def load_static_fallback() -> list[dict]:
    """Load the static dataset as fallback when scraping fails."""
    import json
    from pathlib import Path
    path = Path("scraper/static_dataset/jobs_sample.json")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    logger.error("Static fallback dataset not found at scraper/static_dataset/jobs_sample.json")
    return []
```

### 7.2 — Implement `scraper/rekrute_scraper.py`

Target: `https://www.rekrute.com/offres.html`
CSS selectors to use: job listings are in `.post-id` elements.
Each listing: title in `h2 > a`, company in `.company`, location in `.location`.
Paginate via `?p=2`, `?p=3` etc.

Implement `scrape(limit=50)` following the base pattern.
On any failure call `load_static_fallback()`.

### 7.3 — Implement `scraper/emploidiali_scraper.py`

Target: `https://www.emploidiali.ma/offres-emploi`
Job cards are in `div.job-item` or `article` elements (inspect to confirm selector).
Title in `h2` or `h3`, company and location in sub-elements.
Paginate via `?page=2` query param.

### 7.4 — Implement `scraper/emploipublic_scraper.py`

Target: `https://www.emploi-public.ma/fr/concoursListe.asp`
This site lists public sector jobs (concours). Scrape: title, administation (company), deadline, link.
No JavaScript — static HTML, use BeautifulSoup.

### 7.5 — Implement `scraper/marocannonces_scraper.py`

Target: `https://www.marocannonces.com/maroc/offres-emploi-b309.html`
Listings in `div.holder` with title in `h3 > a` and metadata in `span` elements.

### 7.6 — Implement `scraper/indeed_scraper.py`

Target: `https://ma.indeed.com/jobs?q=&l=Maroc`
Indeed is JavaScript-heavy. Strategy:
1. First try direct requests + BeautifulSoup on `<div data-jk>` job cards.
2. If fewer than 5 results returned (bot protection triggered): log a warning and fall back to static dataset.
Do NOT use Selenium for MVP — just log the limitation and use fallback.

### 7.7 — Implement `scraper/linkedin_scraper.py`

Target: `https://www.linkedin.com/jobs/search/?location=Maroc`
LinkedIn blocks scrapers aggressively. Strategy:
1. Attempt requests on the public jobs page.
2. Parse `<div class="base-card">` job cards.
3. If blocked (redirect to login or CAPTCHA detected in response text): immediately fall back to static dataset and log a clear warning: "LinkedIn blocked scraping — using static dataset. For real data, consider the LinkedIn Jobs API."

### 7.8 — Create `scraper/scraper_runner.py` — orchestrates all scrapers

```python
"""
Scraper runner — runs all scrapers and saves results to Supabase.
Can be run as a script or called from the Streamlit UI.
"""
import logging
from database.db_manager import save_job

logger = logging.getLogger(__name__)

SCRAPERS = {
    "ReKrute": ("scraper.rekrute_scraper", "scrape"),
    "EmploiDiali": ("scraper.emploidiali_scraper", "scrape"),
    "EmploiPublic": ("scraper.emploipublic_scraper", "scrape"),
    "MarocAnnonces": ("scraper.marocannonces_scraper", "scrape"),
    "Indeed": ("scraper.indeed_scraper", "scrape"),
    "LinkedIn": ("scraper.linkedin_scraper", "scrape"),
}


def run_all_scrapers(limit_per_source: int = 30) -> dict[str, int]:
    """
    Run all scrapers and save results to Supabase.
    Returns a dict: {source_name: jobs_saved_count}
    """
    import importlib
    summary: dict[str, int] = {}

    for name, (module_path, func_name) in SCRAPERS.items():
        logger.info(f"Running scraper: {name}")
        try:
            module = importlib.import_module(module_path)
            scrape_fn = getattr(module, func_name)
            jobs = scrape_fn(limit=limit_per_source)
            saved = 0
            for job in jobs:
                if save_job(job):
                    saved += 1
            summary[name] = saved
            logger.info(f"{name}: {saved} jobs saved")
        except Exception as e:
            logger.error(f"{name} scraper failed: {e}")
            summary[name] = 0

    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = run_all_scrapers(limit_per_source=20)
    for source, count in results.items():
        print(f"  {source}: {count} jobs")
```

---

## STEP 8 — ADD SCRAPER ADMIN PAGE TO THE APP

Create `app/pages/admin.py`:

```python
"""Admin page — run scrapers and trigger NLP pipeline from the UI."""
import streamlit as st
from scraper.scraper_runner import run_all_scrapers
from nlp.skills_extractor import process_all_jobs
from database.db_manager import get_all_jobs


def render():
    st.title("⚙️ Admin — Data Pipeline")
    st.caption("Run scrapers and NLP extraction to populate job offers.")

    st.subheader("📊 Current Stats")
    jobs = get_all_jobs()
    jobs_with_skills = [j for j in jobs if j.get("skills")]
    col1, col2 = st.columns(2)
    col1.metric("Total Jobs in DB", len(jobs))
    col2.metric("Jobs with Skills Extracted", len(jobs_with_skills))

    st.divider()
    st.subheader("🕷️ Step 1 — Run Scrapers")
    limit = st.slider("Max jobs per source", 10, 100, 30, step=10)

    if st.button("▶️ Run All Scrapers", type="primary"):
        with st.spinner("Scraping all 6 platforms..."):
            results = run_all_scrapers(limit_per_source=limit)
        st.success("Scraping complete!")
        for source, count in results.items():
            icon = "✅" if count > 0 else "⚠️"
            st.write(f"{icon} **{source}**: {count} jobs saved")

    st.divider()
    st.subheader("🧠 Step 2 — Extract Skills (NLP)")
    if st.button("▶️ Extract Skills from All Jobs"):
        with st.spinner("Running NLP pipeline..."):
            process_all_jobs()
        st.success("Skills extraction complete! Refresh stats above.")
```

Update `app/main.py` to add this page to the sidebar navigation:
- Add `⚙️ Admin` page using `app/pages/admin.py`
- Use `st.session_state` to track current page, default to "main"
- Render `auth.render_auth_ui()` in the sidebar for login/logout

---

## STEP 9 — UPDATE `app/main.py`

Replace with a fully wired main entry point:

```python
"""Main entry point for the Job Recommender Streamlit app."""
import streamlit as st
from app.auth import render_auth_ui

st.set_page_config(
    page_title="Job Recommender Morocco",
    page_icon="💼",
    layout="wide",
)

# Auth in sidebar
render_auth_ui()

# Navigation
st.sidebar.markdown("---")
st.sidebar.subheader("Navigation")
page = st.sidebar.radio(
    "Go to",
    ["🏠 Home", "👤 Profile", "⭐ Recommendations", "⚙️ Admin"],
    label_visibility="collapsed",
)

if page == "🏠 Home":
    from database.db_manager import get_all_jobs
    st.title("💼 Job Offers Analyzer & Recommender")
    st.caption("Moroccan job market intelligence powered by NLP and AI.")
    jobs = get_all_jobs()
    jobs_with_skills = [j for j in jobs if j.get("skills")]
    c1, c2, c3 = st.columns(3)
    c1.metric("Total Jobs Scraped", len(jobs))
    c2.metric("Skills Extracted", len(jobs_with_skills))
    c3.metric("Platforms", 6)
    st.info("👈 Go to **Profile** to enter your skills, then check **Recommendations**.")

elif page == "👤 Profile":
    from app.pages.profile import render
    render()

elif page == "⭐ Recommendations":
    from app.pages.recommendations import render
    render()

elif page == "⚙️ Admin":
    from app.pages.admin import render
    render()
```

---

## STEP 10 — FINAL VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] `python -c "from supabase import create_client; print('supabase OK')"` passes
- [ ] `.env` has `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` filled in
- [ ] SQL schema has been run in Supabase SQL Editor (all 4 tables exist)
- [ ] `streamlit run app/main.py` launches without import errors
- [ ] Auth sidebar shows Login/Register tabs
- [ ] After registering + logging in, Profile page saves data (check Supabase dashboard → Table Editor → students)
- [ ] Admin page runs scrapers and shows job counts per source
- [ ] After scraping + NLP extraction, Recommendations page shows ranked job cards

---

## IMPORTANT NOTES FOR THE AGENT

1. **Do not keep any SQLite / SQLAlchemy imports** — remove all references after migration
2. **Supabase URL and keys** are placeholders — do not hardcode them anywhere; always read from `.env`
3. **LinkedIn and Indeed scrapers** will likely fall back to static dataset — this is expected behavior, log it clearly
4. **Row Level Security** is enabled — scrapers must use the SERVICE ROLE key; the frontend uses the ANON key
5. **Static dataset** at `scraper/static_dataset/jobs_sample.json` must exist with at least 20 entries as fallback — generate it if it doesn't exist
6. **Never call `st.stop()` inside a cached function** — only inside render functions
7. After completing all steps, run `pytest tests/ -v` and fix any test failures
