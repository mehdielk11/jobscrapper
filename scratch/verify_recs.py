import sys
from pathlib import Path
import os

# Ensure project root is on sys.path
_ROOT = str(Path(__file__).resolve().parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from database.db_manager import get_all_jobs, get_student_skills
from recommender.ranker import get_recommendations

def test_recommendations():
    # User ID for elkhemlichi.mehdi@gmail.com (Need to find it first or use any existing student)
    # Let's just grab the first student from the DB
    from supabase import create_client
    from dotenv import load_dotenv
    load_dotenv()
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)
    
    # Auth User ID for elkhemlichi.mehdi@gmail.com
    auth_uid = "652eb914-4d7b-4ee7-a48e-4492d4c31570"
    print(f"Testing for Auth UID: {auth_uid}")
    
    skills = get_student_skills(auth_uid)
    print(f"User skills: {skills}")
    
    jobs = get_all_jobs()
    print(f"Total jobs in DB: {len(jobs)}")
    
    recs = get_recommendations(skills, jobs, top_n=5)
    print(f"\nTop 5 Recommendations:")
    for i, r in enumerate(recs):
        print(f"{i+1}. {r['title']} @ {r['company']} - Match: {r['match_score']:.2f}%")
        print(f"   Matched: {r['matched_skills']}")
        print(f"   Missing: {r['missing_skills'][:3]}...")

if __name__ == "__main__":
    test_recommendations()
