"""Base scraper with shared utilities for all scrapers.

Provides HTTP fetching with User-Agent rotation, polite delays,
and a static dataset fallback.
"""

import json
import logging
import time
from pathlib import Path
from typing import List, Optional

import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

logger = logging.getLogger(__name__)
_ua = UserAgent(fallback="Mozilla/5.0")

_FALLBACK_PATH = (
    Path(__file__).resolve().parent / "static_dataset" / "jobs_sample.json"
)


def get_soup(url: str, delay: float = 1.5) -> Optional[BeautifulSoup]:
    """Fetch a URL and return a BeautifulSoup object, or None on failure."""
    try:
        time.sleep(delay)
        headers = {
            "User-Agent": _ua.random,
            "Accept-Language": "fr-MA,fr;q=0.9,en;q=0.8",
        }
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        logger.warning("get_soup failed for %s: %s", url, e)
        return None


def load_static_fallback() -> List[dict]:
    """Load the static dataset as fallback when scraping fails."""
    if _FALLBACK_PATH.exists():
        data = json.loads(_FALLBACK_PATH.read_text(encoding="utf-8"))
        logger.info("Loaded %d jobs from static fallback", len(data))
        return data
    logger.error(
        "Static fallback dataset not found at %s", _FALLBACK_PATH
    )
    return []
