import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from recommender.ranker import get_recommendations

student_skills = ["python", "sql", "machine learning", "pandas", "data analysis"]
jobs = [
    {
        "id": 1,
        "title": "Data Scientist",
        "company": "Tech Corp",
        "skills": ["python", "sql", "machine learning", "tensorflow", "statistics", "communication"],
        "url": "http://example.com/1",
        "source": "test"
    },
    {
        "id": 2,
        "title": "Marketing Manager",
        "company": "Marjane",
        "skills": ["marketing", "digital marketing", "seo", "communication", "leadership", "crm"],
        "url": "http://example.com/2",
        "source": "test"
    },
    {
        "id": 3,
        "title": "Backend Developer",
        "company": "Startup",
        "skills": ["python", "django", "postgresql", "docker", "agile"],
        "url": "http://example.com/3",
        "source": "test"
    }
]

print("Student skills:", student_skills)
print("\nRecommendations:")
recs = get_recommendations(student_skills, jobs, top_n=5)
for r in recs:
    print(f"- {r['title']} at {r['company']}: {r['match_score']}% (Matched: {r['matched_skills']})")
