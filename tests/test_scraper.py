import pytest
from unittest.mock import patch, MagicMock
from scraper.rekrute_scraper import scrape as rekrute_scrape
from scraper.emploidiali_scraper import scrape as emploidiali_scrape

@patch("scraper.rekrute_scraper.get_soup")
def test_rekrute_scraper(mock_get_soup):
    mock_soup = MagicMock()
    mock_soup.find_all.return_value = []
    mock_get_soup.return_value = mock_soup

    # Since it finds 0 list items, it should gracefully return empty list
    jobs = rekrute_scrape(limit=5)
    assert isinstance(jobs, list)

@patch("scraper.emploidiali_scraper.get_soup")
def test_emploidiali_scraper(mock_get_soup):
    mock_soup = MagicMock()
    mock_soup.find_all.return_value = []
    mock_get_soup.return_value = mock_soup

    jobs = emploidiali_scrape(limit=5)
    assert isinstance(jobs, list)
