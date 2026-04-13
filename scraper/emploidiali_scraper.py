"""EmploiDiali.ma scraper — Moroccan job board.

Scrapes listing pages from emploidiali.ma and extracts job metadata.
"""

import logging
from typing import List

from scraper.base_scraper import get_soup_playwright

logger = logging.getLogger(__name__)

_BASE_URL = "https://emploidiali.ma"
_LISTING = f"{_BASE_URL}/offres-emploi-maroc/"


def scrape(limit: int = 50) -> List[dict]:
    """Attempt to scrape EmploiDiali.

    Args:
        limit: Maximum number of jobs to return.

    Returns:
        List of job dicts.
    """
    jobs: List[dict] = []

    try:
        soup = get_soup_playwright(_LISTING, delay=1.0)
        if not soup:
            raise ConnectionError("Failed to fetch EmploiDiali page")

        # jeg_post is the card selector for JNews theme used by EmploiDiali
        cards = soup.select(".jeg_post")

        for card in cards:
            try:
                title_el = card.select_one(".jeg_post_title a")
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                job_url = title_el.get("href", "")

                # Company is often not a separate field, but meta info exists
                meta_el = card.select_one(".jeg_post_meta")
                company = "Non spécifié"
                if meta_el:
                    cat_el = meta_el.select_one(".jeg_post_category a")
                    if cat_el:
                        company = cat_el.get_text(strip=True)

                location = "Maroc"
                desc_el = card.select_one(".jeg_post_excerpt")
                description = (
                    desc_el.get_text(strip=True) if desc_el else title
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

    except Exception as exc:
        logger.error("EmploiDiali scraping failed: %s", exc)

    return jobs[:limit]
