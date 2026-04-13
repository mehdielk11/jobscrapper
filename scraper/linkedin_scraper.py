"""LinkedIn Morocco scraper — attempts public scraping, falls back to static.

LinkedIn blocks scrapers aggressively. Strategy:
1. Attempt requests on the public jobs page.
2. Parse base-card job cards.
3. If blocked (redirect to login or CAPTCHA): immediately fall back to
   static dataset and log a clear warning.
"""

import logging
from typing import List

from scraper.base_scraper import get_soup, load_static_fallback

logger = logging.getLogger(__name__)

_LISTING = "https://www.linkedin.com/jobs/search/?location=Maroc"


def scrape(limit: int = 50) -> List[dict]:
    """Attempt to scrape LinkedIn Morocco, fallback to static dataset.

    Args:
        limit: Maximum number of jobs to return.

    Returns:
        List of job dicts.
    """
    jobs: List[dict] = []

    try:
        soup = get_soup(_LISTING, delay=2.0)
        if not soup:
            raise ConnectionError("Failed to fetch LinkedIn page")

        # Check for login redirect / CAPTCHA
        page_text = soup.get_text().lower()
        if "sign in" in page_text and "captcha" in page_text:
            logger.warning(
                "LinkedIn blocked scraping — using static dataset. "
                "For real data, consider the LinkedIn Jobs API."
            )
            raise ConnectionError("LinkedIn login/CAPTCHA detected")

        cards = soup.select("div.base-card, li.result-card")

        for card in cards:
            try:
                title_el = card.select_one(
                    "h3.base-search-card__title, "
                    "span.sr-only, "
                    "a.base-card__full-link"
                )
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)

                link_el = card.select_one("a.base-card__full-link")
                href = (
                    link_el.get("href", "") if link_el else ""
                )
                job_url = href if href else _LISTING

                company_el = card.select_one(
                    "h4.base-search-card__subtitle, "
                    "a.hidden-nested-link"
                )
                company = (
                    company_el.get_text(strip=True)
                    if company_el
                    else "Non spécifié"
                )

                loc_el = card.select_one(
                    "span.job-search-card__location"
                )
                location = (
                    loc_el.get_text(strip=True)
                    if loc_el
                    else "Maroc"
                )

                jobs.append(
                    {
                        "title": title,
                        "company": company,
                        "location": location,
                        "description": title,
                        "source": "linkedin",
                        "url": job_url,
                    }
                )

                if len(jobs) >= limit:
                    break
            except Exception as exc:
                logger.warning("LinkedIn card error: %s", exc)
                continue

        if len(jobs) < 3:
            logger.warning(
                "LinkedIn: only %d jobs found, likely blocked. "
                "Using fallback.",
                len(jobs),
            )
            jobs = []

    except Exception as exc:
        logger.error("LinkedIn scraping failed: %s", exc)

    if not jobs:
        logger.warning(
            "LinkedIn blocked scraping — using static dataset. "
            "For real data, consider the LinkedIn Jobs API."
        )
        fallback = load_static_fallback()
        jobs = [j for j in fallback if j.get("source") == "linkedin"]

    return jobs[:limit]
