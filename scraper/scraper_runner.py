"""Scraper runner — runs all scrapers and saves results to Supabase.

Can be run as a script or called from the Streamlit UI.
"""

import importlib
import logging
from typing import Dict

from database.db_manager import save_job
from nlp.skills_extractor import process_all_jobs

logger = logging.getLogger(__name__)

SCRAPERS: Dict[str, tuple] = {
    "ReKrute": ("scraper.rekrute_scraper", "scrape"),
    "EmploiDiali": ("scraper.emploidiali_scraper", "scrape"),
    "EmploiPublic": ("scraper.emploipublic_scraper", "scrape"),
    "MarocAnnonces": ("scraper.marocannonces_scraper", "scrape"),
    "Indeed": ("scraper.indeed_scraper", "scrape"),
    "LinkedIn": ("scraper.linkedin_scraper", "scrape"),
}


def run_all_scrapers(
    limit_per_source: int = 30,
) -> Dict[str, int]:
    """Run all scrapers, save to Supabase, and trigger skill extraction."""
    summary: Dict[str, int] = {}

    for name, (module_path, func_name) in SCRAPERS.items():
        logger.info("Running scraper: %s", name)
        try:
            module = importlib.import_module(module_path)
            scrape_fn = getattr(module, func_name)
            jobs = scrape_fn(limit=limit_per_source)
            saved = 0
            for job in jobs:
                if save_job(job):
                    saved += 1
            summary[name] = saved
            logger.info("%s: %d jobs saved", name, saved)
        except Exception as e:
            logger.error("%s scraper failed: %s", name, e)
            summary[name] = 0

    # Trigger skill extraction for new jobs
    logger.info("Triggering background skill extraction...")
    try:
        process_all_jobs()
    except Exception as e:
        logger.error("Skill extraction batch failed: %s", e)

    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = run_all_scrapers(limit_per_source=20)
    for source, count in results.items():
        print(f"  {source}: {count} jobs")
