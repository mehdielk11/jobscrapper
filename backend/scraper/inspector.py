"""Selector inspector — prints raw HTML structure to help debug broken selectors.

Run: python -m scraper.inspector <url>

Use any time a scraper returns 0 jobs despite the site being reachable.
It prints the first 8000 chars of formatted HTML and all unique CSS classes
found on container elements (div, li, article, section).
"""

import sys
from scraper.base_scraper import fetch_soup


def inspect(url: str) -> None:
    """Print the top-level HTML structure of a page for selector debugging.

    Args:
        url: The page URL to inspect.
    """
    print(f"\n{'=' * 60}\nInspecting: {url}\n{'=' * 60}")
    soup = fetch_soup(url, delay=1.0)
    if not soup:
        print("FAILED to fetch page.")
        return

    # Print first 8000 chars of formatted HTML
    print(soup.prettify()[:8000])

    # Print all unique class names found on container elements
    print("\n--- UNIQUE CLASSES ON CONTAINER ELEMENTS ---")
    classes: set = set()
    for tag in soup.find_all(["div", "li", "article", "section"]):
        for c in tag.get("class") or []:
            classes.add(c)
    for c in sorted(classes)[:80]:
        print(f"  .{c}")


if __name__ == "__main__":
    target_url = (
        sys.argv[1] if len(sys.argv) > 1 else "https://www.rekrute.com/offres.html"
    )
    inspect(target_url)
