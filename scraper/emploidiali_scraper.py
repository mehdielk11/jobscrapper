"""EmploiDiali.ma scraper — Moroccan job board.

Scrapes listing pages from emploidiali.ma and extracts job metadata.
Falls back to the static dataset if scraping fails.
"""

import logging
from typing import List

from scraper.base_scraper import get_soup, load_static_fallback

logger = logging.getLogger(__name__)

_BASE = "https://www.emploidiali.ma"
_LISTING = f"{_BASE}/offres-emploi"


def scrape(limit: int = 50) -> List[dict]:
    """Scrape EmploiDiali job listings.

    Args:
        limit: Maximum number of jobs to return.

    Returns:
        List of job dicts.
    """
    jobs: List[dict] = []
    max_pages = max(1, limit // 20 + 1)

    try:
        for page in range(1, max_pages + 1):
            url = f"{_LISTING}?page={page}" if page > 1 else _LISTING
            logger.info("EmploiDiali page %d: %s", page, url)

            soup = get_soup(url)
            if not soup:
                break

            # Try multiple selectors since the site may vary
            cards = soup.select("div.job-item, article.job-listing")
            if not cards:
                # Fallback to any article elements
                cards = soup.select("article")
            if not cards:
                break

            for card in cards:
                try:
                    # Title
                    title_el = card.select_one("h2 a, h3 a, a.job-title")
                    if not title_el:
                        continue
                    title = title_el.get_text(strip=True)
                    href = title_el.get("href", "")
                    job_url = (
                        href
                        if href.startswith("http")
                        else _BASE + href
                    )

                    # Company
                    company_el = card.select_one(
                        ".company-name, .employer, span.company"
                    )
                    company = (
                        company_el.get_text(strip=True)
                        if company_el
                        else "Non spécifié"
                    )

                    # Location
                    loc_el = card.select_one(
                        ".location, .job-location, span.location"
                    )
                    location = (
                        loc_el.get_text(strip=True)
                        if loc_el
                        else ""
                    )

                    # Description snippet
                    desc_el = card.select_one(
                        ".description, .job-description, p"
                    )
                    description = (
                        desc_el.get_text(strip=True)
                        if desc_el
                        else ""
                    )

                    jobs.append(
                        {
                            "title": title,
                            "company": company,
                            "location": location,
                            "description": description,
                            "source": "emploidiali",
                            "url": job_url,
                        }
                    )

                    if len(jobs) >= limit:
                        break
                except Exception as exc:
                    logger.warning("EmploiDiali card error: %s", exc)
                    continue

            if len(jobs) >= limit:
                break

    except Exception as exc:
        logger.error("EmploiDiali scraping failed: %s", exc)

    if not jobs:
        logger.warning("EmploiDiali: no jobs scraped, using fallback.")
        fallback = load_static_fallback()
        jobs = [
            j for j in fallback if j.get("source") == "emploidiali"
        ]

    return jobs[:limit]
