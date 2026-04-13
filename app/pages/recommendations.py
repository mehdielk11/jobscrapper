import sys
import os
import streamlit as st

# Add project root to sys.path so we can import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from database.db_manager import get_all_students, get_all_jobs
from recommender.ranker import get_recommendations

st.set_page_config(page_title="Job Recommendations", page_icon="⭐", layout="wide")

st.title("⭐ Personalized Job Recommendations")
st.markdown("Discover the best job matches based on your unique skill profile.")

# 1. Check systems state
all_students = get_all_students()
all_jobs = get_all_jobs()

if not all_students:
    st.warning("No student profiles found.")
    st.info("Please navigate to the **Profile** page from the sidebar to create your profile first.")
    st.stop()

if not all_jobs:
    st.warning("No job offers found in the database.")
    st.info("The database is currently empty. Please run the ReKrute scraper to populate it.")
    st.stop()

# 2. Setup Selection
st.subheader("Select Your Profile")
student_map = {s.name: s.id for s in all_students}
selected_name = st.selectbox("Choose a student profile:", options=list(student_map.keys()))

student_id = student_map[selected_name]

if st.button("Get Recommendations", type="primary"):
    with st.spinner(f"Finding your matches, {selected_name}..."):
        try:
            recs = get_recommendations(student_id, top_n=10)
        except Exception as e:
            st.error(f"An error occurred while generating recommendations: {e}")
            st.stop()
            
    if not recs:
        st.info("We couldn't find any recommendations matching your skill profile right now. Try expanding your skills!")
    else:
        st.success(f"Found {len(recs)} highly recommended opportunities for you!")
        
        # 3. Display Cards
        for rec in recs:
            # Determine badge color based on score
            score = rec["match_score"]
            if score > 70:
                badge_bg = "#28a745"  # Green
                badge_text = "white"
            elif score >= 40:
                badge_bg = "#ffc107"  # Orange
                badge_text = "black"
            else:
                badge_bg = "#dc3545"  # Red
                badge_text = "white"
                
            badge_html = f"""
            <span style="background-color: {badge_bg}; color: {badge_text}; 
                       padding: 4px 12px; border-radius: 12px; font-weight: bold; 
                       font-size: 0.9em; float: right;">
                {score}% Match
            </span>
            """
            
            # Format skills
            matched_html = " ".join([
                f'<span style="background-color: rgba(40, 167, 69, 0.2); color: #28a745; border: 1px solid #28a745; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; margin-right: 4px; display: inline-block; margin-bottom: 4px;">{s}</span>'
                for s in rec["matched_skills"]
            ])
            
            missing_html = " ".join([
                f'<span style="background-color: rgba(108, 117, 125, 0.2); color: #6c757d; border: 1px solid #6c757d; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; margin-right: 4px; display: inline-block; margin-bottom: 4px;">{s}</span>'
                for s in rec["missing_skills"]
            ])
            
            # Render card
            with st.container(border=True):
                st.markdown(badge_html, unsafe_allow_html=True)
                st.markdown(f"#### {rec['title']}")
                st.markdown(f"**{rec['company']}**")
                st.caption(f"📍 {rec['location'] or 'Morocco'} | 🌐 {rec['source'].title()}")
                
                if matched_html:
                    st.markdown("**Your Matched Skills:**")
                    st.markdown(matched_html, unsafe_allow_html=True)
                
                if missing_html:
                    st.markdown("**Skills You Might Need:**")
                    st.markdown(missing_html, unsafe_allow_html=True)
                
                st.markdown(f'<a href="{rec["url"]}" target="_blank" style="display: inline-block; padding: 8px 16px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-top: 10px; font-weight: bold;">View Offer →</a>', unsafe_allow_html=True)
