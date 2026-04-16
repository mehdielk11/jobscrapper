import sys
import asyncio
from pathlib import Path
import json
import re
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
    get_user_skills, 
    save_user_profile,
    is_admin,
    log_system_event,
    delete_auth_user,
    sign_out_user
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

def verify_admin(token: str):
    """Verifies that the provided token belongs to an authorized administrator."""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    try:
        supabase_anon = get_client()
        user_resp = supabase_anon.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        
        if not is_admin(user_resp.user.id):
            raise HTTPException(status_code=403, detail="Administrative privileges required")
        
        return user_resp.user
    except HTTPException:
        raise
    except Exception as e:
        print(f"Admin verification error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during verification")

class UserProfileRequest(BaseModel):
    user_id: str
    name: Optional[str] = None
    skills: List[str]
    email: Optional[str] = None

@app.get("/api/jobs")
def api_get_jobs():
    jobs = get_all_jobs()
    return {"jobs": jobs}

@app.post("/api/scrape/run")
async def api_trigger_scrape(
    token: str,
    background_tasks: BackgroundTasks,
    limit: int = 30,
    dry_run: bool = False,
):
    """Manually trigger a full scrape & extraction in the background. Admin only.

    Runs in a thread-pool executor so that sync_playwright() never blocks
    the uvicorn event loop (which would freeze the entire server).
    """
    verify_admin(token)

    loop = asyncio.get_event_loop()

    async def _run_pipeline():
        await loop.run_in_executor(
            None,
            lambda: run_all_scrapers(limit_per_source=limit),
        )
        if not dry_run:
            await loop.run_in_executor(None, process_all_jobs)

    background_tasks.add_task(_run_pipeline)
    return {"message": "Scraping pipeline started (Scrapers -> NLP Engine)."}

@app.post("/api/scrape/{source}")
async def api_trigger_single_scrape(
    source: str,
    token: str,
    background_tasks: BackgroundTasks,
    limit: int = 30,
    dry_run: bool = False,
    run_id: str = None,
):
    """Trigger a single scraper. Admin only.

    Uses run_in_executor so Playwright scrapers don't freeze the event loop.
    """
    verify_admin(token)

    loop = asyncio.get_event_loop()

    async def _run_single():
        await loop.run_in_executor(
            None,
            lambda: run_single_scraper(source, limit=limit, run_id=run_id),
        )
        if not dry_run:
            await loop.run_in_executor(None, process_all_jobs)

    background_tasks.add_task(_run_single)
    return {"source": source, "status": "started"}

@app.get("/api/user/profile/{user_id}")
def api_get_profile(user_id: str):
    skills = get_user_skills(user_id)
    return {"skills": skills}

@app.post("/api/user/profile")
def api_save_profile(req: UserProfileRequest):
    # Split name into first and last for the DB schema
    full_name = req.name or ""
    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    result = save_user_profile(
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
    skills = get_user_skills(user_id)
    if not skills:
         raise HTTPException(status_code=404, detail="User profile not found or no skills set.")
    
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
            return json.load(f)
    return {"skills": [], "categories": {}, "synonyms": {}}


@app.delete("/api/admin/users/{target_id}")
def api_admin_delete_user(target_id: str, token: str):
    """Securely deletes a user account after verifying admin privileges."""
    try:
        # 0. Basic UUID Validation
        if not re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", target_id):
            raise HTTPException(status_code=400, detail="Invalid user ID format")

        # 1. Verify caller & admin status
        admin_user = verify_admin(token)
        caller_id = admin_user.id
        
        # 2. Self-Deletion Protection
        if caller_id == target_id:
            raise HTTPException(status_code=400, detail="You cannot delete your own administrative account")

        # 4. Immediate Global Sign-out (revokes all tokens)
        sign_out_user(target_id)

        # 5. Perform the administrative deletion
        success = delete_auth_user(target_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete user account")
            
        # 6. Audit Log
        log_system_event(
            event_type="USER_DELETED",
            message=f"Admin {admin_user.email} deleted user account {target_id}",
            actor_id=caller_id,
            metadata={"target_user_id": target_id}
        )
        
        return {"status": "success", "message": f"User {target_id} deleted and logged out successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Admin user delete error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during deletion")
