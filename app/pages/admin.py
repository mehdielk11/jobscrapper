"""Admin page — run scrapers and trigger NLP pipeline from the UI."""

import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import streamlit as st  # noqa: E402

from database.db_manager import get_all_jobs  # noqa: E402
from nlp.skills_extractor import process_all_jobs  # noqa: E402
from scraper.scraper_runner import run_all_scrapers  # noqa: E402


def render() -> None:
    """Render the admin data pipeline page."""
    st.title("⚙️ Admin — Data Pipeline")
    st.caption(
        "Run scrapers and NLP extraction to populate job offers."
    )

    st.subheader("📊 Current Stats")
    jobs = get_all_jobs()
    jobs_with_skills = [j for j in jobs if j.get("skills")]
    col1, col2 = st.columns(2)
    col1.metric("Total Jobs in DB", len(jobs))
    col2.metric("Jobs with Skills Extracted", len(jobs_with_skills))

    st.divider()
    st.subheader("🕷️ Step 1 — Run Scrapers")
    limit = st.slider(
        "Max jobs per source", 10, 100, 30, step=10
    )

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
        st.success(
            "Skills extraction complete! Refresh stats above."
        )
