"""Personalized Job Recommendations page — reads from Supabase."""

import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import streamlit as st  # noqa: E402

from app.auth import get_current_user_id  # noqa: E402
from database.db_manager import (  # noqa: E402
    get_all_jobs,
    get_student_skills,
)
from recommender.ranker import get_recommendations  # noqa: E402


def _skill_badge(skill: str, color: str) -> str:
    """Return an HTML badge for a single skill."""
    return (
        f'<span style="background:{color};color:#fff;padding:2px 8px;'
        f'border-radius:12px;font-size:12px;margin:2px;'
        f'display:inline-block">{skill}</span>'
    )


def _match_badge(score: float) -> str:
    """Return a colored badge showing the match percentage."""
    if score >= 70:
        color = "#16a34a"
    elif score >= 40:
        color = "#d97706"
    else:
        color = "#dc2626"
    label = f"{score:.0f}% match"
    return (
        f'<span style="background:{color};color:#fff;padding:4px 12px;'
        f'border-radius:16px;font-weight:bold;font-size:14px">'
        f"{label}</span>"
    )


def render() -> None:
    """Render the recommendations page with ranked job cards."""
    st.title("⭐ Personalized Job Recommendations")
    st.caption(
        "Discover the best job matches based on your unique "
        "skill profile."
    )

    user_id = get_current_user_id()
    if not user_id:
        st.warning(
            "⚠️ Please login from the sidebar to see your "
            "recommendations."
        )
        st.stop()

    student_skills = get_student_skills(user_id)
    if not student_skills:
        st.info(
            "👤 You haven't set up a skill profile yet. "
            "Go to the **Profile** page first."
        )
        st.stop()

    with st.spinner("🔍 Finding your best job matches..."):
        jobs = get_all_jobs()

    if not jobs:
        st.warning("No job offers found in the database.")
        st.info(
            "💡 Ask an admin to run the scrapers to populate "
            "job offers."
        )
        st.stop()

    with st.spinner("🧠 Computing match scores..."):
        recommendations = get_recommendations(
            student_skills, jobs, top_n=10
        )

    if not recommendations:
        st.info(
            "No recommendations found. Try adding more skills to "
            "your profile."
        )
        st.stop()

    st.markdown(
        f"### Showing top {len(recommendations)} matches "
        f"for your profile"
    )
    skills_html = " ".join(
        _skill_badge(s, "#4f46e5") for s in student_skills
    )
    st.markdown(
        f"Your skills: {skills_html}", unsafe_allow_html=True
    )
    st.divider()

    for rec in recommendations:
        with st.container(border=True):
            col1, col2 = st.columns([4, 1])
            with col1:
                st.markdown(f"#### {rec['title']}")
                st.markdown(
                    f"🏢 **{rec['company']}** &nbsp;|&nbsp; "
                    f"📍 {rec.get('location', 'N/A')} "
                    f"&nbsp;|&nbsp; 🌐 {rec['source']}"
                )
            with col2:
                st.markdown(
                    _match_badge(rec["match_score"]),
                    unsafe_allow_html=True,
                )

            if rec.get("matched_skills"):
                matched_html = " ".join(
                    _skill_badge(s, "#16a34a")
                    for s in rec["matched_skills"]
                )
                st.markdown(
                    f"✅ **Matched:** {matched_html}",
                    unsafe_allow_html=True,
                )

            if rec.get("missing_skills"):
                missing_html = " ".join(
                    _skill_badge(s, "#6b7280")
                    for s in rec["missing_skills"][:5]
                )
                st.markdown(
                    f"📚 **To learn:** {missing_html}",
                    unsafe_allow_html=True,
                )

            st.link_button(
                "View Offer →",
                rec["url"],
                use_container_width=False,
            )
