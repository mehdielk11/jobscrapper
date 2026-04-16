"""EmploiDiali.ma scraper — Moroccan job news/blog site.

Live inspection (2026-04): The site is a JNews WordPress theme presenting
job announcements as blog-style articles (not WP Job Manager).
Each card: article.jeg_post with h3.jeg_post_title > a for title + URL.
Strategy: Playwright with article card extraction.
"""

import logging
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from scraper.base_scraper import (
    normalize_job,
    get_playwright_page,
    human_delay,
)

logger = logging.getLogger(__name__)

SOURCE = "EmploiDiali"
BASE_URL = "https://emploidiali.ma"

# Known listing URLs — scraper probes each until it finds article cards
LISTING_URL_CANDIDATES = [
    f"{BASE_URL}/offres-emploi/",
    f"{BASE_URL}/category/emploi-maroc/",
    f"{BASE_URL}/",
]

# Confirmed live selector: JNews WordPress articles
CARD_SELECTOR = "article.jeg_post"


def _detect_listing_url(page) -> str | None:
    """Probe candidate URLs and return the first that returns job articles."""
    for url in LISTING_URL_CANDIDATES:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            human_delay(1.5, 2.5)
            cards = page.query_selector_all(CARD_SELECTOR)
            if cards:
                logger.info(f"[EmploiDiali] Active listing URL: {url} ({len(cards)} articles)")
                return url
        except Exception as e:
            logger.debug(f"[EmploiDiali] URL probe failed {url}: {e}")
    return None


def _extract_jobs_from_page(page) -> list:
    """Extract job articles from the current EmploiDiali page.

    Card structure (JNews theme):
      - article.jeg_post
        - h3.jeg_post_title > a  (title + URL)
        - div.jeg_post_category > span > a  (category label, used as company)
    """
    jobs: list = []
    try:
        cards = page.query_selector_all(CARD_SELECTOR)
        logger.info(f"[EmploiDiali] Found {len(cards)} articles")

        for card in cards:
            try:
                # Title + URL from the title anchor
                title_el = card.query_selector("h3.jeg_post_title a, h2.jeg_post_title a")
                if not title_el:
                    continue
                title = title_el.inner_text().strip()
                url = title_el.get_attribute("href") or ""
                if not url.startswith("http"):
                    url = BASE_URL + url

                # Category as company proxy (e.g. "Emploi Maroc", "Blogs")
                cat_el = card.query_selector("div.jeg_post_category a")
                company = cat_el.inner_text().strip() if cat_el else "EmploiDiali"

                # Filter out non-job articles (blog posts, guides)
                cat_lower = company.lower()
                if "blog" in cat_lower or "conseil" in cat_lower or "guide" in cat_lower:
                    continue

                if not title or not url:
                    continue

                jobs.append(
                    normalize_job(
                        {
                            "title": title,
                            "company": company,
                            "location": "Maroc",
                            "description": "",
                            "source": SOURCE,
                            "url": url,
                        }
                    )
                )
            except Exception as e:
                logger.debug(f"[EmploiDiali] Card error: {e}")
                continue
    except Exception as e:
        logger.warning(f"[EmploiDiali] Page extraction error: {e}")

    return jobs


def scrape(limit: int = 50) -> list:
    """Scrape job announcements from EmploiDiali.ma via Playwright.

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
                listing_url = _detect_listing_url(page)
                if not listing_url:
                    logger.warning("[EmploiDiali] No listing URL found — returning empty list.")
                    return []

                pg = 1
                while len(all_jobs) < limit:
                    if pg > 1:
                        # JNews pagination is typically /page/N/
                        paged_url = f"{listing_url.rstrip('/')}/page/{pg}/"
                        page.goto(paged_url, wait_until="domcontentloaded", timeout=20000)
                        human_delay(1.5, 2.5)

                    page_jobs = _extract_jobs_from_page(page)
                    if not page_jobs:
                        logger.info(f"[EmploiDiali] No articles on page {pg} — done.")
                        break

                    new_count = 0
                    for job in page_jobs:
                        if job["url"] not in seen_urls and len(all_jobs) < limit:
                            seen_urls.add(job["url"])
                            all_jobs.append(job)
                            new_count += 1

                    logger.info(
                        f"[EmploiDiali] Page {pg}: {len(page_jobs)} articles, "
                        f"{new_count} new, total: {len(all_jobs)}"
                    )

                    if new_count == 0:
                        break
                    pg += 1

            finally:
                browser.close()

        return all_jobs

    except Exception as e:
        logger.error(f"[EmploiDiali] Fatal: {e}", exc_info=True)
        return []
