"""ReKrute.com scraper — extracts job offers from Morocco's leading job board.

Scrapes listing pages at ``rekrute.com/offres.html``, follows each offer
link to fetch the full description, and persists results via the DB manager.
Falls back to the static dataset on any unrecoverable error.

HTML selectors (verified April 2026):
- Job card:       ``li.post-id``
- Title + city:   ``a.titreJob``  (format: "Title | City (Maroc)")
- Company logo:   ``img`` inside card  → ``alt`` attribute
- Description:    snippet text inside the card (``li.post-id`` direct text)
- Detail page:    ``div.contentbloc div.blc`` (multiple blocks)
- Pagination:     query param ``?p=<page>&s=1&o=1``
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup, Tag

from database.db_manager import save_job, save_skills_for_job
from scraper.base_scraper import BaseScraper

logger = logging.getLogger(__name__)

_REKRUTE_BASE = "https://www.rekrute.com"
_LISTING_URL = f"{_REKRUTE_BASE}/offres.html"


class RekruteScraper(BaseScraper):
    """Scraper for ReKrute.com job listings."""

    def __init__(self, max_pages: int = 3, delay: float = 2.0) -> None:
        super().__init__(
            source_name="rekrute",
            base_url=_LISTING_URL,
            max_pages=max_pages,
            delay=delay,
        )

    # ------------------------------------------------------------------
    # Listing page parsing
    # ------------------------------------------------------------------

    def _build_page_url(self, page: int) -> str:
        """Construct the listing URL for a given page number."""
        return f"{self.base_url}?s=1&p={page}&o=1"

    def _parse_title_location(self, raw: str) -> tuple[str, str]:
        """Split ``'Title | City (Maroc)'`` into (title, location).

        Falls back gracefully when the pipe separator is missing.
        """
        if "|" in raw:
            parts = raw.split("|", maxsplit=1)
            title = parts[0].strip()
            location = parts[1].strip()
            # Remove trailing "(Maroc)" if present.
            location = re.sub(r"\s*\(Maroc\)\s*$", "", location).strip()
            return title, location
        return raw.strip(), ""

    def _extract_company_from_card(self, card: Tag) -> str:
        """Try to pull the company name from the logo ``alt`` attribute."""
        img = card.find("img")
        if img:
            alt = img.get("alt", "") or img.get("title", "")
            if alt and alt.lower() not in ("logo", "confidential", ""):
                return alt.strip()
        return "Entreprise confidentielle"

    def _extract_snippet(self, card: Tag) -> str:
        """Extract the description snippet visible on the listing card.

        ReKrute embeds a short description as direct text inside the
        card, decorated with a star icon.  We grab all visible text and
        strip metadata lines (Publication, Secteur, Fonction, etc.).
        """
        full_text = card.get_text(separator="\n", strip=True)
        lines = full_text.split("\n")

        # Filter out metadata and keep descriptive sentences.
        skip_prefixes = (
            "publication", "secteur", "fonction", "experience",
            "niveau", "type de contrat", "postes propos",
            "lancer", "page", "sur",
        )
        description_lines: list[str] = []
        for line in lines:
            cleaned = line.strip()
            if not cleaned:
                continue
            if any(cleaned.lower().startswith(p) for p in skip_prefixes):
                continue
            # Skip very short fragments (likely icons / badges).
            if len(cleaned) < 15:
                continue
            description_lines.append(cleaned)

        return " ".join(description_lines)

    def _parse_listing_page(self, html: str) -> List[Dict[str, Any]]:
        """Parse a single listing page and return a list of raw job dicts."""
        soup = BeautifulSoup(html, "lxml")
        cards = soup.select("li.post-id")
        jobs: List[Dict[str, Any]] = []

        for card in cards:
            try:
                link_tag = card.select_one("a.titreJob")
                if not link_tag:
                    continue

                raw_title = link_tag.get_text(strip=True)
                title, location = self._parse_title_location(raw_title)

                href = link_tag.get("href", "")
                url = href if href.startswith("http") else _REKRUTE_BASE + href

                company = self._extract_company_from_card(card)
                snippet = self._extract_snippet(card)

                jobs.append({
                    "title": title,
                    "company": company,
                    "location": location,
                    "description": snippet,
                    "url": url,
                    "source": self.source_name,
                })
            except Exception as exc:
                logger.warning("Failed to parse a card: %s", exc)
                continue

        logger.info("Parsed %d jobs from listing page", len(jobs))
        return jobs

    # ------------------------------------------------------------------
    # Detail page enrichment
    # ------------------------------------------------------------------

    def _fetch_full_description(self, url: str) -> Optional[str]:
        """Fetch the detail page and extract the full description text."""
        html = self._fetch_page(url)
        if not html:
            return None

        soup = BeautifulSoup(html, "lxml")
        blocks = soup.select("div.contentbloc div.blc")
        if not blocks:
            return None

        parts = [b.get_text(separator=" ", strip=True) for b in blocks]
        return " ".join(parts)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape ReKrute listings across multiple pages.

        Returns a list of job dicts matching the ``jobs`` table schema.
        On failure, transparently falls back to the static dataset.
        """
        all_jobs: List[Dict[str, Any]] = []

        try:
            for page in range(1, self.max_pages + 1):
                page_url = self._build_page_url(page)
                logger.info("Scraping page %d: %s", page, page_url)

                html = self._fetch_page(page_url)
                if not html:
                    logger.warning("Empty response for page %d, stopping.", page)
                    break

                page_jobs = self._parse_listing_page(html)
                if not page_jobs:
                    logger.info("No more jobs found on page %d, stopping.", page)
                    break

                all_jobs.extend(page_jobs)
                self._sleep()

            # Enrich with full descriptions (best-effort).
            for job in all_jobs:
                try:
                    full_desc = self._fetch_full_description(job["url"])
                    if full_desc:
                        job["description"] = full_desc
                    self._sleep()
                except Exception as exc:
                    logger.warning(
                        "Detail fetch failed for %s: %s", job["url"], exc
                    )

        except Exception as exc:
            logger.error("ReKrute scraping failed: %s", exc)

        # Fallback if scraping yielded nothing.
        if not all_jobs:
            logger.warning("No jobs scraped — falling back to static dataset.")
            all_jobs = self.load_fallback(source_filter="rekrute")

        # Add scraped_at timestamp.
        now = datetime.now(timezone.utc).isoformat()
        for job in all_jobs:
            job.setdefault("scraped_at", now)

        logger.info("Total ReKrute jobs collected: %d", len(all_jobs))
        return all_jobs

    # ------------------------------------------------------------------
    # DB persistence helper
    # ------------------------------------------------------------------

    def scrape_and_save(self) -> List[Dict[str, Any]]:
        """Scrape jobs *and* persist them to the database.

        Returns the list of job dicts (including any duplicates that
        were skipped by the DB layer).
        """
        jobs = self.scrape()
        saved_count = 0

        for job_data in jobs:
            db_job = save_job(
                title=job_data["title"],
                company=job_data["company"],
                description=job_data["description"],
                url=job_data["url"],
                source=job_data["source"],
                location=job_data.get("location"),
            )
            if db_job:
                saved_count += 1

        logger.info(
            "Persisted %d new jobs out of %d scraped", saved_count, len(jobs)
        )
        return jobs


# ------------------------------------------------------------------
# CLI entry point
# ------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    scraper = RekruteScraper(max_pages=2, delay=1.5)
    results = scraper.scrape_and_save()

    print(f"\n=== ReKrute scraper finished ===")
    print(f"Total jobs: {len(results)}")
    for j in results[:5]:
        desc_preview = j["description"][:80] + "..." if len(j["description"]) > 80 else j["description"]
        print(f"  - {j['title']} @ {j['company']} [{j['location']}]")
        print(f"    {desc_preview}")
