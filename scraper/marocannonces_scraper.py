"""MarocAnnonces.com scraper — Moroccan classifieds, employment section.

Live inspection (2026-04): Cards are `article.listing` inside `div.listing_set`.
Each article has an `<a>` with a relative href (no base URL prefix).
Title in `div.holder h3`. Location in `span.location`.
Strategy: Playwright with stealth (static requests returns empty body).
Pagination via ?pn=N.
"""

import logging
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from scraper.base_scraper import (
    normalize_job,
    get_playwright_page,
    human_delay,
)

logger = logging.getLogger(__name__)

SOURCE = "MarocAnnonces"
BASE_URL = "https://www.marocannonces.com"
LISTING_URL = f"{BASE_URL}/categorie/309/Emploi/Offres-emploi.html"

# Confirmed live selectors (inspected 2026-04)
CARD_SELECTOR = "article.listing"


def _extract_cards_from_page(page) -> list:
    """Extract job ad cards from the current MarocAnnonces listing page.

    Card structure (confirmed):
      - article.listing > a[href]  (relative URL like categorie/309/.../annonce/...)
      - div.holder > h3             (title)
      - span.location               (location)
    """
    jobs: list = []
    try:
        page.wait_for_selector(CARD_SELECTOR, timeout=12000)
    except PlaywrightTimeout:
        logger.warning("[MarocAnnonces] Card selector timed out.")
        return jobs

    try:
        cards = page.query_selector_all(CARD_SELECTOR)
        logger.info(f"[MarocAnnonces] Found {len(cards)} cards")

        for card in cards:
            try:
                # URL — on the inner <a> which has a relative href
                link_el = card.query_selector("a[href]")
                href = link_el.get_attribute("href") if link_el else None
                if not href:
                    continue
                # Relative href like "categorie/309/.../annonce/N/slug.html"
                url = (
                    f"{BASE_URL}/{href.lstrip('/')}"
                    if not href.startswith("http")
                    else href
                )

                # Title — inside div.holder h3
                title_el = card.query_selector("div.holder h3")
                title = title_el.inner_text().strip() if title_el else None

                # Location
                loc_el = card.query_selector("span.location")
                location = loc_el.inner_text().strip() if loc_el else "Maroc"

                if not title or not url:
                    continue

                jobs.append(
                    normalize_job(
                        {
                            "title": title,
                            "company": "Annonceur",
                            "location": location,
                            "description": "",
                            "source": SOURCE,
                            "url": url,
                        }
                    )
                )
            except Exception as e:
                logger.debug(f"[MarocAnnonces] Card parse error: {e}")
                continue
    except Exception as e:
        logger.warning(f"[MarocAnnonces] Extraction error: {e}")

    return jobs


def scrape(limit: int = 50) -> list:
    """Scrape employment classifieds from MarocAnnonces.com via Playwright.

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
                pn = 1
                while len(all_jobs) < limit:
                    url = f"{LISTING_URL}?pn={pn}" if pn > 1 else LISTING_URL
                    logger.info(f"[MarocAnnonces] Page {pn}: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    human_delay(1.5, 3.0)

                    page_jobs = _extract_cards_from_page(page)
                    if not page_jobs:
                        logger.info(f"[MarocAnnonces] No cards on page {pn} — done.")
                        break

                    new_count = 0
                    for job in page_jobs:
                        if job["url"] not in seen_urls and len(all_jobs) < limit:
                            seen_urls.add(job["url"])
                            all_jobs.append(job)
                            new_count += 1

                    logger.info(
                        f"[MarocAnnonces] Page {pn}: {len(page_jobs)} cards, "
                        f"{new_count} new, total: {len(all_jobs)}"
                    )

                    if new_count == 0:
                        logger.info("[MarocAnnonces] No new cards — stopping.")
                        break
                    pn += 1

            finally:
                browser.close()

        return all_jobs

    except Exception as e:
        logger.error(f"[MarocAnnonces] Fatal: {e}", exc_info=True)
        return []
