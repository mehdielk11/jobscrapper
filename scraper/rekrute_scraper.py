"""ReKrute.com scraper — Morocco's leading job board.

Scrapes listing pages, extracts job metadata, and falls back to
the static dataset on any failure.
"""

import logging
import re
from typing import List, Optional

from scraper.base_scraper import get_soup, load_static_fallback

logger = logging.getLogger(__name__)

_BASE = "https://www.rekrute.com"
_LISTING = f"{_BASE}/offres.html"


def _parse_title_location(raw: str) -> tuple:
    """Split 'Title | City (Maroc)' into (title, location)."""
    if "|" in raw:
        parts = raw.split("|", maxsplit=1)
        title = parts[0].strip()
        location = re.sub(
            r"\s*\(Maroc\)\s*$", "", parts[1].strip()
        ).strip()
        return title, location
    return raw.strip(), ""


def scrape(limit: int = 50) -> List[dict]:
    """Scrape ReKrute job listings.

    Args:
        limit: Maximum number of jobs to return.

    Returns:
        List of job dicts with keys: title, company, location,
        description, source, url.
    """
    jobs: List[dict] = []
    max_pages = max(1, limit // 20 + 1)

    try:
        for page in range(1, max_pages + 1):
            url = f"{_LISTING}?s=1&p={page}&o=1"
            logger.info("ReKrute page %d: %s", page, url)

            soup = get_soup(url)
            if not soup:
                break

            cards = soup.select("li.post-id")
            if not cards:
                break

            for card in cards:
                try:
                    link = card.select_one("a.titreJob")
                    if not link:
                        continue

                    raw_title = link.get_text(strip=True)
                    title, location = _parse_title_location(raw_title)

                    href = link.get("href", "")
                    job_url = (
                        href
                        if href.startswith("http")
                        else _BASE + href
                    )

                    # Company from image alt
                    img = card.find("img")
                    company = "Entreprise confidentielle"
                    if img:
                        alt = img.get("alt", "") or ""
                        if alt and alt.lower() not in (
                            "logo",
                            "confidential",
                            "",
                        ):
                            company = alt.strip()

                    # Description snippet
                    snippet = _extract_snippet(card)

                    jobs.append(
                        {
                            "title": title,
                            "company": company,
                            "location": location,
                            "description": snippet,
                            "source": "rekrute",
                            "url": job_url,
                        }
                    )

                    if len(jobs) >= limit:
                        break
                except Exception as exc:
                    logger.warning("Card parse error: %s", exc)
                    continue

            if len(jobs) >= limit:
                break

    except Exception as exc:
        logger.error("ReKrute scraping failed: %s", exc)

    if not jobs:
        logger.warning("ReKrute: no jobs scraped, using fallback.")
        fallback = load_static_fallback()
        jobs = [j for j in fallback if j.get("source") == "rekrute"]

    return jobs[:limit]


def _extract_snippet(card) -> str:
    """Extract the description snippet from a listing card."""
    full_text = card.get_text(separator="\n", strip=True)
    lines = full_text.split("\n")

    skip = (
        "publication",
        "secteur",
        "fonction",
        "experience",
        "niveau",
        "type de contrat",
        "postes propos",
    )
    desc_lines: List[str] = []
    for line in lines:
        cleaned = line.strip()
        if not cleaned or len(cleaned) < 15:
            continue
        if any(cleaned.lower().startswith(p) for p in skip):
            continue
        desc_lines.append(cleaned)

    return " ".join(desc_lines)
