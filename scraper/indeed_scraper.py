"""Indeed Morocco scraper — attempts direct requests, falls back to static.

Indeed is JavaScript-heavy and may trigger bot protection.
If fewer than 5 results are returned, we log a warning and fall back
to the static dataset. No Selenium is used for MVP.
"""

import logging
from typing import List

from scraper.base_scraper import get_soup_playwright

logger = logging.getLogger(__name__)

_LISTING = "https://ma.indeed.com/jobs?q=&l=Maroc"

def scrape(limit: int = 50) -> List[dict]:
    """Attempt to scrape Indeed Morocco, using Playwright.

    Args:
        limit: Maximum number of jobs to return.

    Returns:
        List of job dicts.
    """
    jobs: List[dict] = []

    try:
        soup = get_soup_playwright(_LISTING, delay=2.0)
        if not soup:
            raise ConnectionError("Failed to fetch Indeed page")

        # Indeed uses data-jk attribute on job cards
        cards = soup.select("div[data-jk], div.job_seen_beacon")
        if not cards:
            # Try alternative selectors
            cards = soup.select("div.jobsearch-ResultsList a")

        for card in cards:
            try:
                title_el = card.select_one(
                    "h2 a, h2 span, a.jcs-JobTitle"
                )
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                href = title_el.get("href", "")
                job_url = (
                    href
                    if href.startswith("http")
                    else f"https://ma.indeed.com{href}"
                )

                company_el = card.select_one(
                    "span.companyName, span.company"
                )
                company = (
                    company_el.get_text(strip=True)
                    if company_el
                    else "Non spécifié"
                )

                loc_el = card.select_one(
                    "div.companyLocation, span.location"
                )
                location = (
                    loc_el.get_text(strip=True)
                    if loc_el
                    else "Maroc"
                )

                desc_el = card.select_one("div.job-snippet")
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
                        "source": "indeed",
                        "url": job_url,
                    }
                )

                if len(jobs) >= limit:
                    break
            except Exception as exc:
                logger.warning("Indeed card error: %s", exc)
                continue

    except Exception as exc:
        logger.error("Indeed scraping failed: %s", exc)

    return jobs[:limit]
