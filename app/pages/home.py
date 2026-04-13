"""Home Page."""

import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)


import streamlit as st

from database.db_manager import get_all_jobs

def render() -> None:
    """Render the stylish home page."""
    
    st.markdown("""
        <style>
        .hero {
            padding: 40px;
            background-color: #f8fafc;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
            border: 1px solid #e2e8f0;
        }
        .hero h1 {
            color: #1e293b;
            font-size: 3rem;
            margin-bottom: 10px;
        }
        .hero p {
            color: #64748b;
            font-size: 1.2rem;
            max-width: 600px;
            margin: 0 auto;
        }
        </style>
        
        <div class="hero">
            <h1>💼 Job Offers Analyzer & Recommender</h1>
            <p>Moroccan job market intelligence powered by NLP and AI. Discover the jobs that directly match your unique skills seamlessly.</p>
        </div>
    """, unsafe_allow_html=True)

    with st.spinner("Loading market statistics..."):
        jobs = get_all_jobs()
        jobs_with_skills = [j for j in jobs if j.get("skills")]
    
    st.subheader("Market Insights", divider="gray")
    
    c1, c2, c3 = st.columns(3)
    c1.metric("Total Jobs Scraped", len(jobs), delta="Live")
    c2.metric("Skills Extracted", len(jobs_with_skills), delta="+ NLP Analyzed")
    c3.metric("Platforms", 6, delta="Moroccan Portals")
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    st.info("💡 **Ready to get started?** \n\n1. Login via the sidebar.\n2. Go to **Profile** to enter your skills.\n3. Check **Recommendations** for your targeted job matches.")
    
    st.markdown("""
        ---
        ### Supported Job Portals
        - 🌐 **ReKrute**
        - 🌐 **EmploiDiali**
        - 🌐 **Emploi-public.ma**
        - 🌐 **MarocAnnonces**
        - 🌐 **Indeed Morocco**
        - 🌐 **LinkedIn Morocco**
    """)

render()
