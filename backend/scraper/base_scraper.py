"""Base scraper utilities shared by all scrapers.

Provides: static fetching (requests), dynamic fetching (Playwright+stealth),
          User-Agent rotation, polite delays, and static fallback loading.
"""

import time
import random
import logging
import json
import warnings
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

# Silence the pkg_resources deprecation that playwright_stealth triggers
warnings.filterwarnings(
    "ignore",
    message="pkg_resources is deprecated",
    category=UserWarning,
)

logger = logging.getLogger(__name__)

# Reuse a single UserAgent instance (thread-safe reads).
# use_cache_server=False prevents any network call on init — uses the
# bundled browser UA list that ships with the fake_useragent package.
_FALLBACK_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
try:
    _ua = UserAgent(
        browsers=["chrome", "firefox", "edge"],
        use_cache_server=False,
    )
except Exception:
    _ua = None  # type: ignore[assignment]
    logger.debug("fake_useragent init failed — using static fallback UA")


def _random_ua() -> str:
    """Return a random User-Agent string, falling back to a static Chrome UA."""
    try:
        return _ua.random if _ua else _FALLBACK_UA
    except Exception:
        return _FALLBACK_UA


# ── Static site helpers ────────────────────────────────────────────────────

HEADERS_BASE = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-MA,fr;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


def make_session() -> requests.Session:
    """Return a requests.Session with a fresh random User-Agent."""
    s = requests.Session()
    s.headers.update({**HEADERS_BASE, "User-Agent": _random_ua()})
    return s


def fetch_soup(
    url: str,
    session: Optional[requests.Session] = None,
    delay: float = 1.5,
    retries: int = 3,
) -> Optional[BeautifulSoup]:
    """Fetch a URL and return a BeautifulSoup object.

    Retries up to `retries` times on network/HTTP errors.
    Returns None on permanent failure — never raises.
    """
    s = session or make_session()
    for attempt in range(1, retries + 1):
        try:
            jitter = random.uniform(0.5, 1.5)
            time.sleep(delay + jitter)
            resp = s.get(url, timeout=20)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding  # handle Arabic/French encoding
            return BeautifulSoup(resp.text, "lxml")
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response else 0
            if status in (403, 429, 503):
                wait = 10 * attempt
                logger.warning(f"[{url}] HTTP {status} — waiting {wait}s (attempt {attempt})")
                time.sleep(wait)
            else:
                logger.warning(f"[{url}] HTTP error {status}: {e}")
                break
        except requests.exceptions.RequestException as e:
            logger.warning(f"[{url}] Request failed (attempt {attempt}): {e}")
            time.sleep(3 * attempt)
    logger.error(f"fetch_soup gave up after {retries} attempts: {url}")
    return None


def clean_text(text: Optional[str]) -> str:
    """Strip whitespace and normalize newlines from extracted text."""
    if not text:
        return ""
    return " ".join(text.split())


# ── Dynamic site helpers (Playwright + stealth) ────────────────────────────

import threading

# Limit concurrent Playwright instances to avoid CPU/RAM exhaustion when multiple
# scrapers are triggered at the same time. Third+ caller blocks until a slot frees.
_playwright_semaphore = threading.Semaphore(2)


def get_playwright_page(playwright_instance, headless: bool = True):
    """Launch a stealthy Chromium page (max 2 concurrent instances).

    Acquires a semaphore slot before launching — callers block if both slots
    are taken. The slot is released automatically when browser.close() is called.
    Returns (browser, context, page) — caller must always call browser.close().
    """
    try:
        from playwright_stealth import stealth_sync
        stealth_available = True
    except ImportError:
        stealth_available = False
        logger.warning("playwright-stealth not installed — running without stealth patches")

    # Block until a concurrency slot is available (max 2 Playwright instances at once)
    _playwright_semaphore.acquire()

    try:
        browser = playwright_instance.chromium.launch(
            headless=headless,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1280,720",
            ],
        )
    except Exception:
        _playwright_semaphore.release()
        raise

    # Patch browser.close() to also release the semaphore slot
    _orig_close = browser.close
    def _close_and_release():
        try:
            _orig_close()
        finally:
            _playwright_semaphore.release()
    browser.close = _close_and_release  # type: ignore[method-assign]

    context = browser.new_context(
        viewport={"width": 1280, "height": 720},
        locale="fr-MA",
        timezone_id="Africa/Casablanca",
        user_agent=_random_ua(),
        extra_http_headers={
            "Accept-Language": "fr-MA,fr;q=0.9,en;q=0.8",
        },
    )
    page = context.new_page()

    # Block images, fonts, media to speed up scraping
    page.route(
        "**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,mp4,mp3}",
        lambda route: route.abort(),
    )

    if stealth_available:
        from playwright_stealth import stealth_sync
        stealth_sync(page)

    return browser, context, page



def human_delay(min_s: float = 1.5, max_s: float = 4.0) -> None:
    """Sleep for a random human-like duration."""
    time.sleep(random.uniform(min_s, max_s))


# ── Fallback dataset ───────────────────────────────────────────────────────

def load_static_fallback() -> list:
    """Deprecated — always returns an empty list.

    Previously loaded a bundled demo dataset; that behaviour has been removed
    so that only real scraped data ever enters the database.
    """
    return []


def normalize_job(job: dict) -> dict:
    """Ensure all required fields are present with safe defaults."""
    return {
        "title": clean_text(job.get("title")) or "Poste non spécifié",
        "company": clean_text(job.get("company")) or "Entreprise non spécifiée",
        "location": clean_text(job.get("location")) or "Maroc",
        "description": clean_text(job.get("description")) or "",
        "source": job.get("source", "unknown"),
        "url": job.get("url", ""),
    }
