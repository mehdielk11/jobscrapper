"""Student Skill Profile page — creates and persists profile in Supabase."""

import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import json  # noqa: E402

import streamlit as st  # noqa: E402

from app.auth import get_current_user_id  # noqa: E402
from database.db_manager import (  # noqa: E402
    get_student_skills,
    save_student_profile,
)


def _load_taxonomy() -> list[str]:
    """Load canonical skills from the taxonomy JSON."""
    path = Path(_ROOT) / "nlp" / "skills_taxonomy.json"
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        return sorted(data.get("skills", []))
    return []


def render() -> None:
    """Render the student profile creation / update page."""
    st.title("👤 Student Skill Profile")
    st.caption(
        "Create or update your skill profile to get personalized "
        "job recommendations."
    )

    user_id = get_current_user_id()
    if not user_id:
        st.warning(
            "⚠️ Please login or create an account using the sidebar "
            "to save your profile."
        )
        st.stop()

    taxonomy = _load_taxonomy()

    # Pre-fill from saved profile
    existing_skills = get_student_skills(user_id)

    with st.container(border=True):
        st.subheader("Your Information")
        name = st.text_input("Full Name", placeholder="e.g. Mehdi")

        st.subheader("Your Skills")
        st.caption(
            "Select from the predefined list or add your own custom "
            "skills below."
        )

        selected_standard = st.multiselect(
            "Select Standard Skills",
            options=taxonomy,
            default=[s for s in existing_skills if s in taxonomy],
            placeholder="Choose your skills...",
        )

        custom_input = st.text_input(
            "Add Custom Skills",
            placeholder="e.g. FastAPI, OpenCV (comma separated)",
            value=", ".join(
                [s for s in existing_skills if s not in taxonomy]
            ),
        )

        if st.button("💾 Save Profile", type="primary"):
            if not name.strip():
                st.error("Please enter your name.")
                st.stop()

            custom_skills = [
                s.strip()
                for s in custom_input.split(",")
                if s.strip()
            ]
            all_skills = list(set(selected_standard + custom_skills))

            student_id = save_student_profile(
                user_id, name.strip(), all_skills
            )
            if student_id:
                st.success(
                    f"✅ Profile saved! {len(all_skills)} "
                    f"skill(s) recorded."
                )
                st.balloons()
            else:
                st.error(
                    "❌ Failed to save profile. Check your Supabase "
                    "connection."
                )
