"""Integration test — run all 6 scrapers with limit=5 and report results.

Usage:
    python -m scraper.test_all

Success criteria:
  - Each scraper returns >= 1 job
  - title, company, url are non-empty strings
  - url starts with https://
  - Graceful fallback (static dataset) on scraper failure — not an empty list
"""

import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")

from scraper.rekrute_scraper import scrape as rekrute
from scraper.emploidiali_scraper import scrape as emploidiali
from scraper.emploipublic_scraper import scrape as emploipublic
from scraper.marocannonces_scraper import scrape as marocannonces
from scraper.indeed_scraper import scrape as indeed
from scraper.linkedin_scraper import scrape as linkedin

SCRAPERS = {
    "ReKrute":       rekrute,
    "EmploiDiali":   emploidiali,
    "EmploiPublic":  emploipublic,
    "MarocAnnonces": marocannonces,
    "Indeed":        indeed,
    "LinkedIn":      linkedin,
}


def _validate(jobs: list, name: str) -> bool:
    """Validate that each job has required non-empty fields.

    Returns True if all jobs pass, False otherwise.
    """
    if not jobs:
        print(f"  [FAIL] zero jobs returned")
        return False
    for i, job in enumerate(jobs):
        for field in ("title", "company", "url"):
            if not job.get(field):
                print(f"  [FAIL] job #{i} missing field: {field}")
                return False
        if not job["url"].startswith("https://"):
            print(f"  [FAIL] job #{i} has invalid URL: {job['url'][:80]}")
            return False
    return True


def main() -> None:
    """Run all scrapers and print a summary report."""
    results = {}

    for name, fn in SCRAPERS.items():
        print(f"\n{'- ' * 25}")
        print(f"Testing: {name}")
        try:
            jobs = fn(limit=5)
            ok = _validate(jobs, name)
            results[name] = {"count": len(jobs), "passed": ok}
            if jobs:
                sample = jobs[0]
                print(f"  [OK] {len(jobs)} job(s) returned")
                print(f"  Sample : {sample['title']} @ {sample['company']} ({sample['location']})")
                print(f"  URL    : {sample['url']}")
                desc_preview = (sample.get("description") or "")[:100]
                print(f"  Desc   : {desc_preview}{'...' if len(desc_preview) == 100 else ''}")
        except Exception as exc:
            results[name] = {"count": 0, "passed": False}
            print(f"  [EXC] EXCEPTION: {exc}")

    # Summary table
    print(f"\n{'=' * 50}")
    print("SUMMARY")
    print(f"{'=' * 50}")
    for name, r in results.items():
        status = "[PASS]" if r["passed"] else "[FAIL]"
        print(f"  {status}  {name:20s}  {r['count']} job(s)")


if __name__ == "__main__":
    main()
