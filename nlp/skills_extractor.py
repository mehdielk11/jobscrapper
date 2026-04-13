"""Skills extraction engine using KeyBERT and a predefined taxonomy.

Extracts required skills from unstructured job descriptions and normalizes them
against the skills taxonomy. Provides a bulk processing function to update
all jobs in the database.
"""

import logging
import json
import re
from pathlib import Path
from typing import List, Set

from keybert import KeyBERT
from tqdm import tqdm

from database.db_manager import get_all_jobs, save_skills_for_job

logger = logging.getLogger(__name__)

# Load taxonomy
_TAXONOMY_PATH = Path(__file__).resolve().parent / "skills_taxonomy.json"
try:
    with open(_TAXONOMY_PATH, "r", encoding="utf-8") as f:
        _TAXONOMY = json.load(f)
    _KNOWN_SKILLS = set(_TAXONOMY.get("skills", []))
    _SYNONYMS = _TAXONOMY.get("synonyms", {})
except (FileNotFoundError, json.JSONDecodeError) as e:
    logger.error("Failed to load skills_taxonomy.json: %s", e)
    _KNOWN_SKILLS = set()
    _SYNONYMS = {}

# Lazy loaded KeyBERT model
_kw_model = None

def _get_kw_model():
    """Lazily instantiate KeyBERT to avoid blocking module import."""
    global _kw_model
    if _kw_model is None:
        logger.info("Initializing KeyBERT model 'paraphrase-multilingual-MiniLM-L12-v2'...")
        # A lightweight multilingual model suitable for French and English
        _kw_model = KeyBERT("paraphrase-multilingual-MiniLM-L12-v2")
    return _kw_model

def extract_skills(text: str) -> List[str]:
    """Extract skills from a job description text.

    Args:
        text: Raw job description text.

    Returns:
        List of normalized, deduplicated lowercase skills.
    """
    if not text or not text.strip():
        return []

    text_lower = text.lower()
    extracted_skills: Set[str] = set()

    # 1. Direct matching to catch multi-word skills like "machine learning" or "power bi"
    # that might get split or down-ranked by KeyBERT. Add word boundaries for safety.
    for skill in _KNOWN_SKILLS:
        # Escape skill for safe regex padding, though our taxonomy uses simple strings
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, text_lower):
            extracted_skills.add(skill)

    for syn, true_skill in _SYNONYMS.items():
        pattern = r"\b" + re.escape(syn) + r"\b"
        if re.search(pattern, text_lower):
            extracted_skills.add(true_skill)

    # 2. KeyBERT keyword extraction
    kw_model = _get_kw_model()
    # Extract unigrams and bigrams
    keywords = kw_model.extract_keywords(
        text, 
        keyphrase_ngram_range=(1, 2), 
        stop_words=None, # Stopwords parameter doesn't natively support French in sklearn default, better left None for multilingual
        top_n=20
    )

    for kw, _score in keywords:
        kw_clean = kw.lower().strip()
        
        # Check against pure skills
        if kw_clean in _KNOWN_SKILLS:
            extracted_skills.add(kw_clean)
        # Check synonyms
        elif kw_clean in _SYNONYMS:
            extracted_skills.add(_SYNONYMS[kw_clean])
        else:
            # Try checking individual words in the keyword
            for word in kw_clean.split():
                if word in _KNOWN_SKILLS:
                    extracted_skills.add(word)
                elif word in _SYNONYMS:
                    extracted_skills.add(_SYNONYMS[word])

    return sorted(list(extracted_skills))

def process_all_jobs() -> None:
    """Fetch all jobs without skills from the database and extract skills for them."""
    jobs = get_all_jobs()
    
    # Filter for jobs that have no skills associated yet
    jobs_to_process = [j for j in jobs if not j.skills]
    
    if not jobs_to_process:
        logger.info("No jobs without skills to process.")
        return

    logger.info("Extracting skills for %d jobs...", len(jobs_to_process))
    
    processed_count = 0
    total_skills_added = 0
    
    for job in tqdm(jobs_to_process, desc="Extracting skills"):
        try:
            skills = extract_skills(job.description)
            if skills:
                added = save_skills_for_job(job.id, skills)
                total_skills_added += added
                processed_count += 1
        except Exception as e:
            logger.error("Failed to process skills for job id %d: %s", job.id, e)

    logger.info(
        "Finished processing. Successfully extracted skills for %d jobs, adding %d total skills.", 
        processed_count, total_skills_added
    )

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    process_all_jobs()
