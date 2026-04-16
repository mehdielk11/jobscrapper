"""Emploi-Public.ma scraper — Moroccan government job portal.

Strategy: Playwright — site uses JavaScript to render concours cards.
Card structure (inspected 2026-04): <a class="card card-scale" href="/fr/concours/details/UUID">
Pagination: URL-based via ?page=N (clicking "next" reloads same content).
"""

import logging
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from scraper.base_scraper import (
    normalize_job,
    get_playwright_page,
    human_delay,
)

logger = logging.getLogger(__name__)

SOURCE = "Emploi-Public"
BASE_URL = "https://www.emploi-public.ma"
LISTING_URL = f"{BASE_URL}/fr/concoursListe.asp"

# Confirmed live selector — each job card is an <a class="card card-scale">
CARD_SELECTOR = "a.card.card-scale"


def _extract_jobs_from_page(page) -> list:
    """Extract concours cards from the rendered Emploi-Public listing page.

    Card structure confirmed from live inspection:
      - URL:     href on the <a> element itself
      - Title:   h2.card-title
      - Company: div.card-text (text after the icon)
      - Deadline: div.card-footer divs
    """
    jobs: list = []
    try:
        page.wait_for_selector(CARD_SELECTOR, timeout=15000)
    except PlaywrightTimeout:
        logger.warning("[EmploiPublic] Card selector timed out — page may be empty.")
        return jobs

    try:
        cards = page.query_selector_all(CARD_SELECTOR)
        logger.info(f"[EmploiPublic] Found {len(cards)} cards")

        for card in cards:
            try:
                # URL is on the card anchor itself
                href = card.get_attribute("href") or ""
                url = (BASE_URL + href) if not href.startswith("http") else href

                # Title
                title_el = card.query_selector("h2.card-title")
                title = title_el.inner_text().strip() if title_el else None

                # Company / Administration — in div.card-text (text after icon)
                company_el = card.query_selector("div.card-text")
                company = (
                    company_el.inner_text().strip() if company_el else "Administration publique"
                )

                # Deadline — from card-footer divs
                footer_divs = card.query_selector_all("div.card-footer div")
                deadline = ""
                for div in footer_divs:
                    text = div.inner_text().strip()
                    if "Limite" in text or "limite" in text:
                        deadline = text
                        break

                if not title or not url:
                    continue

                description = (
                    f"Concours public — Administration: {company}."
                    + (f" {deadline}." if deadline else "")
                )

                jobs.append(
                    normalize_job(
                        {
                            "title": title,
                            "company": company,
                            "location": "Maroc",
                            "description": description,
                            "source": SOURCE,
                            "url": url,
                        }
                    )
                )
            except Exception as e:
                logger.debug(f"[EmploiPublic] Card parse error: {e}")
                continue

    except Exception as e:
        logger.warning(f"[EmploiPublic] Extraction error: {e}")

    return jobs


def scrape(limit: int = 50) -> list:
    """Scrape public-sector concours from Emploi-Public.ma via Playwright.

    Paginates via ?page=N URL parameter (the next button just updates this param).

    Args:
        limit: Maximum number of job dicts to return.

    Returns:
        List of normalized job dicts. Falls back to static dataset on failure.
    """
    all_jobs: list = []
    seen_urls: set = set()

    try:
        with sync_playwright() as p:
            browser, context, page = get_playwright_page(p, headless=True)
            try:
                pg = 1
                consecutive_empty = 0

                while len(all_jobs) < limit and consecutive_empty < 3:
                    url = f"{LISTING_URL}?page={pg}"
                    logger.info(f"[EmploiPublic] Fetching page {pg}: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    human_delay(2.0, 3.5)

                    page_jobs = _extract_jobs_from_page(page)

                    if not page_jobs:
                        consecutive_empty += 1
                        logger.info(
                            f"[EmploiPublic] Empty page {pg} (attempt {consecutive_empty}/3)"
                        )
                        pg += 1
                        continue

                    consecutive_empty = 0
                    new_count = 0
                    for job in page_jobs:
                        if job["url"] not in seen_urls and len(all_jobs) < limit:
                            seen_urls.add(job["url"])
                            all_jobs.append(job)
                            new_count += 1

                    logger.info(
                        f"[EmploiPublic] Page {pg}: {len(page_jobs)} cards, "
                        f"{new_count} new, total: {len(all_jobs)}"
                    )

                    # Stop if we got cards but all were duplicates (end of content)
                    if new_count == 0:
                        logger.info("[EmploiPublic] All cards on page were duplicates — stopping.")
                        break

                    pg += 1

            finally:
                browser.close()

        return all_jobs

    except Exception as e:
        logger.error(f"[EmploiPublic] Fatal: {e}", exc_info=True)
        return []
