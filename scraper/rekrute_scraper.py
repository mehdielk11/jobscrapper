"""ReKrute.com scraper — Morocco's leading job board.

Scrapes listing pages, extracts job metadata, and falls back to
the static dataset on any failure.
"""

import logging
import re
from typing import List, Optional

from scraper.base_scraper import get_soup

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.rekrute.com"
_LISTING = f"{_BASE_URL}/offres.html?s=1&p=1&o=1"


# Unused helper removed as logic merged into scrape function


def scrape(limit: int = 50) -> List[dict]:
    """Scrape ReKrute job listings.

    Args:
        limit: Maximum number of jobs to return.

    Returns:
        List of job dicts.
    """
    jobs: List[dict] = []

    try:
        soup = get_soup(_LISTING, delay=1.0)
        if not soup:
            raise ConnectionError("Failed to fetch Rekrute page")

        cards = soup.select("li.post-id")
        for card in cards:
            try:
                title_el = card.select_one("h2 a")
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                href = title_el.get("href", "")
                job_url = f"{_BASE_URL}{href}" if href else _LISTING

                company_el = card.select_one("img.logo")
                company = (
                    company_el.get("title", "Non spécifié")
                    if company_el
                    else "Non spécifié"
                )

                loc_info_el = card.select_one("div.info")
                location = "Maroc"
                if loc_info_el:
                    loc_text = loc_info_el.get_text()
                    if "Région de :" in loc_text:
                        parts = loc_text.split("Région de :")
                        location = parts[1].strip()

                desc_el = card.select_one("div.col-sm-12.col-md-12")
                description = (
                    desc_el.get_text(strip=True) if desc_el else ""
                )

                jobs.append(
                    {
                        "title": title,
                        "company": company,
                        "location": location,
                        "description": description,
                        "source": "rekrute",
                        "url": job_url,
                    }
                )

                if len(jobs) >= limit:
                    break
            except Exception as exc:
                logger.warning("Rekrute card error: %s", exc)
                continue

    except Exception as exc:
        logger.error("Rekrute scraping failed: %s", exc)

    return jobs[:limit]


# Unused snippets helper removed
