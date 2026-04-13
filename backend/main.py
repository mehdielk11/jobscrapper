import sys
from pathlib import Path
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

# Ensure project root is on sys.path for absolute imports
_ROOT = str(Path(__file__).resolve().parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from database.db_manager import get_all_jobs, get_student_skills, save_student_profile
from recommender.ranker import get_recommendations

app = FastAPI(title="Job Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StudentProfileRequest(BaseModel):
    user_id: str
    name: str
    skills: List[str]

@app.get("/api/jobs")
def api_get_jobs():
    jobs = get_all_jobs()
    return {"jobs": jobs}

@app.get("/api/profile/{user_id}")
def api_get_profile(user_id: str):
    skills = get_student_skills(user_id)
    return {"skills": skills}

@app.post("/api/profile")
def api_save_profile(req: StudentProfileRequest):
    result = save_student_profile(req.user_id, req.name, req.skills)
    if result:
        return {"status": "success", "id": result}
    raise HTTPException(status_code=500, detail="Failed to save profile")

@app.get("/api/recommend/{user_id}")
def api_recommend(user_id: str):
    skills = get_student_skills(user_id)
    if not skills:
         raise HTTPException(status_code=404, detail="Student profile not found or no skills set.")
    
    jobs = get_all_jobs()
    if not jobs:
        raise HTTPException(status_code=404, detail="No jobs found in the database.")
        
    recommendations = get_recommendations(skills, jobs, top_n=10)
    return {"recommendations": recommendations}

@app.get("/api/taxonomy")
def api_get_taxonomy():
    taxonomy_path = Path(_ROOT) / "nlp" / "skills_taxonomy.json"
    if taxonomy_path.exists():
        with open(taxonomy_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {"skills": data.get("skills", [])}
    return {"skills": []}
