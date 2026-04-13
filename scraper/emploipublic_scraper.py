"""Emploi-public.ma scraper — Moroccan public sector job postings.

Scrapes concours (public sector exams) listings.
"""

import logging
from typing import List

from scraper.base_scraper import get_soup_playwright

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.emploi-public.ma"
_LISTING = f"{_BASE_URL}/fr/concoursListe.asp"

def scrape(limit: int = 50) -> List[dict]:
    """Attempt to scrape Emploi-Public.

    Args:
        limit: Maximum number of jobs to return.

    Returns:
        List of job dicts.
    """
    jobs: List[dict] = []

    try:
        soup = get_soup_playwright(_LISTING, delay=2.0)
        if not soup:
            raise ConnectionError("Failed to fetch Emploi-Public page")

        # confirmed card selector: a.card.card-scale
        cards = soup.select("a.card.card-scale")

        for card in cards:
            try:
                title_el = card.select_one("h2")
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                href = card.get("href", "")
                job_url = (
                    href
                    if href.startswith("http")
                    else f"{_BASE_URL}{href}"
                )

                # Ministry/Administration name is usually in the div following h2
                company_el = card.select_one("h2 + div")
                company = (
                    company_el.get_text(strip=True)
                    if company_el
                    else "Administration Publique"
                )

                location = "Maroc"
                # Check for location in meta info
                meta_el = card.select_one(".fa-calendar-alt + span") # Placeholder logic if location exists near calendar
                
                jobs.append(
                    {
                        "title": title,
                        "company": company,
                        "location": location,
                        "description": f"Concours: {title}",
                        "source": "emploipublic",
                        "url": job_url,
                    }
                )

                if len(jobs) >= limit:
                    break
            except Exception as exc:
                logger.warning("EmploiPublic card error: %s", exc)
                continue

    except Exception as exc:
        logger.error("EmploiPublic scraping failed: %s", exc)

    return jobs[:limit]
