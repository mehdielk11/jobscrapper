"""Base scraper — abstract interface and shared utilities for all scrapers.

Every platform-specific scraper inherits from BaseScraper and implements
the `scrape()` method.  Shared concerns (HTTP fetching, fallback loading,
User-Agent rotation, rate-limiting) live here.
"""

import json
import logging
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from fake_useragent import UserAgent

logger = logging.getLogger(__name__)

# Fallback dataset path (project-root relative).
_FALLBACK_PATH = Path(__file__).resolve().parent / "static_dataset" / "jobs_sample.json"


class BaseScraper(ABC):
    """Abstract base for all platform scrapers."""

    def __init__(
        self,
        source_name: str,
        base_url: str,
        max_pages: int = 3,
        delay: float = 2.0,
    ) -> None:
        self.source_name = source_name
        self.base_url = base_url
        self.max_pages = max_pages
        self.delay = delay
        self._ua = UserAgent(fallback="Mozilla/5.0")

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    def _get_headers(self) -> Dict[str, str]:
        """Return request headers with a rotated User-Agent."""
        return {
            "User-Agent": self._ua.random,
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml",
        }

    def _fetch_page(self, url: str) -> Optional[str]:
        """GET a URL and return the HTML body, or None on failure."""
        try:
            resp = requests.get(url, headers=self._get_headers(), timeout=15)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            logger.warning("HTTP error for %s: %s", url, exc)
            return None

    def _sleep(self) -> None:
        """Polite delay between requests to avoid rate-limiting."""
        time.sleep(self.delay)

    # ------------------------------------------------------------------
    # Fallback
    # ------------------------------------------------------------------

    def load_fallback(self, source_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Load jobs from the static JSON fallback dataset.

        Args:
            source_filter: If provided, only return jobs whose ``source``
                field matches this value.
        """
        logger.info("Loading fallback dataset from %s", _FALLBACK_PATH)
        try:
            with open(_FALLBACK_PATH, "r", encoding="utf-8") as fh:
                jobs: List[Dict[str, Any]] = json.load(fh)
            if source_filter:
                jobs = [j for j in jobs if j.get("source") == source_filter]
            logger.info("Loaded %d jobs from fallback", len(jobs))
            return jobs
        except (FileNotFoundError, json.JSONDecodeError) as exc:
            logger.error("Fallback dataset load failed: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abstractmethod
    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape job offers and return a list of job dicts.

        Each dict must contain at minimum:
        ``title``, ``company``, ``location``, ``description``,
        ``url``, ``source``.
        """
