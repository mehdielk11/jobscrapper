"""Main entry point for the Job Recommender Streamlit app."""

import sys
from pathlib import Path

# Ensure project root is on sys.path for absolute imports
_ROOT = str(Path(__file__).resolve().parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import streamlit as st

from app.auth import render_auth_ui, get_current_role

st.set_page_config(
    page_title="Job Recommender Morocco",
    page_icon="💼",
    layout="wide",
)

# Render auth in sidebar first
render_auth_ui()

# Define individual pages
home_page = st.Page("pages/home.py", title="Home", icon="🏠", default=True)
profile_page = st.Page("pages/profile.py", title="Profile", icon="👤")
recs_page = st.Page("pages/recommendations.py", title="Recommendations", icon="⭐")
admin_page = st.Page("pages/admin.py", title="Admin Settings", icon="⚙️")

# Build navigation dynamically based on role
role = get_current_role()

pages = {
    "Public": [home_page],
}

if role in ["user", "admin"]:
    pages["My Account"] = [profile_page, recs_page]

if role == "admin":
    pages["Administration"] = [admin_page]

# Mount the navigator
pg = st.navigation(pages)

# Run the selected page
pg.run()
