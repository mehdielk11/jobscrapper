"""Indeed Morocco scraper.

Uses Playwright + stealth because Indeed renders job cards via JavaScript.
Handles bot detection with human-like delays and stealth patches.
Paginates via &start=N (10 results per page).
"""

import logging
from urllib.parse import urlparse, parse_qs, urlencode
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from scraper.base_scraper import (
    normalize_job,
    get_playwright_page,
    human_delay,
)

logger = logging.getLogger(__name__)

SOURCE = "Indeed"
SEARCH_URL = "https://ma.indeed.com/jobs?q=&l=Maroc&sort=date"
INDEED_BASE = "https://ma.indeed.com"


def _clean_indeed_url(href: str) -> str:
    """Convert Indeed tracking/redirect URLs to clean canonical job URLs.

    Indeed often returns pagead/clk?... or /rc/clk?... redirect links.
    We extract the `jk` (job key) query param and build a clean /viewjob URL.
    Falls back to the raw href if parsing fails.
    """
    try:
        full = href if href.startswith("http") else f"{INDEED_BASE}{href}"
        parsed = urlparse(full)
        params = parse_qs(parsed.query)
        # jk = job key present in both direct and tracking URLs
        if "jk" in params:
            return f"{INDEED_BASE}/viewjob?jk={params['jk'][0]}"
        # Clean page if no tracking params
        return full
    except Exception:
        return href if href.startswith("http") else f"{INDEED_BASE}{href}"



def _extract_jobs_from_page(page) -> list:
    """Extract all job cards visible on the current Indeed search page.

    Waits for the job list to render, then queries multiple selector variants
    to remain resilient to Indeed's frequent UI updates.
    """
    jobs: list = []
    try:
        # Confirmed live selector (inspected 2026-04): .job_seen_beacon (16 per page)
        # Increased timeout to 25s — Indeed JS can be slow under server load
        page.wait_for_selector(
            ".job_seen_beacon, .tapItem, .result",
            timeout=25000,
        )
    except PlaywrightTimeout:
        logger.warning("[Indeed] Job list selector timed out — using fallback.")
        return jobs

    try:
        # Primary: .job_seen_beacon — confirmed live (2026-04)
        # Fallbacks: .tapItem, .result — alternative wrappers Indeed uses
        cards = page.query_selector_all(
            ".job_seen_beacon, "
            ".tapItem:not(.sponTapItem), "
            "li.css-5lfssm, "
            "div[class*='jobCard'], "
            "td.resultContent"
        )
        logger.info(f"[Indeed] Found {len(cards)} cards on current page")

        for card in cards:
            try:
                title_el = card.query_selector(
                    "h2.jobTitle span[title], h2.jobTitle a span, span[id*='jobTitle']"
                )
                title_text = title_el.inner_text().strip() if title_el else None

                company_el = card.query_selector(
                    "span[data-testid='company-name'], "
                    "span.companyName, "
                    ".company_location span:first-child"
                )
                company_text = company_el.inner_text().strip() if company_el else "N/A"

                location_el = card.query_selector(
                    "div[data-testid='text-location'], "
                    "div.companyLocation, "
                    "span.locationsContainer"
                )
                location_text = (
                    location_el.inner_text().strip() if location_el else "Maroc"
                )

                link = card.query_selector("h2.jobTitle a, a.jcs-JobTitle")
                href = link.get_attribute("href") if link else None
                if not href:
                    continue

                # Clean tracking redirects: extract jk= param for canonical URL
                url = _clean_indeed_url(href)

                # Snippet preview available in the card itself
                snippet = card.query_selector(
                    "div.job-snippet ul, div[class*='SnippetList']"
                )
                description = snippet.inner_text().strip() if snippet else ""

                if title_text and url:
                    jobs.append(
                        normalize_job(
                            {
                                "title": title_text,
                                "company": company_text,
                                "location": location_text,
                                "description": description,
                                "source": SOURCE,
                                "url": url,
                            }
                        )
                    )
            except Exception as e:
                logger.debug(f"[Indeed] Card parse error: {e}")
                continue

    except Exception as e:
        logger.warning(f"[Indeed] Page extraction error: {e}")

    return jobs


def scrape(limit: int = 50) -> list:
    """Scrape job listings from Indeed Morocco using Playwright + stealth.

    Paginates using Indeed's `start=` URL parameter (10 jobs per page).

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
                logger.info(f"[Indeed] Navigating to {SEARCH_URL}")
                page.goto(SEARCH_URL, wait_until="domcontentloaded", timeout=30000)
                human_delay(2.0, 4.0)

                # Check for CAPTCHA or block page
                content = page.content()
                if "captcha" in content.lower() or "verify you are human" in content.lower():
                    logger.warning("[Indeed] CAPTCHA detected — returning empty list.")
                    return []

                start = 0
                while len(all_jobs) < limit:
                    if start > 0:
                        paginated_url = f"{SEARCH_URL}&start={start}"
                        logger.info(f"[Indeed] Paginating to start={start}")
                        page.goto(
                            paginated_url, wait_until="domcontentloaded", timeout=30000
                        )
                        human_delay(1.5, 3.5)

                    page_jobs = _extract_jobs_from_page(page)

                    if not page_jobs:
                        logger.info(f"[Indeed] No jobs at start={start} — stopping.")
                        break

                    for job in page_jobs:
                        if job["url"] not in seen_urls and len(all_jobs) < limit:
                            seen_urls.add(job["url"])
                            all_jobs.append(job)

                    logger.info(
                        f"[Indeed] start={start}: got {len(page_jobs)}, total: {len(all_jobs)}"
                    )
                    start += 10

                    # Simulate scroll before next page to trigger lazy loading
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    human_delay(1.0, 2.0)

            finally:
                browser.close()

        if not all_jobs:
            logger.warning("[Indeed] Zero jobs — returning empty list.")
            return []

        logger.info(f"[Indeed] Complete: {len(all_jobs)} jobs")
        return all_jobs

    except Exception as e:
        logger.error(f"[Indeed] Fatal: {e}", exc_info=True)
        return []
