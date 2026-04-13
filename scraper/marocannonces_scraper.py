"""MarocAnnonces.com scraper — general classifieds job board.

Scrapes job listings from the employment section.
"""

import logging
from typing import List

from scraper.base_scraper import get_soup_playwright

logger = logging.getLogger(__name__)

_BASE = "https://www.marocannonces.com"
_LISTING = f"{_BASE}/categorie/309/Emploi/Offres-emploi.html"

def scrape(limit: int = 50) -> List[dict]:
    """Scrape MarocAnnonces job listings.

    Args:
        limit: Maximum number of jobs to return.

    Returns:
        List of job dicts.
    """
    jobs: List[dict] = []
    max_pages = max(1, limit // 20 + 1)

    try:
        for page in range(1, max_pages + 1):
            url = f"{_LISTING}?p={page}" if page > 1 else _LISTING
            logger.info("MarocAnnonces page %d: %s", page, url)

            soup = get_soup_playwright(url)
            if not soup:
                break

            # Selector based on confirmed DOM research
            cards = soup.select("li.annonces_list_item")
            if not cards:
                # possible fallback
                cards = soup.select("ul.cars-list li")

            if not cards:
                break

            for card in cards:
                try:
                    title_el = card.select_one("h3 a")
                    if not title_el:
                        continue

                    title = title_el.get_text(strip=True)
                    if not title:
                        continue

                    job_url_rel = title_el.get("href", "")
                    job_url = (
                        job_url_rel
                        if job_url_rel.startswith("http")
                        else _BASE + "/" + job_url_rel.lstrip("/")
                    )

                    company = "Non spécifié"

                    loc_el = card.select_one("span.location")
                    location = (
                        loc_el.get_text(strip=True)
                        if loc_el
                        else "Maroc"
                    )

                    desc_el = card.select_one("p.desc")
                    description = (
                        desc_el.get_text(strip=True)
                        if desc_el
                        else title
                    )

                    jobs.append(
                        {
                            "title": title,
                            "company": company,
                            "location": location,
                            "description": description,
                            "source": "marocannonces",
                            "url": job_url,
                        }
                    )

                    if len(jobs) >= limit:
                        break
                except Exception as exc:
                    logger.warning("MarocAnnonces card error: %s", exc)
                    continue

            if len(jobs) >= limit:
                break

    except Exception as exc:
        logger.error("MarocAnnonces scraping failed: %s", exc)

    return jobs[:limit]
