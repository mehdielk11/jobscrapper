import sys
from pathlib import Path
import json
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from apscheduler.schedulers.background import BackgroundScheduler

# Ensure project root is on sys.path for absolute imports
_ROOT = str(Path(__file__).resolve().parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from recommender.ranker import get_recommendations
from scraper.scraper_runner import run_all_scrapers, run_single_scraper
from nlp.skills_extractor import process_all_jobs
from database.db_manager import (
    get_all_jobs, 
    get_student_skills, 
    save_student_profile,
    is_admin,
    log_system_event,
    delete_auth_user
)
from database.supabase_client import get_client

app = FastAPI(title="Job Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Scheduler
scheduler = BackgroundScheduler()

def scheduled_job_scrape():
    """Background task for cron job."""
    print("CRON: Starting scheduled job scrape...")
    run_all_scrapers(limit_per_source=30)
    print("CRON: Finished scheduled job scrape.")

@app.on_event("startup")
def startup_event():
    # Schedule to run every 6 hours
    scheduler.add_job(scheduled_job_scrape, 'interval', hours=6, id="scrape_6h")
    scheduler.start()
    print("Scheduler started: Jobs will be scraped every 6 hours.")

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

class StudentProfileRequest(BaseModel):
    user_id: str
    name: Optional[str] = None
    skills: List[str]
    email: Optional[str] = None

@app.get("/api/jobs")
def api_get_jobs():
    jobs = get_all_jobs()
    return {"jobs": jobs}

@app.post("/api/scrape/run")
def api_trigger_scrape(background_tasks: BackgroundTasks):
    """Manually trigger a full scrape & extraction in the background."""
    background_tasks.add_task(run_all_scrapers, limit_per_source=20)
    return {"message": "Scraping pipeline started in the background."}

@app.post("/api/scrape/{source}")
def api_trigger_single_scrape(
    source: str, 
    background_tasks: BackgroundTasks, 
    limit: int = 30, 
    dry_run: bool = False,
    run_id: str = None
):
    """Trigger a single scraper. Note: dry_run is handled by skipping DB save in higher level if needed, 
    but currently the runner always saves. We'll return the results immediately for better UX."""
    # For simplicity in this MVP, we run single scrapers synchronously to return job counts
    # In production, this should be a background task with a status polling mechanism
    count = run_single_scraper(source, limit=limit, run_id=run_id)
    
    # Queue the heavy NLP processing in the background
    background_tasks.add_task(process_all_jobs)
    
    return {"source": source, "jobs_found": count, "status": "success"}

@app.get("/api/profile/{user_id}")
def api_get_profile(user_id: str):
    skills = get_student_skills(user_id)
    return {"skills": skills}

@app.post("/api/profile")
def api_save_profile(req: StudentProfileRequest):
    # Split name into first and last for the DB schema
    full_name = req.name or ""
    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    result = save_student_profile(
        req.user_id, 
        first_name, 
        last_name, 
        req.email, 
        req.skills
    )
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
        
    # Use a high top_n to reflect all meaningful matches (>5% as defined in ranker)
    recommendations = get_recommendations(skills, jobs, top_n=1000)
    return {
        "recommendations": recommendations,
        "total_scanned": len(jobs)
    }

@app.get("/api/taxonomy")
def api_get_taxonomy():
    taxonomy_path = Path(_ROOT) / "nlp" / "skills_taxonomy.json"
    if taxonomy_path.exists():
        with open(taxonomy_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {"skills": data.get("skills", [])}
    return {"skills": []}


@app.delete("/api/admin/users/{target_id}")
def api_admin_delete_user(target_id: str, token: str):
    """Securely deletes a user account after verifying admin privileges.
    
    Expects 'token' as a query parameter or from headers in a real-world app.
    For this implementation, we allow passing it as a query param for simplicity.
    """
    try:
        # 1. Verify caller identity using the provided JWT
        supabase_anon = get_client()
        user_resp = supabase_anon.auth.get_user(token)
        if not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        
        caller_id = user_resp.user.id
        
        # 2. Check Role-Based Access Control (RBAC)
        if not is_admin(caller_id):
            raise HTTPException(status_code=403, detail="Administrative privileges required")
        
        # 3. Perform the administrative action
        success = delete_auth_user(target_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete user account")
            
        # 4. Audit Log
        log_system_event(
            event_type="USER_DELETED",
            message=f"Admin {user_resp.user.email} deleted user account {target_id}",
            actor_id=caller_id,
            metadata={"target_user_id": target_id}
        )
        
        return {"status": "success", "message": f"User {target_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
