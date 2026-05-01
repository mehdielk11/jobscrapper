import os
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
_BACKEND = str(Path(__file__).resolve().parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from recommender.ranker import get_recommendations
from scraper.scraper_runner import run_all_scrapers, run_single_scraper
from nlp.skills_extractor import process_all_jobs, request_stop as nlp_request_stop, is_running as nlp_is_running
from nlp.clustering_engine import run_clustering, request_clustering_stop, is_clustering_running
from database.db_manager import (
    get_all_jobs, 
    get_user_skills, 
    save_user_profile,
    is_admin,
    is_academic_manager,
    log_system_event,
    delete_auth_user,
    sign_out_user,
    admin_create_user,
    admin_update_user_password,
    create_organisation,
    get_organisation_by_manager,
    update_organisation,
    get_org_members_with_skills,
    add_member_by_email,
    remove_member,
    join_org_by_invite_code,
    regenerate_invite_code,
    get_all_organisations,
    delete_organisation,
    get_student_organisation,
    get_org_analytics,
    submit_application,
    get_application_by_id,
    get_application_by_email,
    list_applications,
    count_pending_applications,
    update_application_status,
    delete_application,
    email_exists_in_auth,
)
from database.supabase_client import get_client

app = FastAPI(title="Job Recommender API")

# Configure CORS
allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:4173,https://*.vercel.app,https://jobscrapper-xi.vercel.app").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

class CloudflareIPMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Read the CF-Connecting-IP header
        cf_ip = request.headers.get("CF-Connecting-IP")
        if cf_ip:
            # Overwrite the client IP in the request scope
            request.scope["client"] = (cf_ip, request.client.port if request.client else 0)
        return await call_next(request)

app.add_middleware(CloudflareIPMiddleware)

@app.get("/health", tags=["system"])
async def health_check():
    """Railway uses this endpoint to verify the container is alive."""
    return {"status": "ok", "service": "job-recommender-api"}

# Initialize Scheduler
scheduler = BackgroundScheduler()

def scheduled_job_scrape():
    """Background task for cron job."""
    print("CRON: Starting scheduled job scrape...")
    
    from database.supabase_client import get_service_client
    from datetime import datetime, timezone
    
    try:
        svc = get_service_client()
        sources = ["rekrute", "emploi-public", "marocannonces", "linkedin"]
        now = datetime.now(timezone.utc).isoformat()
        run_ids: dict = {}
        
        for src in sources:
            try:
                res = svc.table("scraper_runs").insert({
                    "source": src, "status": "running",
                    "jobs_found": 0, "jobs_saved": 0, "started_at": now,
                }).execute()
                if res.data:
                    run_ids[src] = res.data[0]["id"]
            except Exception as e:
                print(f"CRON [scrape/run] Could not create run record for {src}: {e}")
                
        run_all_scrapers(limit_per_source=30, run_ids=run_ids)
        
        # Stage 2: Enrich descriptions from individual job URLs
        from scraper.enrichment_agent import enrich_all_jobs
        print("CRON: Stage 2 — Enriching job descriptions...")
        enrich_all_jobs(target_status="pending")
        
        # Stage 3: NLP skills extraction on enriched data
        print("CRON: Stage 3 — Extracting skills...")
        process_all_jobs()

        # Stage 4: High-precision skill clustering
        print("CRON: Stage 4 — High-Precision Clustering...")
        from nlp.clustering_engine import run_clustering
        run_clustering()
    except Exception as outer_e:
        print(f"CRON Setup failed: {outer_e}")
        run_all_scrapers(limit_per_source=30)
        from scraper.enrichment_agent import enrich_all_jobs
        enrich_all_jobs(target_status="pending")
        process_all_jobs()
        from nlp.clustering_engine import run_clustering
        run_clustering()
        
    print("CRON: Finished 4-stage pipeline.")

def scheduled_clustering():
    """Background task to run high-precision skill clustering."""
    print("CRON: Starting High-Precision Clustering...")
    from nlp.clustering_engine import run_clustering
    run_clustering()
    print("CRON: Finished High-Precision Clustering.")

@app.on_event("startup")
def startup_event():
    # Attempt to clean up zombie scraper runs lingering from an unexpected shutdown
    try:
        from database.supabase_client import get_service_client
        client = get_service_client()
        # Reset any stuck scraper runs
        client.table("scraper_runs").update({
            "status": "failed",
            "error_message": "Server restarted while running."
        }).eq("status", "running").execute()
        
        # Reset all agent statuses
        client.table("app_config").upsert([
            {"key": "nlp_status", "value": {"status": "idle", "total": 0, "processed": 0}},
            {"key": "enrichment_status", "value": {"status": "idle", "total": 0, "processed": 0}},
            {"key": "clustering_status", "value": {"status": "idle", "step": "", "progress": 0, "total": 0}}
        ]).execute()
        print("Startup cleanup complete: zombie states reset.")
    except Exception as e:
        print(f"Startup cleanup failed: {e}")

    # Schedule the 4-stage pipeline to run every 6 hours
    scheduler.add_job(scheduled_job_scrape, 'interval', hours=6, id="scrape_6h")
    # Note: clustering is now Stage 4 of the main pipeline, no separate job needed.
    scheduler.start()
    print("Scheduler started: Jobs will be scraped every 6 hours.")

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

def _get_authenticated_user(token: str):
    """Validate a token and return the Supabase user object."""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required")
    try:
        supabase_anon = get_client()
        user_resp = supabase_anon.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return user_resp.user
    except HTTPException:
        raise
    except Exception as e:
        print(f"Auth verification error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during verification")


def verify_admin(token: str):
    """Verifies that the provided token belongs to an authorized administrator."""
    user = _get_authenticated_user(token)
    if not is_admin(user.id):
        raise HTTPException(status_code=403, detail="Administrative privileges required")
    return user


def verify_manager(token: str):
    """Verifies that the provided token belongs to an academic manager."""
    user = _get_authenticated_user(token)
    if not is_academic_manager(user.id):
        raise HTTPException(status_code=403, detail="Academic manager privileges required")
    return user

class UserProfileRequest(BaseModel):
    user_id: str
    name: Optional[str] = None
    hard_skills: List[str] = []
    soft_skills: List[str] = []
    email: Optional[str] = None

@app.get("/api/jobs")
def api_get_jobs():
    jobs = get_all_jobs()
    return {"jobs": jobs}


@app.get("/api/scraper-runs")
def api_get_scraper_runs(token: str, limit: int = 100):
    """Return recent scraper_runs rows ordered newest-first.

    Uses the service-role client so RLS never filters rows.
    Admin-only. The frontend uses this to seed the status badges on mount
    without a page refresh being required.
    """
    verify_admin(token)

    from database.supabase_client import get_service_client

    try:
        client = get_service_client()
        result = (
            client.table("scraper_runs")
            .select("id, source, status, jobs_found, jobs_saved, started_at, finished_at, error_message")
            .order("started_at", desc=True)
            .limit(min(limit, 500))
            .execute()
        )
        return {"runs": result.data or []}
    except Exception as e:
        print(f"[api/scraper-runs] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch scraper runs")


@app.get("/api/nlp-status")
def api_get_nlp_status(token: str):
    """Return the current NLP Engine status from app_config.
    
    Uses service-role to bypass RLS, ensuring admins always see the
    progress bar in the UI.
    """
    verify_admin(token)
    from database.supabase_client import get_service_client
    
    try:
        client = get_service_client()
        result = (
            client.table("app_config")
            .select("value")
            .eq("key", "nlp_status")
            .maybe_single()
            .execute()
        )
        if result.data and "value" in result.data:
            return result.data["value"]
        # Default state if missing
        return {"status": "idle", "total": 0, "processed": 0}
    except Exception as e:
        print(f"[api/nlp-status] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load NLP status")


@app.post("/api/scrape/run")
async def api_trigger_scrape(
    token: str,
    background_tasks: BackgroundTasks,
    limit: int = 30,
    dry_run: bool = False,
):
    """Manually trigger a full scrape & extraction in the background. Admin only."""
    verify_admin(token)

    from database.supabase_client import get_service_client
    from datetime import datetime, timezone

    # Create a run record per source using service-role (bypasses RLS)
    svc = get_service_client()
    sources = ["rekrute", "emploi-public", "marocannonces", "linkedin"]
    now = datetime.now(timezone.utc).isoformat()
    run_ids: dict = {}
    for src in sources:
        try:
            res = svc.table("scraper_runs").insert({
                "source": src, "status": "running",
                "jobs_found": 0, "jobs_saved": 0, "started_at": now,
            }).execute()
            if res.data:
                run_ids[src] = res.data[0]["id"]
        except Exception as e:
            print(f"[scrape/run] Could not create run record for {src}: {e}")

    loop = asyncio.get_event_loop()

    async def _run_pipeline():
        await loop.run_in_executor(
            None,
            lambda: run_all_scrapers(limit_per_source=limit, run_ids=run_ids),
        )
        if not dry_run:
            # Stage 2: Enrich descriptions from individual job URLs
            from scraper.enrichment_agent import enrich_all_jobs
            await loop.run_in_executor(None, lambda: enrich_all_jobs(target_status="pending"))
            # Stage 3: NLP skills extraction on enriched data
            await loop.run_in_executor(None, process_all_jobs)

    background_tasks.add_task(_run_pipeline)
    return {"message": "Scraping pipeline started.", "run_ids": run_ids}

@app.post("/api/nlp/run")
async def api_trigger_nlp(
    token: str,
    background_tasks: BackgroundTasks,
    target_status: str = "pending",
):
    """Manually trigger the NLP extraction engine in the background. Admin only.
    
    Args:
        target_status: Which jobs to process — 'pending', 'failed', or 'no_skills_found'.
    """
    verify_admin(token)
    
    allowed = {"pending", "failed", "no_skills_found"}
    if target_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid target_status. Must be one of: {', '.join(allowed)}")
    
    loop = asyncio.get_event_loop()
    
    async def _run_nlp():
        await loop.run_in_executor(None, lambda: process_all_jobs(target_status=target_status))
        
    background_tasks.add_task(_run_nlp)
    return {"message": f"NLP extraction triggered for '{target_status}' jobs."}

@app.post("/api/enrich/run")
async def api_trigger_enrichment(
    token: str,
    background_tasks: BackgroundTasks,
    target_status: str = "no_skills_found",
    limit: int = 500,
):
    """Manually trigger the enrichment agent in the background. Admin only.

    Args:
        target_status: Which jobs to enrich — 'no_skills_found', 'failed', or 'pending'.
        limit: Max jobs to process per run.
    """
    verify_admin(token)

    allowed = {"pending", "failed", "no_skills_found"}
    if target_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid target_status. Must be one of: {', '.join(allowed)}")

    from scraper.enrichment_agent import enrich_all_jobs

    loop = asyncio.get_event_loop()

    async def _run_enrichment():
        await loop.run_in_executor(None, lambda: enrich_all_jobs(target_status=target_status, limit=limit))

    background_tasks.add_task(_run_enrichment)
    return {"message": f"Enrichment agent triggered for '{target_status}' jobs."}

@app.get("/api/enrichment-status")
def api_get_enrichment_status(token: str):
    """Return the current enrichment status from app_config."""
    verify_admin(token)
    from database.supabase_client import get_service_client

    try:
        client = get_service_client()
        result = (
            client.table("app_config")
            .select("value")
            .eq("key", "enrichment_status")
            .maybe_single()
            .execute()
        )
        if result.data and "value" in result.data:
            return result.data["value"]
        return {"status": "idle", "total": 0, "processed": 0}
    except Exception as e:
        print(f"[api/enrichment-status] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load enrichment status")


@app.post("/api/nlp/stop")
def api_stop_nlp(token: str):
    """Gracefully stop the NLP extraction engine. Admin only.
    
    Sets a thread-safe stop flag that the processing loop checks before
    each Gemini API call. The current job will finish normally, then the
    loop exits. No data corruption is possible.
    """
    verify_admin(token)
    if not nlp_is_running():
        raise HTTPException(status_code=409, detail="NLP engine is not currently running.")
    nlp_request_stop()
    return {"message": "Stop signal sent. NLP engine will halt after the current job."}


@app.post("/api/enrich/stop")
def api_stop_enrichment(token: str):
    """Gracefully stop the enrichment agent. Admin only."""
    verify_admin(token)
    from scraper.enrichment_agent import request_enrichment_stop, is_enrichment_running
    if not is_enrichment_running():
        raise HTTPException(status_code=409, detail="Enrichment agent is not currently running.")
    request_enrichment_stop()
    return {"message": "Stop signal sent. Enrichment will halt after the current job."}


@app.get("/api/clustering-status")
def api_clustering_status():
    """Get the current progress of the background clustering engine."""
    try:
        from database.supabase_client import get_service_client
        client = get_service_client()
        res = client.table("app_config").select("value").eq("key", "clustering_status").execute()
        if res.data and res.data[0].get("value"):
            return res.data[0]["value"]
        # Default state
        return {"status": "idle", "step": "", "progress": 0, "total": 0}
    except Exception as e:
        print(f"[api/clustering-status] Error: {e}")
        return {"status": "idle", "step": "", "progress": 0, "total": 0}


@app.post("/api/clustering/run")
async def api_trigger_clustering(
    token: str,
    background_tasks: BackgroundTasks,
):
    """Manually trigger the clustering engine in the background. Admin only."""
    verify_admin(token)
    if is_clustering_running():
        raise HTTPException(status_code=409, detail="Clustering engine is already running.")
    
    loop = asyncio.get_event_loop()
    
    async def _run_clustering():
        await loop.run_in_executor(None, run_clustering)
    
    background_tasks.add_task(_run_clustering)
    return {"message": "Clustering engine triggered."}


@app.post("/api/clustering/stop")
def api_stop_clustering(token: str):
    """Gracefully stop the clustering engine. Admin only."""
    verify_admin(token)
    if not is_clustering_running():
        raise HTTPException(status_code=409, detail="Clustering engine is not currently running.")
    request_clustering_stop()
    return {"message": "Stop signal sent. Clustering will halt after the current step."}

@app.post("/api/scrape/{source}")
async def api_trigger_single_scrape(
    source: str,
    token: str,
    background_tasks: BackgroundTasks,
    limit: int = 30,
    dry_run: bool = False,
):
    """Trigger a single scraper. Admin only.

    Creates the scraper_runs row with the service-role client (bypasses RLS)
    so the run_id is always valid and the Realtime UPDATE fires correctly.
    """
    verify_admin(token)

    from database.supabase_client import get_service_client
    from datetime import datetime, timezone

    # Create the run record via service-role — never blocked by RLS
    run_id: Optional[str] = None
    try:
        svc = get_service_client()
        res = svc.table("scraper_runs").insert({
            "source": source,
            "status": "running",
            "jobs_found": 0,
            "jobs_saved": 0,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        if res.data:
            run_id = res.data[0]["id"]
    except Exception as e:
        print(f"[scrape/{source}] Could not create run record: {e}")

    loop = asyncio.get_event_loop()

    async def _run_single():
        await loop.run_in_executor(
            None,
            lambda: run_single_scraper(source, limit=limit, run_id=run_id),
        )
        if not dry_run:
            # Stage 2: Enrich descriptions from individual job URLs
            from scraper.enrichment_agent import enrich_all_jobs
            await loop.run_in_executor(None, lambda: enrich_all_jobs(target_status="pending"))
            # Stage 3: NLP skills extraction on enriched data
            await loop.run_in_executor(None, process_all_jobs)

    background_tasks.add_task(_run_single)
    return {"source": source, "status": "started", "run_id": run_id}

@app.get("/api/user/profile/{user_id}")
def api_get_profile(user_id: str):
    skills = get_user_skills(user_id)
    return {"hard_skills": skills["hard"], "soft_skills": skills["soft"]}

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
        req.hard_skills,
        req.soft_skills
    )
    if result:
        return {"status": "success", "id": result}
    raise HTTPException(status_code=500, detail="Failed to save profile")

@app.get("/api/recommend/{user_id}")
def api_recommend(
    user_id: str,
    diploma: Optional[str] = None,
    date_posted_gte: Optional[str] = None
):
    skills = get_user_skills(user_id)
    if not skills or (not skills.get("hard") and not skills.get("soft")):
         raise HTTPException(status_code=404, detail="User profile not found or no skills set.")
    
    diplomas_list = [d.strip() for d in diploma.split(",")] if diploma else None
    jobs = get_all_jobs(diplomas=diplomas_list, date_posted_gte=date_posted_gte)
    if not jobs:
        raise HTTPException(status_code=404, detail="No jobs found matching the filters.")
        
    # Use a high top_n to reflect all meaningful matches (>5% as defined in ranker)
    recommendations = get_recommendations(skills["hard"], skills["soft"], jobs, top_n=1000)
    return {
        "recommendations": recommendations,
        "total_scanned": len(jobs)
    }


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


@app.get("/api/logs")
def api_get_logs(
    token: str,
    hours: int = 6,
    limit: int = 500,
    source: Optional[str] = None,
):
    """Return recent scraper log entries for the live activity feed.

    Uses the service-role client so RLS policies never silently filter rows.
    Admin-only.

    Args:
        token:  Admin JWT.
        hours:  How many hours back to fetch (default: 6).
        limit:  Max rows to return (default: 500, capped at 1000).
        source: Optional source filter (e.g. 'rekrute').
    """
    verify_admin(token)

    from database.supabase_client import get_service_client
    from datetime import datetime, timezone, timedelta

    limit = min(limit, 1000)
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    try:
        client = get_service_client()
        query = (
            client.table("scraper_logs")
            .select("id, level, message, source, created_at")
            .gte("created_at", since)
            .order("created_at", desc=False)
            .limit(limit)
        )
        if source:
            query = query.eq("source", source)

        result = query.execute()
        return {"logs": result.data or []}

    except Exception as e:
        print(f"[api/logs] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch logs")


# ─── ADMIN: PASSWORD MANAGEMENT ──────────────────────────────────────────────


class ChangeOwnPasswordRequest(BaseModel):
    current_password: str
    new_password: str
    captcha_token: Optional[str] = None


class ResetUserPasswordRequest(BaseModel):
    new_password: str


@app.post("/api/admin/change-own-password")
def api_admin_change_own_password(req: ChangeOwnPasswordRequest, token: str):
    """Admin changes their own password. Requires current password verification."""
    admin_user = verify_admin(token)

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    # Verify current password by attempting a sign-in
    try:
        anon = get_client()
        kwargs = {
            "email": admin_user.email,
            "password": req.current_password,
        }
        if req.captcha_token:
            kwargs["options"] = {"captchaToken": req.captcha_token}
            
        anon.auth.sign_in_with_password(kwargs)
    except Exception as e:
        print(f"Failed to verify admin password: {e}")
        raise HTTPException(status_code=403, detail="Current password is incorrect")

    # Update via service role
    if not admin_update_user_password(admin_user.id, req.new_password):
        raise HTTPException(status_code=500, detail="Failed to update password")

    log_system_event(
        event_type="PASSWORD_CHANGED",
        message=f"Admin {admin_user.email} changed their own password",
        actor_id=admin_user.id,
    )
    return {"status": "success", "message": "Password updated successfully"}


@app.post("/api/admin/users/{target_id}/password")
def api_admin_reset_user_password(target_id: str, req: ResetUserPasswordRequest, token: str):
    """Admin resets another user's password. The user will need to re-authenticate."""
    admin_user = verify_admin(token)

    if not re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", target_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Update password
    if not admin_update_user_password(target_id, req.new_password):
        raise HTTPException(status_code=500, detail="Failed to reset password")

    # Force sign-out so user must re-authenticate with the new password
    sign_out_user(target_id)

    log_system_event(
        event_type="PASSWORD_RESET",
        message=f"Admin {admin_user.email} reset password for user {target_id}",
        actor_id=admin_user.id,
        metadata={"target_user_id": target_id},
    )
    return {"status": "success", "message": "Password reset and user signed out"}


# ─── ADMIN: USER CREATION ────────────────────────────────────────────────────


class CreateUserRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: str  # 'student' or 'academic_manager'


@app.post("/api/admin/users/create")
def api_admin_create_user(req: CreateUserRequest, token: str):
    """Create a new user account. Admin only."""
    admin_user = verify_admin(token)

    if req.role not in ("student", "academic_manager"):
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'academic_manager'")

    try:
        auth_id = admin_create_user(
            email=req.email,
            password=req.password,
            first_name=req.first_name,
            last_name=req.last_name,
            role=req.role,
        )
    except Exception as e:
        err_msg = str(e)
        if hasattr(e, 'message'):
            err_msg = e.message
        elif hasattr(e, 'details') and e.details:
            err_msg = str(e.details)
        raise HTTPException(status_code=400, detail=f"Failed to create user: {err_msg}")

    log_system_event(
        event_type="USER_CREATED",
        message=f"Admin {admin_user.email} created {req.role} account: {req.email}",
        actor_id=admin_user.id,
        metadata={"new_user_id": auth_id, "role": req.role},
    )
    return {"status": "success", "auth_user_id": auth_id}


# ─── ORGANISATION ENDPOINTS (Academic Manager) ───────────────────────────────


class CreateOrgRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateOrgRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class AddMemberRequest(BaseModel):
    email: str


class JoinOrgRequest(BaseModel):
    invite_code: str


@app.post("/api/org")
def api_create_org(req: CreateOrgRequest, token: str):
    """Create an organisation. Academic Manager only (onboarding)."""
    user = verify_manager(token)
    org = create_organisation(user.id, req.name, req.description)
    if not org:
        raise HTTPException(status_code=409, detail="Organisation already exists or creation failed")
    return {"status": "success", "organisation": org}


@app.get("/api/org/mine")
def api_get_my_org(token: str):
    """Get the manager's own organisation."""
    user = verify_manager(token)
    org = get_organisation_by_manager(user.id)
    if not org:
        return {"organisation": None}
    return {"organisation": org}


@app.put("/api/org/mine")
def api_update_my_org(req: UpdateOrgRequest, token: str):
    """Update org name/description."""
    user = verify_manager(token)
    org = get_organisation_by_manager(user.id)
    if not org:
        raise HTTPException(status_code=404, detail="No organisation found")
    updated = update_organisation(org["id"], user.id, req.name, req.description)
    if not updated:
        raise HTTPException(status_code=500, detail="Update failed")
    return {"status": "success", "organisation": updated}


@app.get("/api/org/mine/members")
def api_get_my_org_members(token: str):
    """List members of the manager's org with their skills."""
    user = verify_manager(token)
    org = get_organisation_by_manager(user.id)
    if not org:
        raise HTTPException(status_code=404, detail="No organisation found")
    members = get_org_members_with_skills(org["id"])
    return {"members": members, "count": len(members)}


@app.post("/api/org/mine/members")
def api_add_member(req: AddMemberRequest, token: str):
    """Add a student to the manager's org by email."""
    user = verify_manager(token)
    org = get_organisation_by_manager(user.id)
    if not org:
        raise HTTPException(status_code=404, detail="No organisation found")
    error = add_member_by_email(org["id"], req.email)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"status": "success"}


@app.delete("/api/org/mine/members/{user_auth_id}")
def api_remove_member(user_auth_id: str, token: str):
    """Remove a student from the manager's org."""
    user = verify_manager(token)
    org = get_organisation_by_manager(user.id)
    if not org:
        raise HTTPException(status_code=404, detail="No organisation found")
    if not remove_member(org["id"], user_auth_id):
        raise HTTPException(status_code=500, detail="Failed to remove member")
    return {"status": "success"}


@app.post("/api/org/mine/invite-code/regenerate")
def api_regenerate_invite(token: str):
    """Regenerate the invite code for the manager's org."""
    user = verify_manager(token)
    org = get_organisation_by_manager(user.id)
    if not org:
        raise HTTPException(status_code=404, detail="No organisation found")
    new_code = regenerate_invite_code(org["id"], user.id)
    if not new_code:
        raise HTTPException(status_code=500, detail="Failed to regenerate code")
    return {"invite_code": new_code}


@app.post("/api/org/join")
def api_join_org(req: JoinOrgRequest, token: str):
    """Join an organisation via invite code. Student only."""
    user = _get_authenticated_user(token)
    error = join_org_by_invite_code(user.id, req.invite_code)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"status": "success"}


@app.get("/api/org/student")
def api_get_student_org(token: str):
    """Get the organisation a student belongs to."""
    user = _get_authenticated_user(token)
    org = get_student_organisation(user.id)
    return {"organisation": org}


@app.get("/api/org/mine/analytics")
def api_get_org_analytics(token: str):
    """Org-scoped analytics for the academic manager."""
    user = verify_manager(token)
    org = get_organisation_by_manager(user.id)
    if not org:
        raise HTTPException(status_code=404, detail="No organisation found")
    analytics = get_org_analytics(org["id"])
    return analytics

# ─── ADMIN: ORGANISATION MANAGEMENT ──────────────────────────────────────────


@app.get("/api/admin/orgs")
def api_admin_list_orgs(token: str):
    """List all organisations. Admin only."""
    verify_admin(token)
    orgs = get_all_organisations()
    return {"organisations": orgs}


@app.delete("/api/admin/orgs/{org_id}")
def api_admin_delete_org(org_id: str, token: str):
    """Delete an organisation. Students become unaffiliated. Admin only."""
    admin_user = verify_admin(token)
    if not delete_organisation(org_id):
        raise HTTPException(status_code=500, detail="Failed to delete organisation")
    log_system_event(
        event_type="ORG_DELETED",
        message=f"Admin {admin_user.email} deleted organisation {org_id}",
        actor_id=admin_user.id,
        metadata={"org_id": org_id},
    )
    return {"status": "success"}


# ─── MANAGER APPLICATION PIPELINE ────────────────────────────────────────────

from pydantic import EmailStr
import httpx as _httpx

TURNSTILE_SECRET = os.getenv("TURNSTILE_SECRET_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def _verify_turnstile(token: str) -> bool:
    """Verify a Cloudflare Turnstile token server-side."""
    if not TURNSTILE_SECRET:
        # Dev mode — skip verification
        return True
    try:
        resp = _httpx.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": TURNSTILE_SECRET, "response": token},
            timeout=5.0,
        )
        result = resp.json()
        return bool(result.get("success"))
    except Exception as e:
        print(f"[turnstile] Verification error: {e}")
        return False


class ApplicationSubmitRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    org_name: str
    org_type: str
    org_description: str
    org_website: Optional[str] = None
    expected_students: Optional[int] = None
    captcha_token: str
    honeypot: str = ""


@app.post("/api/applications/submit")
def api_submit_application(req: ApplicationSubmitRequest):
    """Public endpoint: submit an Academic Manager application."""
    # 1. Honeypot check — bots fill hidden fields
    if req.honeypot:
        return {"status": "submitted"}  # silent discard

    # 2. Turnstile verification
    if not _verify_turnstile(req.captcha_token):
        raise HTTPException(status_code=400, detail="Verification failed. Please try again.")

    # 3. Validate org_type
    if req.org_type not in ("university", "bootcamp", "company", "other"):
        raise HTTPException(status_code=400, detail="Invalid organisation type")

    # 4. Input length guards
    if len(req.first_name) > 50 or len(req.last_name) > 50:
        raise HTTPException(status_code=400, detail="Name too long (max 50 chars)")
    if len(req.org_name) > 100:
        raise HTTPException(status_code=400, detail="Organisation name too long (max 100 chars)")
    if len(req.org_description) > 1000:
        raise HTTPException(status_code=400, detail="Description too long (max 1000 chars)")

    email = req.email.lower().strip()

    # 5. Check email not already in auth.users
    if email_exists_in_auth(email):
        raise HTTPException(status_code=409, detail="This email is already registered. Please log in instead.")

    # 6. Check email not already in applications
    existing = get_application_by_email(email)
    if existing:
        if existing["status"] == "pending":
            raise HTTPException(status_code=409, detail="An application with this email is already under review.")
        elif existing["status"] == "approved":
            raise HTTPException(status_code=409, detail="This email has already been approved. Check your email for the activation link.")

    # 7. Insert application
    row = submit_application({
        "first_name": req.first_name.strip(),
        "last_name": req.last_name.strip(),
        "email": email,
        "org_name": req.org_name.strip(),
        "org_type": req.org_type,
        "org_description": req.org_description.strip(),
        "org_website": (req.org_website or "").strip() or None,
        "expected_students": req.expected_students,
    })
    if not row:
        raise HTTPException(status_code=500, detail="Failed to submit application")

    # Note: no audit log here — there's no authenticated actor for public submissions.
    # The manager_applications table itself serves as the record.

    return {"status": "submitted"}


# ─── ADMIN: APPLICATION MANAGEMENT ───────────────────────────────────────────


@app.get("/api/admin/applications")
def api_admin_list_applications(
    token: str,
    status: str = "pending",
    page: int = 1,
    page_size: int = 20,
):
    """List applications for admin review. Supports pagination and status filter."""
    verify_admin(token)
    if status not in ("pending", "approved", "rejected", "all"):
        raise HTTPException(status_code=400, detail="Invalid status filter")
    page_size = min(page_size, 50)
    return list_applications(status=status, page=page, page_size=page_size)


@app.get("/api/admin/applications/count")
def api_admin_applications_count(token: str):
    """Return the count of pending applications (for sidebar badge)."""
    verify_admin(token)
    return {"count": count_pending_applications()}


@app.post("/api/admin/applications/{app_id}/approve")
def api_admin_approve_application(app_id: str, token: str):
    """Approve an application: invite user via Supabase (sends email), set up profile."""
    admin_user = verify_admin(token)

    # 1. Fetch application
    application = get_application_by_id(app_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Application is already {application['status']}")

    email = application["email"]

    # 2. Guard: check no auth user exists already
    if email_exists_in_auth(email):
        raise HTTPException(status_code=409, detail="A user with this email already exists in the system")

    # 3. Invite user via Supabase Auth — this creates the user AND sends an invite email.
    #    When the user clicks the link, Supabase redirects to FRONTEND_URL/activate
    #    with access_token and refresh_token in the URL hash fragment.
    from database.supabase_client import get_service_client
    svc = get_service_client()

    try:
        invite_resp = svc.auth.admin.invite_user_by_email(
            email,
            options={
                "redirect_to": f"{FRONTEND_URL}/activate",
                "data": {
                    "first_name": application["first_name"],
                    "last_name": application["last_name"],
                    "application_id": app_id,
                    "needs_password_set": True,
                },
            },
        )
        auth_user_id = str(invite_resp.user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to invite user: {e}")

    try:
        # 4. Insert users table row
        svc.table("users").upsert({
            "auth_user_id": auth_user_id,
            "first_name": application["first_name"],
            "last_name": application["last_name"],
            "email": email,
        }, on_conflict="auth_user_id").execute()

        # 5. Insert user_roles
        svc.table("user_roles").upsert(
            {"user_id": auth_user_id, "role": "academic_manager"},
            on_conflict="user_id",
        ).execute()
    except Exception as e:
        # Rollback: delete the auth user we just created
        try:
            svc.auth.admin.delete_user(auth_user_id)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to set up user profile: {e}")

    # 6. Update application status
    update_application_status(app_id, "approved", str(admin_user.id))

    # 7. Audit log
    log_system_event(
        event_type="APPLICATION_APPROVED",
        message=f"Admin {admin_user.email} approved application from {email}",
        actor_id=str(admin_user.id),
        metadata={"application_id": app_id, "new_auth_user_id": auth_user_id},
    )

    return {"status": "approved", "auth_user_id": auth_user_id}


class RejectApplicationRequest(BaseModel):
    reason: Optional[str] = None


@app.post("/api/admin/applications/{app_id}/reject")
def api_admin_reject_application(app_id: str, req: RejectApplicationRequest, token: str):
    """Reject an application with an optional reason."""
    admin_user = verify_admin(token)

    application = get_application_by_id(app_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Application is already {application['status']}")

    update_application_status(app_id, "rejected", str(admin_user.id), req.reason)

    log_system_event(
        event_type="APPLICATION_REJECTED",
        message=f"Admin {admin_user.email} rejected application from {application['email']}",
        actor_id=str(admin_user.id),
        metadata={"application_id": app_id, "reason": req.reason},
    )

    return {"status": "rejected"}


@app.delete("/api/admin/applications/{app_id}")
def api_admin_delete_application(app_id: str, token: str):
    """Delete an application."""
    admin_user = verify_admin(token)

    application = get_application_by_id(app_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application["status"] == "pending":
        raise HTTPException(status_code=400, detail="Cannot delete pending applications. Reject or approve them first.")

    success = delete_application(app_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete application")

    log_system_event(
        event_type="APPLICATION_DELETED",
        message=f"Admin {admin_user.email} deleted {application['status']} application from {application['email']}",
        actor_id=str(admin_user.id),
        metadata={"application_id": app_id},
    )

    return {"status": "success"}
