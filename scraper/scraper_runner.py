"""Scraper runner — runs all scrapers and saves results to Supabase.

Can be run as a script or called from the Streamlit UI.
"""

import importlib
import logging
from typing import Dict

from database.db_manager import save_job, save_scraper_log
from nlp.skills_extractor import process_all_jobs

logger = logging.getLogger(__name__)

SCRAPERS: Dict[str, tuple] = {
    "rekrute": ("scraper.rekrute_scraper", "scrape"),
    "emploidiali": ("scraper.emploidiali_scraper", "scrape"),
    "emploi-public": ("scraper.emploipublic_scraper", "scrape"),
    "marocannonces": ("scraper.marocannonces_scraper", "scrape"),
    "indeed": ("scraper.indeed_scraper", "scrape"),
    "linkedin": ("scraper.linkedin_scraper", "scrape"),
}


def run_single_scraper(source: str, limit: int = 30, run_id: str = None) -> int:
    """Run a specific scraper by source name."""
    if source not in SCRAPERS:
        msg = f"Unknown scraper source: {source}"
        logger.error(msg)
        if run_id:
            save_scraper_log(run_id, "ERROR", msg)
        return 0
    
    module_path, func_name = SCRAPERS[source]
    msg = f"Running scraper: {source}"
    logger.info(msg)
    if run_id:
        save_scraper_log(run_id, "INFO", msg)

    try:
        module = importlib.import_module(module_path)
        scrape_fn = getattr(module, func_name)
        jobs = scrape_fn(limit=limit)
        
        if run_id:
            save_scraper_log(run_id, "INFO", f"Found {len(jobs)} potential jobs. Starting processing...")

        saved = 0
        for job in jobs:
            if save_job(job):
                saved += 1
        
        finish_msg = f"{source}: {saved} jobs saved/updated"
        logger.info(finish_msg)
        if run_id:
            save_scraper_log(run_id, "INFO", finish_msg)
            
        return saved
    except Exception as e:
        err_msg = f"{source} scraper failed: {str(e)}"
        logger.error(err_msg)
        if run_id:
            save_scraper_log(run_id, "ERROR", err_msg)
        return 0


def run_all_scrapers(
    limit_per_source: int = 30,
) -> Dict[str, int]:
    """Run all scrapers, save to Supabase, and trigger skill extraction."""
    summary: Dict[str, int] = {}

    for source in SCRAPERS.keys():
        summary[source] = run_single_scraper(source, limit_per_source)

    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = run_all_scrapers(limit_per_source=20)
    for source, count in results.items():
        print(f"  {source}: {count} jobs")
