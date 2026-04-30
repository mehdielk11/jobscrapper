"""Enrichment Agent — visits individual job URLs to extract full descriptions.

Stage 2 of the 3-stage pipeline: scrape → enrich → NLP extract.
Fetches richer description text from each job's detail page, grouped by source,
with polite delays and retry-backoff to avoid rate limiting.

Priority: Reliability > Stability > Speed.
"""

import logging
import threading
import random
import time
from typing import Optional

from scraper.base_scraper import fetch_soup, make_session, human_delay, clean_text
from database.db_manager import (
    get_jobs_for_enrichment,
    update_job_description,
    update_enrichment_status,
    save_scraper_log,
)

logger = logging.getLogger(__name__)

_enrichment_lock = threading.Lock()

# ── Source-specific detail parsers ────────────────────────────────────────────


def _parse_rekrute_detail(url: str, session) -> str:
    """Extract description from a ReKrute job detail page.

    Target: div.contentbloc — specifically sections 'Entreprise :', 'Poste :',
    'Profil recherché :'.
    """
    soup = fetch_soup(url, session=session, delay=2.0)
    if not soup:
        return ""

    content_bloc = soup.find("div", class_="contentbloc")
    if not content_bloc:
        # Fallback: try broader selectors
        content_bloc = (
            soup.find("div", id=lambda i: i and "detail" in i.lower() if i else False)
            or soup.find("div", class_="col-sm-8")
        )

    if not content_bloc:
        return ""

    return clean_text(content_bloc.get_text(separator=" ", strip=True))[:5000]


def _parse_marocannonces_detail(url: str, session) -> str:
    """Extract description from a MarocAnnonces job detail page.

    Target: div.description.desccatemploi
    """
    soup = fetch_soup(url, session=session, delay=2.0)
    if not soup:
        return ""

    desc_el = soup.find("div", class_="description desccatemploi")
    if not desc_el:
        # Fallback
        desc_el = soup.find("div", class_=lambda c: c and "description" in c if c else False)

    if not desc_el:
        return ""

    return clean_text(desc_el.get_text(separator=" ", strip=True))[:5000]


def _parse_emploipublic_detail(url: str, session) -> str:
    """Extract description from an Emploi-Public job detail page.

    Target: div.col-12.col-md-8 — specifically 'Spécialité :' and 'Grade :'
    """
    soup = fetch_soup(url, session=session, delay=2.0)
    if not soup:
        return ""

    content_el = soup.find("div", class_="col-12 col-md-8")
    if not content_el:
        content_el = soup.find("div", class_="col-md-8")

    if not content_el:
        return ""

    return clean_text(content_el.get_text(separator=" ", strip=True))[:5000]


def _parse_linkedin_detail(url: str) -> str:
    """Extract description from a LinkedIn job detail page via Playwright.

    Best-effort — LinkedIn aggressively blocks unauthenticated fetches.
    """
    try:
        from playwright.sync_api import sync_playwright
        from scraper.base_scraper import get_playwright_page
    except ImportError:
        logger.warning("[Enrichment] Playwright not available for LinkedIn enrichment")
        return ""

    try:
        with sync_playwright() as p:
            browser, context, page = get_playwright_page(p, headless=True)
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=20000)
                human_delay(2.0, 4.0)

                # Detect login wall
                if "linkedin.com/login" in page.url or "authwall" in page.url:
                    logger.debug("[Enrichment] LinkedIn authwall — skipping")
                    return ""

                desc_el = page.query_selector(
                    "div.show-more-less-html__markup, "
                    "div.description__text, "
                    "section.show-more-less-html"
                )
                return desc_el.inner_text().strip()[:5000] if desc_el else ""
            finally:
                browser.close()
    except Exception as e:
        logger.debug("[Enrichment] LinkedIn detail fetch error for %s: %s", url, e)
        return ""


# ── Parser routing ────────────────────────────────────────────────────────────

_SOURCE_PARSERS = {
    "ReKrute":       lambda url, session: _parse_rekrute_detail(url, session),
    "MarocAnnonces": lambda url, session: _parse_marocannonces_detail(url, session),
    "Emploi-Public": lambda url, session: _parse_emploipublic_detail(url, session),
    "LinkedIn":      lambda url, session: _parse_linkedin_detail(url),  # session unused
}


def _polite_delay():
    """Random delay between 2-4 seconds to respect rate limits."""
    time.sleep(random.uniform(2.0, 4.0))


# ── Main enrichment loop ─────────────────────────────────────────────────────


def enrich_all_jobs(target_status: str = "no_skills_found", limit: int = 500) -> None:
    """Visit individual job URLs and enrich their descriptions.

    Protected by a singleton lock to prevent concurrent enrichment runs.

    Args:
        target_status: Which nlp_status to target.
        limit: Max jobs to process per run.
    """
    if not _enrichment_lock.acquire(blocking=False):
        logger.info("Enrichment already in progress. Skipping.")
        save_scraper_log(None, "WARNING", "Enrichment already running — skipped.", source="enrichment")
        return

    try:
        jobs = get_jobs_for_enrichment(target_status=target_status, limit=limit)

        if not jobs:
            logger.info("No '%s' jobs to enrich.", target_status)
            save_scraper_log(None, "INFO", f"Enrichment: No '{target_status}' jobs to enrich.", source="enrichment")
            update_enrichment_status("idle", total=0, processed=0)
            return

        # Sort by source so same-domain requests are sequential (better session reuse)
        jobs.sort(key=lambda j: j.get("source", ""))

        total = len(jobs)
        enriched = 0
        skipped = 0
        failed = 0

        logger.info("Enrichment started: %d '%s' jobs.", total, target_status)
        update_enrichment_status("processing", total=total, processed=0)
        save_scraper_log(None, "INFO", f"Enrichment started: {total} '{target_status}' jobs.", source="enrichment")

        # One session per source for connection reuse
        sessions: dict = {}
        current_source = None

        for i, job in enumerate(jobs):
            source = job.get("source", "unknown")
            url = job.get("url", "")
            job_id = job["id"]

            if not url:
                skipped += 1
                continue

            # Get/create a session for this source
            if source != current_source:
                current_source = source
                if source not in sessions:
                    sessions[source] = make_session()

            parser = _SOURCE_PARSERS.get(source)
            if not parser:
                skipped += 1
                continue

            try:
                new_desc = parser(url, sessions.get(source))
                old_desc = job.get("description", "")

                # Only update if we got meaningfully more content
                if new_desc and len(new_desc) > len(old_desc):
                    update_job_description(job_id, new_desc)
                    enriched += 1
                else:
                    skipped += 1

            except Exception as e:
                logger.error("Enrichment failed for job %s (%s): %s", job_id, url, e)
                failed += 1

            # Progress update every 5 jobs
            if (i + 1) % 5 == 0 or (i + 1) == total:
                update_enrichment_status("processing", total=total, processed=i + 1)

            # Polite delay between requests
            _polite_delay()

        update_enrichment_status("idle", total=total, processed=total)
        save_scraper_log(
            None, "INFO",
            f"Enrichment finished. Enriched: {enriched}, Skipped: {skipped}, Failed: {failed} / {total} total.",
            source="enrichment",
        )
        logger.info(
            "Enrichment complete. Enriched: %d, Skipped: %d, Failed: %d / %d total.",
            enriched, skipped, failed, total,
        )

    finally:
        _enrichment_lock.release()
