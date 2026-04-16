"""Inspect EmploiDiali and MarocAnnonces rendered card HTML via Playwright."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from playwright.sync_api import sync_playwright
from scraper.base_scraper import get_playwright_page, human_delay

with sync_playwright() as p:
    browser, ctx, page = get_playwright_page(p, headless=True)
    try:
        # ── EmploiDiali ──────────────────────────────────────────
        page.goto("https://emploidiali.ma/offres-emploi/", wait_until="domcontentloaded", timeout=25000)
        human_delay(2.0, 3.0)
        html = page.evaluate("""() => {
            const sel = 'li.job_listing, div.job_listing, article, li[class*=job], div[class*=job-card]';
            const cards = document.querySelectorAll(sel);
            if (!cards.length) {
                // try generic articles
                const arts = document.querySelectorAll('article');
                return 'NO CARDS via sel. Articles: ' + arts.length + '. Body: ' + document.body.innerHTML.substring(0, 3000);
            }
            return Array.from(cards).slice(0, 2).map(c => c.outerHTML).join('---NEXT---');
        }""")
        print("=== EMPLOIDIALI ===")
        print(html[:4000])

        # ── MarocAnnonces ─────────────────────────────────────────
        page.goto("https://www.marocannonces.com/categorie/309/Emploi/Offres-emploi.html",
                  wait_until="domcontentloaded", timeout=25000)
        human_delay(2.0, 3.0)
        html2 = page.evaluate("""() => {
            const sel = 'div.holder, li.ann, div.annonce, div[class*=listing]';
            const cards = document.querySelectorAll(sel);
            if (!cards.length) {
                return 'NO CARDS. Body: ' + document.body.innerHTML.substring(0, 3000);
            }
            return Array.from(cards).slice(0,2).map(c=>c.outerHTML).join('---NEXT---');
        }""")
        print("\n=== MAROCANNONCES ===")
        print(html2[:4000])
    finally:
        browser.close()
