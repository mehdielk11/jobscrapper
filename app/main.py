"""Main entry point for the Job Recommender Streamlit app."""

import sys
from pathlib import Path

# Ensure project root is on sys.path for absolute imports
_ROOT = str(Path(__file__).resolve().parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import streamlit as st  # noqa: E402

from app.auth import render_auth_ui  # noqa: E402

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
    st.caption(
        "Moroccan job market intelligence powered by NLP and AI."
    )
    jobs = get_all_jobs()
    jobs_with_skills = [j for j in jobs if j.get("skills")]
    c1, c2, c3 = st.columns(3)
    c1.metric("Total Jobs Scraped", len(jobs))
    c2.metric("Skills Extracted", len(jobs_with_skills))
    c3.metric("Platforms", 6)
    st.info(
        "👈 Go to **Profile** to enter your skills, "
        "then check **Recommendations**."
    )

elif page == "👤 Profile":
    from app.pages.profile import render

    render()

elif page == "⭐ Recommendations":
    from app.pages.recommendations import render

    render()

elif page == "⚙️ Admin":
    from app.pages.admin import render

    render()
