"""Database manager using Supabase client.

All DB operations go through this module — no direct SQL strings in app code.
Uses the anon client for all operations since RLS policies allow the required
access patterns.
"""

import logging
import re
from typing import List, Optional, Dict

from database.supabase_client import get_client, get_service_client

logger = logging.getLogger(__name__)


def _get_client():
    """Return the standard Supabase client (anon)."""
    return get_client()


def _get_service_client():
    """Return the administrative Supabase client (service role)."""
    return get_service_client()


def normalize_url(url: str) -> str:
    """Strip query parameters and tracking IDs from job URLs."""
    if not url:
        return ""
    # Remove everything after ?
    url = url.split("?")[0]
    # Remove trailing slashes
    url = url.rstrip("/")
    return url


# ─── JOBS ────────────────────────────────────────────────────────────────────


def save_job(job: dict) -> Optional[str]:
    """Upsert a single job into Supabase. Returns the job UUID or None.

    Deduplicates by URL using upsert with on_conflict.
    """
    try:
        client = _get_service_client()
        normalized_url = normalize_url(job["url"])
        
        result = (
            client.table("jobs")
            .upsert(
                {
                    "title": job["title"],
                    "company": job["company"],
                    "location": job.get("location", ""),
                    "description": job.get("description", ""),
                    "source": job["source"],
                    "url": normalized_url,
                },
                on_conflict="url",
            )
            .execute()
        )
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        logger.error("save_job error: %s", e)
    return None


def save_skills_for_job(job_id: str, skills: List[str]) -> bool:
    """Delete old skills for a job and insert the new normalized list."""
    try:
        client = _get_service_client()
        client.table("job_skills").delete().eq(
            "job_id", job_id
        ).execute()
        if skills:
            rows = [
                {"job_id": job_id, "skill": s.lower().strip()}
                for s in skills
                if s.strip()
            ]
            client.table("job_skills").insert(rows).execute()
        return True
    except Exception as e:
        logger.error("save_skills_for_job error: %s", e)
        return False


def get_all_jobs() -> List[dict]:
    """Return all jobs with their extracted skills list."""
    try:
        client = _get_client()
        jobs_result = (
            client.table("jobs")
            .select("*, job_skills(skill)")
            .execute()
        )
        jobs = []
        for job in jobs_result.data:
            job["skills"] = [
                s["skill"] for s in job.get("job_skills", [])
            ]
            jobs.append(job)
        return jobs
    except Exception as e:
        logger.error("get_all_jobs error: %s", e)
        return []


def get_jobs_without_skills() -> List[dict]:
    """Return jobs that have no skills extracted yet (for NLP pipeline)."""
    try:
        client = _get_client()
        all_jobs = (
            client.table("jobs")
            .select("id, description")
            .execute()
            .data
        )
        jobs_with_skills_ids = {
            row["job_id"]
            for row in client.table("job_skills")
            .select("job_id")
            .execute()
            .data
        }
        return [
            j for j in all_jobs if j["id"] not in jobs_with_skills_ids
        ]
    except Exception as e:
        logger.error("get_jobs_without_skills error: %s", e)
        return []


# ─── STUDENTS ────────────────────────────────────────────────────────────────


def save_user_profile(
    auth_user_id: str, 
    first_name: str, 
    last_name: str, 
    email: Optional[str], 
    skills: List[str]
) -> Optional[str]:
    """Upsert user profile and replace all skills.

    Returns the student UUID or None on error.
    """
    try:
        client = _get_service_client()

        # Build upsert payload
        payload = {
            "auth_user_id": auth_user_id, 
            "first_name": first_name,
            "last_name": last_name
        }
        if email:
            payload["email"] = email

        # Upsert user row
        user_result = (
            client.table("users")
            .upsert(payload, on_conflict="auth_user_id")
            .execute()
        )
        user_id = user_result.data[0]["id"]

        # Replace skills
        client.table("user_skills").delete().eq(
            "user_id", user_id
        ).execute()
        if skills:
            rows = [
                {"user_id": user_id, "skill": s.lower().strip()}
                for s in skills
                if s.strip()
            ]
            client.table("user_skills").insert(rows).execute()

        return user_id
    except Exception as e:
        logger.error("save_user_profile error: %s", e)
        return None


def get_user_skills(auth_user_id: str) -> List[str]:
    """Return the skill list for a user identified by auth user ID."""
    try:
        client = _get_client()
        user_rec = (
            client.table("users")
            .select("id")
            .eq("auth_user_id", auth_user_id)
            .maybe_single()
            .execute()
        )
        if not user_rec.data:
            return []
        user_id = user_rec.data["id"]
        skills_result = (
            client.table("user_skills")
            .select("skill")
            .eq("user_id", user_id)
            .execute()
        )
        return [row["skill"] for row in skills_result.data]
    except Exception as e:
        logger.error("get_user_skills error: %s", e)
        return []


def save_scraper_log(run_id: str, level: str, message: str, source: Optional[str] = None) -> None:
    """Save a log entry for a specific scraper run."""
    try:
        client = _get_service_client()
        client.table("scraper_logs").insert({
            "run_id": run_id,
            "level": level,
            "message": message,
            "source": source
        }).execute()
    except Exception as e:
        logger.error("save_scraper_log error: %s", e)


# ─── ADMIN ───────────────────────────────────────────────────────────────────


def is_admin(user_id: str) -> bool:
    """Check if a specific user has the admin role."""
    try:
        client = _get_service_client()
        result = (
            client.table("user_roles")
            .select("role")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data and result.data["role"] == "admin"
    except Exception as e:
        logger.error("is_admin check failed for %s: %s", user_id, e)
        return False


def log_system_event(
    event_type: str, 
    message: str, 
    actor_id: str, 
    metadata: Optional[Dict] = None
) -> None:
    """Record an audit log for administrative or system actions."""
    try:
        client = _get_service_client()
        client.table("system_events").insert({
            "event_type": event_type,
            "message": message,
            "actor_id": actor_id,
            "metadata": metadata or {}
        }).execute()
    except Exception as e:
        logger.error("log_system_event error: %s", e)


def delete_auth_user(auth_user_id: str) -> bool:
    """Delete a user from Supabase Auth using the service role.
    
    This triggers ON DELETE CASCADE for profiles, roles, and skills.
    """
    try:
        client = _get_service_client()
        # Note: auth.admin.delete_user requires the service_role key
        client.auth.admin.delete_user(auth_user_id)
        return True
    except Exception as e:
        logger.error("delete_auth_user error: %s", e)
        return False


def sign_out_user(auth_user_id: str) -> bool:
    """Forcibly sign out a user from all sessions globally."""
    try:
        client = _get_service_client()
        # Revoke all refresh tokens and end active sessions
        client.auth.admin.sign_out(auth_user_id, scope="global")
        return True
    except Exception as e:
        logger.error("sign_out_user error: %s", e)
        return False
