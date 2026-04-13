---
description: Run the full pipeline: scrape → extract skills → recommend for a test student profile
---

## Steps

### 1. Check environment
- Verify venv is active
- Run: python -c "import streamlit, spacy, sklearn" to check imports

### 2. Run scraper
- Execute: python -c "from scraper.rekrute_scraper import scrape; scrape(limit=10)"
- Log how many jobs were saved to the database

### 3. Run NLP extraction
- Execute skills extraction on all jobs that have no skills yet
- Log how many skills were extracted

### 4. Run recommendation test
- Use a test student profile: skills = ["Python", "Machine Learning", "SQL"]
- Run the recommender and print top 5 results with match scores

### 5. Report results
- Show a summary: jobs scraped, skills extracted, top recommendation + score