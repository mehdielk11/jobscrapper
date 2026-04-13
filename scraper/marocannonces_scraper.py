"""MarocAnnonces.com scraper — general classifieds job board.

Scrapes job listings from the employment section. Falls back to
the static dataset if scraping fails.
"""

import logging
from typing import List

from scraper.base_scraper import get_soup, load_static_fallback

logger = logging.getLogger(__name__)

_BASE = "https://www.marocannonces.com"
_LISTING = f"{_BASE}/maroc/offres-emploi-b309.html"


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
            url = (
                _LISTING
                if page == 1
                else _LISTING.replace(".html", f"-t{page}.html")
            )
            logger.info("MarocAnnonces page %d: %s", page, url)

            soup = get_soup(url)
            if not soup:
                break

            cards = soup.select("div.holder, li.announcement")
            if not cards:
                break

            for card in cards:
                try:
                    title_el = card.select_one("h3 a, a.ad-title")
                    if not title_el:
                        continue

                    title = title_el.get_text(strip=True)
                    href = title_el.get("href", "")
                    job_url = (
                        href
                        if href.startswith("http")
                        else _BASE + href
                    )

                    # Metadata from spans
                    spans = card.select("span")
                    company = "Non spécifié"
                    location = ""
                    for span in spans:
                        text = span.get_text(strip=True)
                        if "ville" in span.get("class", []) or any(
                            city in text.lower()
                            for city in [
                                "casablanca", "rabat", "marrakech",
                                "tanger", "fes", "agadir",
                            ]
                        ):
                            location = text

                    description = card.get_text(
                        separator=" ", strip=True
                    )[:500]

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
                    logger.warning(
                        "MarocAnnonces card error: %s", exc
                    )
                    continue

            if len(jobs) >= limit:
                break

    except Exception as exc:
        logger.error("MarocAnnonces scraping failed: %s", exc)

    if not jobs:
        logger.warning(
            "MarocAnnonces: no jobs scraped, using fallback."
        )
        fallback = load_static_fallback()
        jobs = [
            j
            for j in fallback
            if j.get("source") == "marocannonces"
        ]

    return jobs[:limit]
