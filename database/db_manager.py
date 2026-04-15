"""Database manager using Supabase client.

All DB operations go through this module — no direct SQL strings in app code.
Uses the anon client for all operations since RLS policies allow the required
access patterns.
"""

import logging
from typing import List, Optional, Dict

from database.supabase_client import get_client

logger = logging.getLogger(__name__)


def _get_client():
    """Return the Supabase client for all operations."""
    return get_client()


# ─── JOBS ────────────────────────────────────────────────────────────────────


def save_job(job: dict) -> Optional[str]:
    """Upsert a single job into Supabase. Returns the job UUID or None.

    Deduplicates by URL using upsert with on_conflict.
    """
    try:
        client = _get_client()
        result = (
            client.table("jobs")
            .upsert(
                {
                    "title": job["title"],
                    "company": job["company"],
                    "location": job.get("location", ""),
                    "description": job.get("description", ""),
                    "source": job["source"],
                    "url": job["url"],
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
        client = _get_client()
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


def save_student_profile(
    auth_user_id: str, name: str, skills: List[str]
) -> Optional[str]:
    """Upsert student profile and replace all skills.

    Returns the student UUID or None on error.
    """
    try:
        client = _get_client()

        # Upsert student row
        student_result = (
            client.table("students")
            .upsert(
                {"auth_user_id": auth_user_id, "name": name},
                on_conflict="auth_user_id",
            )
            .execute()
        )
        student_id = student_result.data[0]["id"]

        # Replace skills
        client.table("student_skills").delete().eq(
            "student_id", student_id
        ).execute()
        if skills:
            rows = [
                {"student_id": student_id, "skill": s.lower().strip()}
                for s in skills
                if s.strip()
            ]
            client.table("student_skills").insert(rows).execute()

        return student_id
    except Exception as e:
        logger.error("save_student_profile error: %s", e)
        return None


def get_student_skills(auth_user_id: str) -> List[str]:
    """Return the skill list for a student identified by auth user ID."""
    try:
        client = _get_client()
        student = (
            client.table("students")
            .select("id")
            .eq("auth_user_id", auth_user_id)
            .maybe_single()
            .execute()
        )
        if not student.data:
            return []
        student_id = student.data["id"]
        skills_result = (
            client.table("student_skills")
            .select("skill")
            .eq("student_id", student_id)
            .execute()
        )
        return [row["skill"] for row in skills_result.data]
    except Exception as e:
        logger.error("get_student_skills error: %s", e)
        return []


def save_scraper_log(run_id: str, level: str, message: str) -> None:
    """Save a log entry for a specific scraper run."""
    try:
        client = _get_client()
        client.table("scraper_logs").insert({
            "run_id": run_id,
            "level": level,
            "message": message
        }).execute()
    except Exception as e:
        logger.error("save_scraper_log error: %s", e)
