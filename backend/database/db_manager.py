"""Database manager using Supabase client.

All DB operations go through this module — no direct SQL strings in app code.
Uses the anon client for all operations since RLS policies allow the required
access patterns.
"""

import logging
import re
from typing import Any, List, Optional, Dict

from database.supabase_client import get_client, get_service_client

logger = logging.getLogger(__name__)


def _get_client():
    """Return the standard Supabase client (anon)."""
    return get_client()


def _get_service_client():
    """Return the administrative Supabase client (service role)."""
    return get_service_client()


def _response_data(response: Any) -> Any:
    """Return Supabase response data, tolerating clients that return None."""
    return getattr(response, "data", None)


def _first_row(response: Any) -> Optional[Dict]:
    """Return the first row from a Supabase response."""
    data = _response_data(response)
    if isinstance(data, list):
        return data[0] if data else None
    return data


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

    Deduplicates by URL (on_conflict).
    Always resets nlp_processed=False on upsert so the NLP pipeline
    re-extracts skills for re-scraped jobs — even if the URL already exists.
    """
    try:
        client = _get_service_client()
        normalized_url = normalize_url(job["url"])
        if not normalized_url:
            return None

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
                    # Always reset so NLP re-processes re-scraped jobs.
                    # Without this, existing rows keep nlp_processed=True
                    # and the NLP pipeline silently skips them.
                    "nlp_processed": False,
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
    """Return all jobs with their extracted skills list.

    Uses service-role client to bypass RLS \u2014 same reason as get_jobs_without_skills.
    """
    try:
        client = _get_service_client()
        jobs_result = (
            client.table("jobs")
            .select("*, job_skills(skill)")
            .execute()
        )
        jobs = []
        for job in jobs_result.data:
            job["skills"] = [s["skill"] for s in job.get("job_skills", [])]
            jobs.append(job)
        return jobs
    except Exception as e:
        logger.error("get_all_jobs error: %s", e)
        return []


def get_jobs_without_skills(limit: int = 500) -> List[dict]:
    """Return jobs that have not been processed by the NLP engine yet.

    Uses the service-role client to bypass RLS — the anon client silently
    filters rows when RLS policies restrict read access, which caused the
    extractor to only see a fraction of unprocessed jobs.

    Args:
        limit: Max rows to fetch per call (safety guard against huge batches).
    """
    try:
        client = _get_service_client()
        result = (
            client.table("jobs")
            .select("id, title, description")
            .eq("nlp_processed", False)
            .limit(limit)
            .execute()
        )
        return result.data or []
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
            .limit(1)
            .execute()
        )
        user_row = _first_row(user_rec)
        if not user_row:
            return []
        user_id = user_row["id"]
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
            .limit(1)
            .execute()
        )
        row = _first_row(result)
        return bool(row and row["role"] == "admin")
    except Exception as e:
        logger.error("is_admin check failed for %s: %s", user_id, e)
        return False


def update_nlp_status(status: str, total: int = 0, processed: int = 0) -> None:
    """Update the global NLP processing status in app_config."""
    try:
        client = _get_service_client()
        import datetime
        client.table("app_config").upsert({
            "key": "nlp_status",
            "value": {
                "status": status,
                "total": total,
                "processed": processed,
                "updated_at": datetime.datetime.now().isoformat()
            }
        }).execute()
    except Exception as e:
        logger.error("update_nlp_status error: %s", e)


def mark_job_as_processed(job_id: str) -> bool:
    """Mark a job as processed by the NLP engine."""
    try:
        client = _get_service_client()
        client.table("jobs").update({"nlp_processed": True}).eq("id", job_id).execute()
        return True
    except Exception as e:
        logger.error("mark_job_as_processed error: %s", e)
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


def get_user_role(user_id: str) -> Optional[str]:
    """Return the role string for a given auth user ID, or None."""
    try:
        client = _get_service_client()
        result = (
            client.table("user_roles")
            .select("role")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = _first_row(result)
        if row:
            return row["role"]
        return None
    except Exception as e:
        logger.error("get_user_role error: %s", e)
        return None


def is_academic_manager(user_id: str) -> bool:
    """Check if a specific user has the academic_manager role."""
    return get_user_role(user_id) == "academic_manager"


# ─── ADMIN: USER CREATION ────────────────────────────────────────────────────


def admin_create_user(
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    role: str,
) -> str:
    """Create a new user via Supabase Auth Admin API and insert profile + role.

    Returns the new auth user ID on success. Raises exception on failure.
    """
    client = _get_service_client()
    auth_user_id = None
    try:
        # 1. Create auth user
        auth_resp = client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
        })
        auth_user_id = auth_resp.user.id

        # 2. Update users table (trigger auto-creates the row)
        client.table("users").update({
            "first_name": first_name,
            "last_name": last_name,
        }).eq("auth_user_id", auth_user_id).execute()

        # 3. Insert role
        client.table("user_roles").upsert(
            {"user_id": auth_user_id, "role": role},
            on_conflict="user_id",
        ).execute()

        return str(auth_user_id)
    except Exception as e:
        logger.error("admin_create_user error: %s", e)
        if auth_user_id:
            try:
                client.auth.admin.delete_user(auth_user_id)
                logger.info("Rolled back auth user creation for %s", auth_user_id)
            except Exception as cleanup_e:
                logger.error("Failed to rollback auth user %s: %s", auth_user_id, cleanup_e)
        raise e


# ─── ORGANISATIONS ────────────────────────────────────────────────────────────


import string
import secrets


def _generate_invite_code(length: int = 8) -> str:
    """Generate a random alphanumeric invite code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _slugify(text: str) -> str:
    """Convert a name to a URL-friendly slug."""
    slug = re.sub(r"[^\w\s-]", "", text.lower().strip())
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "org"


def create_organisation(
    manager_auth_id: str, name: str, description: Optional[str] = None
) -> Optional[Dict]:
    """Create a new organisation for a manager. Returns the org dict."""
    try:
        client = _get_service_client()

        # Check manager doesn't already own an org
        existing = (
            client.table("organisations")
            .select("id")
            .eq("manager_auth_id", manager_auth_id)
            .limit(1)
            .execute()
        )
        if _first_row(existing):
            return None  # already has an org

        slug = _slugify(name)
        invite_code = _generate_invite_code()

        result = (
            client.table("organisations")
            .insert({
                "name": name,
                "slug": slug,
                "description": description or "",
                "manager_auth_id": manager_auth_id,
                "invite_code": invite_code,
            })
            .execute()
        )
        return _first_row(result)
    except Exception as e:
        logger.error("create_organisation error: %s", e)
        return None


def get_organisation_by_manager(manager_auth_id: str) -> Optional[Dict]:
    """Return the org owned by this manager, or None."""
    try:
        client = _get_service_client()
        result = (
            client.table("organisations")
            .select("*")
            .eq("manager_auth_id", manager_auth_id)
            .limit(1)
            .execute()
        )
        return _first_row(result)
    except Exception as e:
        logger.error("get_organisation_by_manager error: %s", e)
        return None


def update_organisation(
    org_id: str, manager_auth_id: str, name: Optional[str] = None, description: Optional[str] = None
) -> Optional[Dict]:
    """Update org name/description. Only the owning manager can call this."""
    try:
        client = _get_service_client()
        payload: Dict = {"updated_at": "now()"}
        if name is not None:
            payload["name"] = name
            payload["slug"] = _slugify(name)
        if description is not None:
            payload["description"] = description

        result = (
            client.table("organisations")
            .update(payload)
            .eq("id", org_id)
            .eq("manager_auth_id", manager_auth_id)
            .execute()
        )
        return _first_row(result)
    except Exception as e:
        logger.error("update_organisation error: %s", e)
        return None


def get_org_members_with_skills(org_id: str) -> List[Dict]:
    """Return all members of an org with their user profile and skills."""
    try:
        client = _get_service_client()

        # 1. Get member auth IDs
        members_result = (
            client.table("organisation_members")
            .select("user_auth_id, joined_at")
            .eq("organisation_id", org_id)
            .execute()
        )
        members = members_result.data or []
        if not members:
            return []

        auth_ids = [m["user_auth_id"] for m in members]
        joined_map = {m["user_auth_id"]: m["joined_at"] for m in members}

        # 2. Get user profiles
        users_result = (
            client.table("users")
            .select("id, auth_user_id, first_name, last_name, email")
            .in_("auth_user_id", auth_ids)
            .execute()
        )
        users = users_result.data or []

        # 3. Get skills for those users
        user_ids = [u["id"] for u in users]
        skills_result = (
            client.table("user_skills")
            .select("user_id, skill")
            .in_("user_id", user_ids)
            .execute()
        )
        skills_map: Dict[str, List[str]] = {}
        for s in (skills_result.data or []):
            skills_map.setdefault(s["user_id"], []).append(s["skill"])

        # 4. Combine
        result = []
        for u in users:
            result.append({
                "id": u["id"],
                "auth_user_id": u["auth_user_id"],
                "first_name": u["first_name"],
                "last_name": u["last_name"],
                "email": u["email"],
                "skills": skills_map.get(u["id"], []),
                "joined_at": joined_map.get(u["auth_user_id"]),
            })
        return result
    except Exception as e:
        logger.error("get_org_members_with_skills error: %s", e)
        return []


def add_member_by_email(org_id: str, email: str) -> Optional[str]:
    """Add a student to an org by email. Returns error message or None on success."""
    try:
        client = _get_service_client()

        # Find the user by email
        user_result = (
            client.table("users")
            .select("auth_user_id")
            .eq("email", email)
            .limit(1)
            .execute()
        )
        user_row = _first_row(user_result)
        if not user_row:
            return "No user found with that email"

        auth_id = user_row["auth_user_id"]

        # Check they are a student
        role = get_user_role(auth_id)
        if role != "student" and role is not None:
            return "Only students can be added to organisations"

        # Check not already in an org
        existing = (
            client.table("organisation_members")
            .select("id")
            .eq("user_auth_id", auth_id)
            .limit(1)
            .execute()
        )
        if _first_row(existing):
            return "User is already a member of an organisation"

        # Add
        client.table("organisation_members").insert({
            "organisation_id": org_id,
            "user_auth_id": auth_id,
        }).execute()
        return None  # success
    except Exception as e:
        logger.error("add_member_by_email error: %s", e)
        return f"Failed to add member: {e}"


def remove_member(org_id: str, user_auth_id: str) -> bool:
    """Remove a student from an org."""
    try:
        client = _get_service_client()
        client.table("organisation_members").delete().eq(
            "organisation_id", org_id
        ).eq("user_auth_id", user_auth_id).execute()
        return True
    except Exception as e:
        logger.error("remove_member error: %s", e)
        return False


def join_org_by_invite_code(user_auth_id: str, invite_code: str) -> Optional[str]:
    """Join an org via invite code. Returns error message or None on success."""
    try:
        client = _get_service_client()

        # Check the user is a student
        role = get_user_role(user_auth_id)
        if role != "student" and role is not None:
            return "Only students can join organisations"

        # Check not already in an org
        existing = (
            client.table("organisation_members")
            .select("id")
            .eq("user_auth_id", user_auth_id)
            .limit(1)
            .execute()
        )
        if _first_row(existing):
            return "You are already a member of an organisation"

        # Find org by invite code
        org_result = (
            client.table("organisations")
            .select("id, name")
            .eq("invite_code", invite_code.upper().strip())
            .limit(1)
            .execute()
        )
        org_row = _first_row(org_result)
        if not org_row:
            return "Invalid invite code"

        # Add member
        client.table("organisation_members").insert({
            "organisation_id": org_row["id"],
            "user_auth_id": user_auth_id,
        }).execute()
        return None  # success
    except Exception as e:
        logger.error("join_org_by_invite_code error: %s", e)
        return f"Failed to join: {e}"


def regenerate_invite_code(org_id: str, manager_auth_id: str) -> Optional[str]:
    """Regenerate the invite code for an org. Returns the new code."""
    try:
        client = _get_service_client()
        new_code = _generate_invite_code()
        result = (
            client.table("organisations")
            .update({"invite_code": new_code, "updated_at": "now()"})
            .eq("id", org_id)
            .eq("manager_auth_id", manager_auth_id)
            .execute()
        )
        if result.data:
            return new_code
        return None
    except Exception as e:
        logger.error("regenerate_invite_code error: %s", e)
        return None


def get_all_organisations() -> List[Dict]:
    """Return all organisations with member counts (admin use)."""
    try:
        client = _get_service_client()
        orgs_result = (
            client.table("organisations")
            .select("*, organisation_members(id)")
            .order("created_at", desc=True)
            .execute()
        )
        orgs = []
        for org in (orgs_result.data or []):
            members = org.pop("organisation_members", [])
            org["member_count"] = len(members)
            orgs.append(org)
        return orgs
    except Exception as e:
        logger.error("get_all_organisations error: %s", e)
        return []


def delete_organisation(org_id: str) -> bool:
    """Delete an organisation. Members become unaffiliated (CASCADE on FK)."""
    try:
        client = _get_service_client()
        client.table("organisations").delete().eq("id", org_id).execute()
        return True
    except Exception as e:
        logger.error("delete_organisation error: %s", e)
        return False


def get_student_organisation(user_auth_id: str) -> Optional[Dict]:
    """Return the org a student belongs to, or None."""
    try:
        client = _get_service_client()
        member = (
            client.table("organisation_members")
            .select("organisation_id, joined_at, organisations(id, name, slug)")
            .eq("user_auth_id", user_auth_id)
            .limit(1)
            .execute()
        )
        member_row = _first_row(member)
        if member_row and member_row.get("organisations"):
            org = member_row["organisations"]
            org["joined_at"] = member_row["joined_at"]
            return org
        return None
    except Exception as e:
        logger.error("get_student_organisation error: %s", e)
        return None
