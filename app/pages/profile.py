import sys
import os
from pathlib import Path
import json
import streamlit as st

# Add project root to sys.path so we can import from database/nlp
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from database.db_manager import (
    save_student,
    get_student_by_name,
    save_student_skills,
    clear_student_skills
)

st.set_page_config(page_title="Student Profile", page_icon="👤", layout="centered")

@st.cache_data
def load_skills_taxonomy() -> list[str]:
    """Load canonical skills from taxonomy to populate multi-select."""
    taxonomy_path = Path(__file__).resolve().parent.parent.parent / "nlp" / "skills_taxonomy.json"
    try:
        with open(taxonomy_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return sorted([s.title() for s in data.get("skills", [])])
    except (FileNotFoundError, json.JSONDecodeError):
        st.error("Failed to load skills taxonomy.")
        return []

st.title("👤 Student Skill Profile")
st.markdown("Create or update your skill profile to get personalized job recommendations.")

# Load available skills for the multi-select
available_skills = load_skills_taxonomy()

# Form for profile input
with st.form("profile_form"):
    st.subheader("Your Information")
    student_name = st.text_input("Full Name", placeholder="e.g. Mehdi")
    
    st.subheader("Your Skills")
    st.markdown("Select from the predefined list or add your own custom skills below.")
    
    # Pre-select empty list
    selected_skills = st.multiselect(
        "Select Standard Skills",
        options=available_skills,
        placeholder="Choose your skills..."
    )
    
    custom_skills_input = st.text_input(
        "Add Custom Skills", 
        placeholder="e.g. FastAPI, OpenCV (comma separated)"
    )
    
    submitted = st.form_submit_button("Save Profile", type="primary")

if submitted:
    if not student_name.strip():
        st.error("Please enter your name to save your profile.")
    else:
        name_clean = student_name.strip()
        
        # Combine multi-select skills and custom input skills
        all_skills = list(selected_skills)
        if custom_skills_input.strip():
            custom_list = [s.strip() for s in custom_skills_input.split(",") if s.strip()]
            all_skills.extend(custom_list)
            
        if not all_skills:
            st.warning("You haven't selected or entered any skills! A profile with no skills won't get good recommendations.")
            
        with st.spinner(f"Saving profile for {name_clean}..."):
            # Check if student exists
            existing_student = get_student_by_name(name_clean)
            
            if existing_student:
                st.info(f"Welcome back, {name_clean}! Updating your existing profile.")
                student_id = existing_student.id
                # Reset previous skills
                clear_student_skills(student_id)
            else:
                new_student = save_student(name_clean)
                student_id = new_student.id
            
            # Save new skills
            added_count = save_student_skills(student_id, all_skills)
            
            st.success(f"✅ Profile successfully saved! Added {added_count} unique skills.")
            
            # Display summary badge style
            st.markdown("### Profile Summary")
            st.write(f"**Name:** {name_clean}")
            
            if all_skills:
                # simple badge simulation using markdown lists
                skills_md = " ".join([f"`{s}`" for s in all_skills])
                st.write(f"**Skills:** {skills_md}")
            else:
                st.write("**Skills:** None declared")
