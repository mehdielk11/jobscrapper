"""Base scraper with shared utilities for all scrapers.

Provides HTTP fetching with User-Agent rotation, polite delays,
and a static dataset fallback.
"""

import logging
import os
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
from playwright.sync_api import sync_playwright

logger = logging.getLogger(__name__)
_ua = UserAgent(fallback="Mozilla/5.0")

# Local Chrome path to bypass Playwright browser download issues
_CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def get_soup(url: str, delay: float = 1.5) -> Optional[BeautifulSoup]:
    """Fetch a URL and return a BeautifulSoup object using requests."""
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

def get_soup_playwright(url: str, delay: float = 1.5) -> Optional[BeautifulSoup]:
    """Fetch a URL using Local Chrome via Playwright."""
    try:
        time.sleep(delay)
        with sync_playwright() as p:
            # Check if local chrome exists, otherwise fallback to default
            launch_kwargs = {"headless": True}
            if os.path.exists(_CHROME_PATH):
                launch_kwargs["executable_path"] = _CHROME_PATH
            
            browser = p.chromium.launch(**launch_kwargs)
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            
            # Wait for JS rendering
            page.wait_for_timeout(4000) 
            
            html_content = page.content()
            browser.close()
            
            return BeautifulSoup(html_content, "lxml")
    except Exception as e:
        logger.warning("get_soup_playwright failed for %s: %s", url, e)
        return None
