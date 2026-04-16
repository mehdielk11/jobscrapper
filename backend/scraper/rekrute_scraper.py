"""ReKrute.com scraper — Morocco's leading job board.

Strategy: static requests + BeautifulSoup.
Cards are in `li.post-id` elements loaded server-side (despite Angular shell).
Pagination via ?p=N.
"""

import logging
from typing import Optional

from scraper.base_scraper import (
    fetch_soup,
    make_session,
    normalize_job,
)

logger = logging.getLogger(__name__)

SOURCE = "ReKrute"
BASE_URL = "https://www.rekrute.com"
LISTING_URL = f"{BASE_URL}/offres.html"


def _parse_job_card(card, session: object) -> Optional[dict]:
    """Extract job data from a single `li.post-id` ReKrute card.

    Known HTML structure (inspected 2026-04):
      - Title:   <a class="titreJob" href="/offre-emploi-...-N.html">
      - Company: <img class="photo" alt="CompanyName">  inside the logo <a>
      - Desc:    first <span> inside <div class="info">
      - URL:     same href as title anchor
    """
    try:
        # Title + URL
        title_el = card.find("a", class_="titreJob")
        if not title_el:
            return None
        title = title_el.get_text(strip=True)
        href = title_el.get("href", "")
        url = (BASE_URL + href) if not href.startswith("http") else href

        # Company — from logo img alt attribute
        logo_img = card.find("img", class_="photo")
        company = logo_img.get("alt", "N/A").strip() if logo_img else "N/A"

        # Description snippet — inside the first div.info span
        info_div = card.find("div", class_="info")
        desc_snippet = ""
        if info_div:
            span = info_div.find("span")
            if span:
                desc_snippet = span.get_text(strip=True)[:500]

        # Location — ReKrute embeds location in the title after " | "
        location = "Maroc"
        if " | " in title:
            location = title.split(" | ")[-1].strip()
            title = title.split(" | ")[0].strip()

        if not title or not url:
            return None

        # Try full-page description only if snippet is short
        description = desc_snippet
        if len(description) < 100:
            description = _get_job_description(url, session) or desc_snippet

        return normalize_job(
            {
                "title": title,
                "company": company,
                "location": location,
                "description": description,
                "source": SOURCE,
                "url": url,
            }
        )
    except Exception as e:
        logger.debug(f"_parse_job_card error: {e}")
        return None


def _get_job_description(url: str, session: object) -> str:
    """Fetch job detail page and extract full description text."""
    try:
        soup = fetch_soup(url, session=session, delay=1.0)
        if not soup:
            return ""
        desc_el = (
            soup.find("div", id=lambda i: i and "detail" in i.lower() if i else False)
            or soup.find(
                "div", class_=lambda c: c and "description" in c.lower() if c else False
            )
            or soup.find("div", class_="col-sm-8")
        )
        return desc_el.get_text(separator=" ", strip=True)[:3000] if desc_el else ""
    except Exception as e:
        logger.debug(f"_get_job_description error for {url}: {e}")
        return ""


def scrape(limit: int = 50) -> list:
    """Scrape job listings from ReKrute.com.

    Args:
        limit: Maximum number of job dicts to return.

    Returns:
        List of normalized job dicts, or empty list on failure.
    """
    jobs: list = []
    session = make_session()
    page = 1

    try:
        while len(jobs) < limit:
            url = f"{LISTING_URL}?p={page}"
            logger.info(f"[ReKrute] Fetching page {page}: {url}")
            soup = fetch_soup(url, session=session, delay=2.0)

            if soup is None:
                logger.warning(f"[ReKrute] Failed to fetch page {page}, stopping.")
                break

            # Primary selector confirmed from live inspection 2026-04
            cards = soup.find_all("li", class_="post-id")

            # Fallback strategies in case site updates class name
            if not cards:
                cards = (
                    soup.find_all("li", attrs={"id": True, "class": True})
                    or soup.find_all("article")
                )

            if not cards:
                logger.info(f"[ReKrute] No job cards on page {page} — stopping.")
                break

            for card in cards:
                if len(jobs) >= limit:
                    break
                job = _parse_job_card(card, session)
                if job and job["url"] and job["title"] != "Poste non specifie":
                    jobs.append(job)

            logger.info(
                f"[ReKrute] Page {page}: {len(cards)} cards, total: {len(jobs)}"
            )
            page += 1

        if not jobs:
            logger.warning("[ReKrute] Zero jobs scraped — returning empty list.")
            return []

        logger.info(f"[ReKrute] Scraping complete: {len(jobs)} jobs")
        return jobs

    except Exception as e:
        logger.error(f"[ReKrute] Fatal error: {e}", exc_info=True)
        return []
