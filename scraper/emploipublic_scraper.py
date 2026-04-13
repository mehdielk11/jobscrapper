"""Emploi-public.ma scraper — Moroccan public sector job postings.

Scrapes concours (public sector exams) listings. Falls back to the
static dataset if scraping fails.
"""

import logging
from typing import List

from scraper.base_scraper import get_soup, load_static_fallback

logger = logging.getLogger(__name__)

_BASE = "https://www.emploi-public.ma"
_LISTING = f"{_BASE}/fr/concoursListe.asp"


def scrape(limit: int = 50) -> List[dict]:
    """Scrape emploi-public.ma concours listings.

    Args:
        limit: Maximum number of jobs to return.

    Returns:
        List of job dicts.
    """
    jobs: List[dict] = []

    try:
        soup = get_soup(_LISTING)
        if not soup:
            raise ConnectionError("Failed to fetch listing page")

        # The page uses table-based layout for listings
        rows = soup.select("table tr")
        if not rows:
            # Try alternative selectors
            rows = soup.select("div.concours-item, li.concours")

        for row in rows:
            try:
                # Look for links within each row
                link = row.select_one("a[href]")
                if not link:
                    continue

                title = link.get_text(strip=True)
                if not title or len(title) < 10:
                    continue

                href = link.get("href", "")
                job_url = (
                    href
                    if href.startswith("http")
                    else _BASE + "/" + href.lstrip("/")
                )

                # Extract cells for company/administration
                cells = row.select("td")
                company = (
                    cells[1].get_text(strip=True)
                    if len(cells) > 1
                    else "Administration publique"
                )
                location = (
                    cells[2].get_text(strip=True)
                    if len(cells) > 2
                    else "Maroc"
                )

                jobs.append(
                    {
                        "title": title,
                        "company": company,
                        "location": location,
                        "description": title,
                        "source": "emploi-public",
                        "url": job_url,
                    }
                )

                if len(jobs) >= limit:
                    break
            except Exception as exc:
                logger.warning("EmploiPublic row error: %s", exc)
                continue

    except Exception as exc:
        logger.error("EmploiPublic scraping failed: %s", exc)

    if not jobs:
        logger.warning("EmploiPublic: no jobs scraped, using fallback.")
        fallback = load_static_fallback()
        jobs = [
            j for j in fallback if j.get("source") == "emploi-public"
        ]

    return jobs[:limit]
