"""Quick targeted test for the 4 static scrapers after selector fixes."""
import logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s - %(message)s")

from scraper.rekrute_scraper import scrape as rekrute
from scraper.emploidiali_scraper import scrape as emploidiali
from scraper.emploipublic_scraper import scrape as emploipublic
from scraper.marocannonces_scraper import scrape as marocannonces

tests = [
    ("ReKrute", rekrute),
    ("EmploiDiali", emploidiali),
    ("EmploiPublic", emploipublic),
    ("MarocAnnonces", marocannonces),
]

results = {}
for name, fn in tests:
    print(f"\n--- {name} ---")
    try:
        jobs = fn(limit=3)
        print(f"  Jobs returned: {len(jobs)}")
        if jobs:
            j = jobs[0]
            print(f"  Title  : {j['title']}")
            print(f"  Company: {j['company']}")
            print(f"  URL    : {j['url'][:80]}")
        results[name] = len(jobs)
    except Exception as e:
        print(f"  EXCEPTION: {e}")
        results[name] = -1

print("\n\n=== SUMMARY ===")
for name, count in results.items():
    status = "[PASS]" if count > 0 else "[FAIL]"
    print(f"  {status}  {name:20s}  {count} job(s)")
