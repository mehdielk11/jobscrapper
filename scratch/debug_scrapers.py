import logging
from scraper.base_scraper import get_soup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_site(name, url):
    logger.info(f"Debugging {name}: {url}")
    soup = get_soup(url)
    if not soup:
        logger.error(f"Failed to fetch {name}")
        return
    
    # Print a snippet of the HTML to see what we're getting
    print(f"\n--- {name} HTML Content Snippet ---")
    print(soup.prettify()[:1000])
    
    # Check for specific selectors
    if name == "EmploiPublic":
        cards = soup.select("a.card.card-scale")
        print(f"\nEmploiPublic: Found {len(cards)} cards with 'a.card.card-scale'")
    elif name == "MarocAnnonces":
        cards = soup.select("li.annonces_list_item")
        print(f"\nMarocAnnonces: Found {len(cards)} cards with 'li.annonces_list_item'")
        if not cards:
            cards = soup.select("ul.cars-list li")
            print(f"MarocAnnonces: Found {len(cards)} cards with 'ul.cars-list li'")

if __name__ == "__main__":
    debug_site("EmploiPublic", "https://www.emploi-public.ma/fr/concoursListe.asp")
    debug_site("MarocAnnonces", "https://www.marocannonces.com/categorie/309/Emploi/Offres-emploi.html")
