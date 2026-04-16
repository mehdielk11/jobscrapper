"""Scraper runner — runs all scrapers and saves results to Supabase.

Can be run as a script or called from the Streamlit UI.
"""

import importlib
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

from database.db_manager import save_job, save_scraper_log
from database.supabase_client import get_service_client
from nlp.skills_extractor import process_all_jobs

logger = logging.getLogger(__name__)

SCRAPERS: Dict[str, tuple] = {
    # Keys are lowercase to match the IDs the frontend sends via /api/scrape/{source}
    "rekrute":       ("scraper.rekrute_scraper",       "scrape"),
    "emploidiali":   ("scraper.emploidiali_scraper",    "scrape"),
    "emploi-public": ("scraper.emploipublic_scraper",   "scrape"),
    "marocannonces": ("scraper.marocannonces_scraper",  "scrape"),
    "indeed":        ("scraper.indeed_scraper",         "scrape"),
    "linkedin":      ("scraper.linkedin_scraper",       "scrape"),
}


def _resolve_source(source: str) -> str:
    """Resolve a source name to the canonical lowercase key, case-insensitively."""
    if source in SCRAPERS:
        return source
    lower = source.lower()
    if lower in SCRAPERS:
        return lower
    # Fuzzy match: strip hyphens and spaces
    for key in SCRAPERS:
        if key.replace("-", "").replace(" ", "") == lower.replace("-", "").replace(" ", ""):
            return key
    return source  # fails gracefully in run_single_scraper


def _update_run_status(
    run_id: str,
    status: str,
    jobs_found: int = 0,
    jobs_saved: int = 0,
    error_message: Optional[str] = None,
) -> None:
    """Write the final status of a scraper run back to the scraper_runs table.

    This UPDATE triggers the Supabase Realtime event that the frontend listens
    for, so the UI card transitions from 'running' to 'success'/'failed'.
    Silently ignores errors to never crash the scraper pipeline.
    """
    if not run_id:
        return
    try:
        client = get_service_client()
        payload: dict = {
            "status": status,
            "jobs_found": jobs_found,
            "jobs_saved": jobs_saved,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }
        if error_message:
            payload["error_message"] = error_message[:1000]  # guard DB column length
        client.table("scraper_runs").update(payload).eq("id", run_id).execute()
        logger.info(f"[runner] scraper_runs/{run_id} → {status} ({jobs_saved} saved)")
    except Exception as e:
        logger.warning(f"[runner] Failed to update scraper_runs/{run_id}: {e}")


def run_single_scraper(source: str, limit: int = 30, run_id: Optional[str] = None) -> int:
    """Run a specific scraper by source name (case-insensitive).

    Args:
        source: Scraper identifier (e.g. 'linkedin', 'indeed').
        limit:  Max jobs to fetch from this source.
        run_id: UUID of the scraper_runs row to update on completion.
                The frontend creates this row before calling the API.

    Returns:
        Number of jobs saved to the database.
    """
    source = _resolve_source(source)
    if source not in SCRAPERS:
        msg = f"Unknown scraper source: {source}"
        logger.error(msg)
        if run_id:
            save_scraper_log(run_id, "ERROR", msg, source=source)
            _update_run_status(run_id, "failed", error_message=msg)
        return 0

    module_path, func_name = SCRAPERS[source]
    logger.info(f"[{source}] Starting scraper (limit={limit})")
    if run_id:
        save_scraper_log(run_id, "INFO", f"Scraper started (limit={limit})", source=source)

    try:
        module = importlib.import_module(module_path)
        scrape_fn = getattr(module, func_name)
        jobs = scrape_fn(limit=limit)

        jobs_found = len(jobs)
        if run_id:
            save_scraper_log(
                run_id, "INFO",
                f"Found {jobs_found} jobs — saving to database...",
                source=source,
            )

        saved = 0
        for job in jobs:
            if save_job(job):
                saved += 1

        finish_msg = f"{source}: {saved}/{jobs_found} jobs saved"
        logger.info(f"[{source}] {finish_msg}")
        if run_id:
            save_scraper_log(run_id, "INFO", finish_msg, source=source)

        # ── Write success back to scraper_runs (triggers frontend Realtime) ──
        _update_run_status(run_id, "success", jobs_found=jobs_found, jobs_saved=saved)

        return saved

    except Exception as e:
        err_msg = f"{source} scraper failed: {e}"
        logger.error(err_msg, exc_info=True)
        if run_id:
            save_scraper_log(run_id, "ERROR", err_msg, source=source)
        # ── Write failure back to scraper_runs (triggers frontend Realtime) ──
        _update_run_status(run_id, "failed", error_message=err_msg)
        return 0


def run_all_scrapers(
    limit_per_source: int = 30,
    run_ids: Optional[Dict[str, str]] = None,
) -> Dict[str, int]:
    """Run all scrapers sequentially, save to Supabase.

    Args:
        limit_per_source: Max jobs per scraper source.
        run_ids: Optional map of source -> pre-created scraper_runs UUID.
                 When provided, each scraper's completion updates its row and
                 fires the Realtime UPDATE event the frontend listens for.

    Returns:
        Dict mapping source -> jobs saved.
    """
    run_ids = run_ids or {}
    summary: Dict[str, int] = {}
    for source in SCRAPERS:
        summary[source] = run_single_scraper(
            source,
            limit=limit_per_source,
            run_id=run_ids.get(source),
        )
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = run_all_scrapers(limit_per_source=20)
    for source, count in results.items():
        print(f"  {source}: {count} jobs")
