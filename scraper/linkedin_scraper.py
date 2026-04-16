"""LinkedIn Morocco job scraper.

Scrapes the PUBLIC jobs search page — no login required.
Uses Playwright + stealth to handle LinkedIn's bot detection.
Paginates via &start=25 increments.
Fetches job descriptions on detail pages (degrades gracefully if blocked).
"""

import logging
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from scraper.base_scraper import (
    normalize_job,
    get_playwright_page,
    human_delay,
)

logger = logging.getLogger(__name__)

SOURCE = "LinkedIn"
SEARCH_URL = (
    "https://www.linkedin.com/jobs/search/"
    "?location=Maroc&geoId=105570653&f_TPR=r604800&sortBy=DD"
)
# f_TPR=r604800 = last 7 days, sortBy=DD = most recent first


def _extract_jobs_from_page(page) -> list:
    """Extract job cards from the current LinkedIn jobs search page.

    Covers the primary card selectors used by LinkedIn's public search.
    Returns an empty list if the selector times out (bot detection).
    """
    jobs: list = []

    try:
        page.wait_for_selector(
            "ul.jobs-search__results-list li, "
            "div.base-card, "
            "li.result-card",
            timeout=15000,
        )
    except PlaywrightTimeout:
        logger.warning("[LinkedIn] Job list selector timeout.")
        return jobs

    cards = page.query_selector_all(
        "div.base-card, "
        "li.jobs-search-results__list-item, "
        "li.result-card"
    )
    logger.info(f"[LinkedIn] Found {len(cards)} cards")

    for card in cards:
        try:
            title_el = card.query_selector(
                "h3.base-search-card__title, "
                "h3.result-card__title, "
                "span.screen-reader-text"
            )
            title = title_el.inner_text().strip() if title_el else None

            company_el = card.query_selector(
                "h4.base-search-card__subtitle a, "
                "h4.result-card__subtitle, "
                "a.result-card__subtitle-link"
            )
            company = company_el.inner_text().strip() if company_el else "N/A"

            location_el = card.query_selector(
                "span.job-search-card__location, "
                "span.result-card__location"
            )
            location = location_el.inner_text().strip() if location_el else "Maroc"

            link_el = card.query_selector(
                "a.base-card__full-link, a.result-card__full-card-link"
            )
            url = link_el.get_attribute("href") if link_el else None
            if url:
                # Strip tracking params to get a clean canonical URL
                url = url.split("?")[0]

            if not title or not url:
                continue

            jobs.append(
                normalize_job(
                    {
                        "title": title,
                        "company": company,
                        "location": location,
                        "description": "",  # Fetched separately on detail page
                        "source": SOURCE,
                        "url": url,
                    }
                )
            )
        except Exception as e:
            logger.debug(f"[LinkedIn] Card error: {e}")
            continue

    return jobs


def _fetch_job_description(page, url: str) -> str:
    """Navigate to a LinkedIn job detail page and extract the description.

    Returns empty string if blocked (authwall/login redirect) or unavailable.
    This is best-effort — LinkedIn aggressively blocks unauthenticated fetches.
    """
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=20000)
        human_delay(1.5, 3.0)

        # Detect redirect to login wall
        if "linkedin.com/login" in page.url or "authwall" in page.url:
            logger.debug("[LinkedIn] Redirected to login on detail page — skipping description")
            return ""

        desc_el = page.query_selector(
            "div.show-more-less-html__markup, "
            "div.description__text, "
            "section.show-more-less-html"
        )
        return desc_el.inner_text().strip()[:3000] if desc_el else ""
    except Exception as e:
        logger.debug(f"[LinkedIn] Description fetch error for {url}: {e}")
        return ""


def scrape(limit: int = 50) -> list:
    """Scrape LinkedIn Morocco job listings.

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
                logger.info("[LinkedIn] Navigating to search page")
                page.goto(SEARCH_URL, wait_until="domcontentloaded", timeout=30000)
                human_delay(2.0, 4.0)

                # Detect hard block (authwall or 404)
                if "authwall" in page.url or page.query_selector("div#error-404"):
                    logger.warning("[LinkedIn] Hard block detected — returning empty list.")
                    return []

                start = 0
                while len(all_jobs) < limit:
                    if start > 0:
                        url = f"{SEARCH_URL}&start={start}"
                        page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        human_delay(2.0, 4.0)

                        # Scroll to trigger lazy-loaded cards
                        for _ in range(3):
                            page.keyboard.press("End")
                            human_delay(0.5, 1.0)

                    page_jobs = _extract_jobs_from_page(page)
                    if not page_jobs:
                        logger.info(f"[LinkedIn] No jobs at start={start} — stopping.")
                        break

                    new_jobs_in_page = 0
                    for job in page_jobs:
                        if job["url"] not in seen_urls and len(all_jobs) < limit:
                            seen_urls.add(job["url"])
                            new_jobs_in_page += 1
                            # Attempt description — degrades gracefully if blocked
                            desc = _fetch_job_description(page, job["url"])
                            job["description"] = desc
                            all_jobs.append(job)

                    logger.info(
                        f"[LinkedIn] start={start}: {len(page_jobs)} cards, "
                        f"total: {len(all_jobs)}, new_this_page: {new_jobs_in_page}"
                    )
                    
                    if new_jobs_in_page == 0:
                        logger.info(f"[LinkedIn] No new jobs at start={start} (all seen or limit reached). Preventing infinite loop.")
                        break

                    start += 25

                    # Return to search results after visiting detail pages
                    page.go_back(wait_until="domcontentloaded", timeout=15000)
                    human_delay(1.0, 2.0)

            finally:
                browser.close()

        if not all_jobs:
            logger.warning("[LinkedIn] Zero jobs — returning empty list.")
            return []

        logger.info(f"[LinkedIn] Complete: {len(all_jobs)} jobs")
        return all_jobs

    except Exception as e:
        logger.error(f"[LinkedIn] Fatal: {e}", exc_info=True)
        return []
