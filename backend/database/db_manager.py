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
    Always resets nlp_status='pending' on upsert so the NLP pipeline
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
                    # Without this, existing rows keep their old nlp_status
                    # and the NLP pipeline silently skips them.
                    "nlp_status": "pending",
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


def get_all_jobs(diplomas: List[str] = None, date_posted_gte: str = None) -> List[dict]:
    """Return all jobs with their extracted skills list.

    Uses service-role client to bypass RLS \u2014 same reason as get_jobs_without_skills.
    """
    try:
        client = _get_service_client()
        query = client.table("jobs").select("*, job_skills(skill)")
        
        if date_posted_gte:
            query = query.gte("scraped_at", date_posted_gte)

        jobs_result = query.execute()
        
        jobs = []
        for job in jobs_result.data:
            desc = job.get("description", "").lower()
            
            # Apply diploma filter in python to allow fuzzy matching
            if diplomas and len(diplomas) > 0:
                matched = False
                for d in diplomas:
                    if d.lower() in desc:
                        matched = True
                        break
                    # specific handle for variations
                    if "bac+2" in d.lower() and ("bac +2" in desc or "bac + 2" in desc): matched = True
                    if "bac+3" in d.lower() and ("bac +3" in desc or "bac + 3" in desc or "licence" in desc): matched = True
                    if "bac+5" in d.lower() and ("bac +5" in desc or "bac + 5" in desc or "master" in desc or "ingénieur" in desc or "ingenieur" in desc): matched = True
                    if "doctorat" in d.lower() and ("phd" in desc or "doctorat" in desc): matched = True
                
                if not matched:
                    continue

            job["skills"] = [s["skill"] for s in job.get("job_skills", [])]
            jobs.append(job)
        return jobs
    except Exception as e:
        logger.error("get_all_jobs error: %s", e)
        return []


def get_jobs_without_skills(limit: int = 500, target_status: str = "pending") -> List[dict]:
    """Return jobs matching the given NLP status for (re)processing.

    Uses the service-role client to bypass RLS — the anon client silently
    filters rows when RLS policies restrict read access, which caused the
    extractor to only see a fraction of unprocessed jobs.

    Args:
        limit: Max rows to fetch per call (safety guard against huge batches).
        target_status: Which nlp_status to target ('pending', 'failed', 'no_skills_found').
    """
    try:
        client = _get_service_client()
        result = (
            client.table("jobs")
            .select("id, title, description")
            .eq("nlp_status", target_status)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error("get_jobs_without_skills error: %s", e)
        return []


# ─── ENRICHMENT ──────────────────────────────────────────────────────────────


def get_jobs_for_enrichment(target_status: str = "no_skills_found", limit: int = 100) -> List[dict]:
    """Return jobs that need description enrichment.

    Args:
        target_status: Which nlp_status to target.
        limit: Max rows per batch (safety guard).
    """
    try:
        client = _get_service_client()
        result = (
            client.table("jobs")
            .select("id, url, source, description")
            .eq("nlp_status", target_status)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error("get_jobs_for_enrichment error: %s", e)
        return []


def update_job_description(job_id: str, description: str) -> bool:
    """Update a job's description with enriched text and reset nlp_status to pending."""
    try:
        client = _get_service_client()
        client.table("jobs").update({
            "description": description[:5000],
            "nlp_status": "pending",
        }).eq("id", job_id).execute()
        return True
    except Exception as e:
        logger.error("update_job_description error for %s: %s", job_id, e)
        return False


def update_enrichment_status(status: str, total: int = 0, processed: int = 0) -> None:
    """Update the global enrichment processing status in app_config."""
    try:
        client = _get_service_client()
        import datetime
        client.table("app_config").upsert({
            "key": "enrichment_status",
            "value": {
                "status": status,
                "total": total,
                "processed": processed,
                "updated_at": datetime.datetime.now().isoformat()
            }
        }).execute()
    except Exception as e:
        logger.error("update_enrichment_status error: %s", e)


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


def mark_job_nlp_status(job_id: str, status: str = "extracted") -> bool:
    """Update a job's NLP processing status.
    
    Valid statuses: 'pending', 'extracted', 'no_skills_found', 'failed'
    """
    try:
        client = _get_service_client()
        client.table("jobs").update({"nlp_status": status}).eq("id", job_id).execute()
        return True
    except Exception as e:
        logger.error("mark_job_nlp_status error for %s: %s", job_id, e)
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


def admin_update_user_password(auth_user_id: str, new_password: str) -> bool:
    """Update a user's password via the Supabase Admin API (service role)."""
    try:
        client = _get_service_client()
        client.auth.admin.update_user_by_id(
            auth_user_id,
            {"password": new_password},
        )
        return True
    except Exception as e:
        logger.error("admin_update_user_password error for %s: %s", auth_user_id, e)
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


def get_org_analytics(org_id: str) -> Dict:
    """Compute hybrid analytics: org health + market gap analysis.

    Cross-references org member skills against job market demand to produce
    actionable intelligence for academic managers.
    """
    _EMPTY = {
        "total_members": 0,
        "members_with_skills": 0,
        "avg_skills_per_member": 0,
        "profile_completion_pct": 0,
        "market_readiness_pct": 0,
        "skill_gap_count": 0,
        "org_strengths": [],
        "skill_gaps": [],
        "student_readiness": [],
        "readiness_distribution": [],
        "top_org_skills": [],
        "top_demand_skills": [],
        "member_growth": [],
        "recommendations": [],
    }
    try:
        client = _get_service_client()

        # ── 1. Org members ────────────────────────────────────────────────
        members_result = (
            client.table("organisation_members")
            .select("user_auth_id, joined_at")
            .eq("organisation_id", org_id)
            .execute()
        )
        members = members_result.data or []
        total_members = len(members)
        if total_members == 0:
            return _EMPTY

        auth_ids = [m["user_auth_id"] for m in members]
        joined_map = {m["user_auth_id"]: m["joined_at"] for m in members}

        # ── 2. User profiles ──────────────────────────────────────────────
        users_result = (
            client.table("users")
            .select("id, auth_user_id, first_name, last_name, email")
            .in_("auth_user_id", auth_ids)
            .execute()
        )
        users = users_result.data or []
        uid_to_profile = {u["auth_user_id"]: u for u in users}
        uid_to_internal = {u["auth_user_id"]: u["id"] for u in users}
        internal_ids = list(uid_to_internal.values())

        # ── 3. User skills ────────────────────────────────────────────────
        skills_result = (
            client.table("user_skills")
            .select("user_id, skill")
            .in_("user_id", internal_ids)
            .execute()
        )
        all_user_skills = skills_result.data or []

        # Build per-user skill sets (normalised lowercase)
        user_skill_sets: Dict[str, set] = {}
        org_skill_counts: Dict[str, int] = {}
        for s in all_user_skills:
            skill_lower = s["skill"].lower().strip()
            user_skill_sets.setdefault(s["user_id"], set()).add(skill_lower)
            org_skill_counts[skill_lower] = org_skill_counts.get(skill_lower, 0) + 1

        members_with_skills = len(user_skill_sets)
        total_entries = len(all_user_skills)
        avg_skills = round(total_entries / total_members, 1) if total_members else 0
        profile_completion = round((members_with_skills / total_members) * 100)

        all_org_skills = set()
        for sk_set in user_skill_sets.values():
            all_org_skills.update(sk_set)

        # ── 4. Job market demand (global) ─────────────────────────────────
        job_skills_result = (
            client.table("job_skills")
            .select("skill")
            .limit(10000)
            .execute()
        )
        demand_counts: Dict[str, int] = {}
        for js in (job_skills_result.data or []):
            sk = js["skill"].lower().strip()
            demand_counts[sk] = demand_counts.get(sk, 0) + 1

        top_demand = sorted(demand_counts.items(), key=lambda x: x[1], reverse=True)
        TOP_N = 30
        top_demand_set = set(sk for sk, _ in top_demand[:TOP_N])

        # ── 5. Market readiness ───────────────────────────────────────────
        overlap = all_org_skills & top_demand_set
        gaps = top_demand_set - all_org_skills
        benchmark = min(TOP_N, len(top_demand_set)) or 1
        market_readiness_pct = round((len(overlap) / benchmark) * 100)

        # Org strengths: skills org has that are also in market demand
        org_strengths = []
        for sk in sorted(overlap, key=lambda s: demand_counts.get(s, 0), reverse=True):
            org_strengths.append({
                "skill": sk,
                "org_count": org_skill_counts.get(sk, 0),
                "demand_count": demand_counts.get(sk, 0),
            })

        # Skill gaps: top demanded skills org is missing
        skill_gaps = []
        for sk, _ in top_demand[:TOP_N]:
            if sk in gaps:
                skill_gaps.append({
                    "skill": sk,
                    "demand_count": demand_counts.get(sk, 0),
                })

        # ── 6. Per-student readiness (full transparency) ──────────────────
        student_readiness = []
        internal_to_auth = {v: k for k, v in uid_to_internal.items()}
        for internal_id in internal_ids:
            auth_id = internal_to_auth.get(internal_id, "")
            profile = uid_to_profile.get(auth_id, {})
            student_skills = user_skill_sets.get(internal_id, set())
            matched = student_skills & top_demand_set
            match_pct = round((len(matched) / benchmark) * 100) if benchmark else 0

            if match_pct >= 50:
                tier = "high"
            elif match_pct >= 20:
                tier = "medium"
            else:
                tier = "low"

            student_readiness.append({
                "name": f"{profile.get('first_name') or ''} {profile.get('last_name') or ''}".strip() or profile.get("email", "Unknown"),
                "email": profile.get("email", ""),
                "skills_count": len(student_skills),
                "matched_count": len(matched),
                "readiness_pct": match_pct,
                "tier": tier,
                "joined_at": joined_map.get(auth_id),
            })
        student_readiness.sort(key=lambda s: s["readiness_pct"], reverse=True)

        # Readiness distribution
        tier_counts = {"high": 0, "medium": 0, "low": 0}
        for sr in student_readiness:
            tier_counts[sr["tier"]] += 1
        readiness_distribution = [
            {"tier": "High (≥50%)", "count": tier_counts["high"]},
            {"tier": "Medium (20-49%)", "count": tier_counts["medium"]},
            {"tier": "Low (<20%)", "count": tier_counts["low"]},
        ]

        # ── 7. Top org skills + top demand skills (for overlay chart) ─────
        top_org_skills = sorted(org_skill_counts.items(), key=lambda x: x[1], reverse=True)[:15]
        top_org_list = [{"skill": s, "count": c} for s, c in top_org_skills]
        top_demand_list = [{"skill": s, "count": c} for s, c in top_demand[:15]]

        # ── 8. Member growth (cumulative) ─────────────────────────────────
        month_counts: Dict[str, int] = {}
        for m in members:
            if m.get("joined_at"):
                mk = m["joined_at"][:7]
                month_counts[mk] = month_counts.get(mk, 0) + 1
        sorted_months = sorted(month_counts.keys())
        cumulative = 0
        member_growth = []
        for mk in sorted_months:
            cumulative += month_counts[mk]
            member_growth.append({"month": mk, "count": cumulative})

        # ── 9. Static rules-based recommendations ────────────────────────
        recommendations = []

        zero_skill_count = total_members - members_with_skills
        if zero_skill_count > 0:
            recommendations.append({
                "type": "warning",
                "title": "Incomplete Profiles",
                "message": f"{zero_skill_count} member{'s' if zero_skill_count != 1 else ''} "
                           f"{'have' if zero_skill_count != 1 else 'has'} not added any skills. "
                           "Encourage them to complete their profile for better job matching.",
            })

        if skill_gaps:
            top_gap = skill_gaps[0]["skill"]
            gap_demand = skill_gaps[0]["demand_count"]
            recommendations.append({
                "type": "gap",
                "title": f"\"{top_gap.title()}\" is in High Demand",
                "message": f"This skill appears in {gap_demand} job listings but no member "
                           "in your organisation has it. Consider offering training or workshops.",
            })

        if len(skill_gaps) > 3:
            gap_names = ", ".join(g["skill"].title() for g in skill_gaps[1:4])
            recommendations.append({
                "type": "gap",
                "title": "Multiple Skill Gaps Detected",
                "message": f"Your organisation is also missing market demand for: {gap_names}. "
                           "Addressing these gaps could significantly improve student employability.",
            })

        if org_strengths:
            best = org_strengths[0]
            recommendations.append({
                "type": "strength",
                "title": f"Strong in \"{best['skill'].title()}\"",
                "message": f"{best['org_count']} member{'s' if best['org_count'] != 1 else ''} "
                           f"{'have' if best['org_count'] != 1 else 'has'} this skill, which appears in "
                           f"{best['demand_count']} job listings. This is a competitive advantage.",
            })

        if market_readiness_pct >= 60:
            recommendations.append({
                "type": "success",
                "title": "Good Market Alignment",
                "message": f"Your organisation covers {market_readiness_pct}% of the top {benchmark} "
                           "demanded skills. Your students are well-positioned for the job market.",
            })
        elif market_readiness_pct < 30 and len(top_demand_set) > 0:
            recommendations.append({
                "type": "critical",
                "title": "Low Market Readiness",
                "message": f"Only {market_readiness_pct}% of top demanded skills are covered. "
                           "Significant curriculum adjustments may be needed to improve employability.",
            })

        return {
            "total_members": total_members,
            "members_with_skills": members_with_skills,
            "avg_skills_per_member": avg_skills,
            "profile_completion_pct": profile_completion,
            "market_readiness_pct": market_readiness_pct,
            "skill_gap_count": len(skill_gaps),
            "org_strengths": org_strengths,
            "skill_gaps": skill_gaps,
            "student_readiness": student_readiness,
            "readiness_distribution": readiness_distribution,
            "top_org_skills": top_org_list,
            "top_demand_skills": top_demand_list,
            "member_growth": member_growth,
            "recommendations": recommendations,
        }
    except Exception as e:
        logger.error("get_org_analytics error: %s", e)
        return _EMPTY


# ─── MANAGER APPLICATIONS ────────────────────────────────────────────────────


def submit_application(data: Dict) -> Optional[Dict]:
    """Insert a new manager application. Returns the row or None."""
    try:
        client = _get_service_client()
        result = (
            client.table("manager_applications")
            .insert(data)
            .execute()
        )
        return _first_row(result)
    except Exception as e:
        logger.error("submit_application error: %s", e)
        return None


def get_application_by_id(app_id: str) -> Optional[Dict]:
    """Fetch a single application by ID."""
    try:
        client = _get_service_client()
        result = (
            client.table("manager_applications")
            .select("*")
            .eq("id", app_id)
            .limit(1)
            .execute()
        )
        return _first_row(result)
    except Exception as e:
        logger.error("get_application_by_id error: %s", e)
        return None


def get_application_by_email(email: str) -> Optional[Dict]:
    """Check if an application already exists for this email."""
    try:
        client = _get_service_client()
        result = (
            client.table("manager_applications")
            .select("id, status")
            .eq("email", email.lower().strip())
            .limit(1)
            .execute()
        )
        return _first_row(result)
    except Exception as e:
        logger.error("get_application_by_email error: %s", e)
        return None


def list_applications(
    status: str = "pending", page: int = 1, page_size: int = 20
) -> Dict:
    """Paginated list of applications for admin review."""
    try:
        client = _get_service_client()
        offset = (page - 1) * page_size

        query = client.table("manager_applications").select(
            "id, first_name, last_name, email, org_name, org_type, "
            "org_description, org_website, expected_students, "
            "submitted_at, reviewed_at, status, review_note",
            count="exact",
        )

        if status != "all":
            query = query.eq("status", status)

        result = (
            query
            .order("submitted_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        return {
            "items": result.data or [],
            "total": result.count or 0,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        logger.error("list_applications error: %s", e)
        return {"items": [], "total": 0, "page": page, "page_size": page_size}


def count_pending_applications() -> int:
    """Return the number of pending applications (for sidebar badge)."""
    try:
        client = _get_service_client()
        result = (
            client.table("manager_applications")
            .select("id", count="exact")
            .eq("status", "pending")
            .execute()
        )
        return result.count or 0
    except Exception as e:
        logger.error("count_pending_applications error: %s", e)
        return 0


def update_application_status(
    app_id: str, status: str, reviewed_by: str,
    review_note: Optional[str] = None,
) -> bool:
    """Update an application's status (approve/reject)."""
    try:
        client = _get_service_client()
        import datetime
        payload = {
            "status": status,
            "reviewed_by": reviewed_by,
            "reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        if review_note is not None:
            payload["review_note"] = review_note

        client.table("manager_applications").update(payload).eq("id", app_id).execute()
        return True
    except Exception as e:
        logger.error("update_application_status error: %s", e)
        return False


def delete_application(app_id: str) -> bool:
    """Delete an application."""
    try:
        client = _get_service_client()
        client.table("manager_applications").delete().eq("id", app_id).execute()
        return True
    except Exception as e:
        logger.error("delete_application error: %s", e)
        return False


def email_exists_in_auth(email: str) -> bool:
    """Check if an email is already registered in Supabase Auth."""
    try:
        client = _get_service_client()
        # List users filtered by email — admin API
        users = client.auth.admin.list_users()
        for u in users:
            if hasattr(u, 'email') and u.email and u.email.lower() == email.lower().strip():
                return True
        return False
    except Exception as e:
        logger.error("email_exists_in_auth error: %s", e)
        return False


# ─── ACTIVATION TOKENS ───────────────────────────────────────────────────────


def store_activation_token(
    application_id: str, auth_user_id: str, email: str,
    token_hash: str, expires_at: str,
) -> bool:
    """Store a hashed activation token."""
    try:
        client = _get_service_client()
        client.table("activation_tokens").insert({
            "application_id": application_id,
            "auth_user_id": auth_user_id,
            "email": email,
            "token_hash": token_hash,
            "expires_at": expires_at,
        }).execute()
        return True
    except Exception as e:
        logger.error("store_activation_token error: %s", e)
        return False


def get_activation_token_by_hash(token_hash: str) -> Optional[Dict]:
    """Look up an activation token by its SHA-256 hash."""
    try:
        client = _get_service_client()
        result = (
            client.table("activation_tokens")
            .select("*")
            .eq("token_hash", token_hash)
            .limit(1)
            .execute()
        )
        return _first_row(result)
    except Exception as e:
        logger.error("get_activation_token_by_hash error: %s", e)
        return None


def mark_activation_token_used(token_id: str) -> bool:
    """Mark an activation token as used."""
    try:
        client = _get_service_client()
        import datetime
        client.table("activation_tokens").update({
            "used_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }).eq("id", token_id).execute()
        return True
    except Exception as e:
        logger.error("mark_activation_token_used error: %s", e)
        return False


def create_auth_user_no_password(email: str) -> Optional[str]:
    """Create a Supabase Auth user with email confirmed but no usable password.

    Returns the auth user ID or None.
    """
    try:
        client = _get_service_client()
        # Generate a long random password the user will never know —
        # they'll set their real password via the activation flow.
        import uuid
        temp_password = f"TEMP-{uuid.uuid4().hex}-{uuid.uuid4().hex}"
        auth_resp = client.auth.admin.create_user({
            "email": email,
            "password": temp_password,
            "email_confirm": True,
        })
        return str(auth_resp.user.id)
    except Exception as e:
        logger.error("create_auth_user_no_password error: %s", e)
        return None


