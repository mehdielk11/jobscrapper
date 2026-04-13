"""Skills extraction engine using KeyBERT and a predefined taxonomy.

Extracts required skills from unstructured job descriptions and normalizes
them against the skills taxonomy. Provides a bulk processing function to
update all jobs in the database.
"""

import json
import logging
import re
from pathlib import Path
from typing import List, Set

from keybert import KeyBERT
from tqdm import tqdm

from database.db_manager import (
    get_jobs_without_skills,
    save_skills_for_job,
)

logger = logging.getLogger(__name__)

# Load taxonomy
_TAXONOMY_PATH = Path(__file__).resolve().parent / "skills_taxonomy.json"
try:
    with open(_TAXONOMY_PATH, "r", encoding="utf-8") as f:
        _TAXONOMY = json.load(f)
    _KNOWN_SKILLS: Set[str] = set(_TAXONOMY.get("skills", []))
    _SYNONYMS: dict = _TAXONOMY.get("synonyms", {})
except (FileNotFoundError, json.JSONDecodeError) as e:
    logger.error("Failed to load skills_taxonomy.json: %s", e)
    _KNOWN_SKILLS = set()
    _SYNONYMS = {}

# Lazy loaded KeyBERT model
_kw_model = None


def _get_kw_model() -> KeyBERT:
    """Lazily instantiate KeyBERT to avoid blocking module import."""
    global _kw_model
    if _kw_model is None:
        logger.info(
            "Initializing KeyBERT model "
            "'paraphrase-multilingual-MiniLM-L12-v2'..."
        )
        _kw_model = KeyBERT(
            "paraphrase-multilingual-MiniLM-L12-v2"
        )
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

    # 1. Direct matching against known taxonomy
    for skill in _KNOWN_SKILLS:
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, text_lower):
            extracted_skills.add(skill)

    for syn, true_skill in _SYNONYMS.items():
        pattern = r"\b" + re.escape(syn) + r"\b"
        if re.search(pattern, text_lower):
            extracted_skills.add(true_skill)

    # 2. KeyBERT keyword extraction
    kw_model = _get_kw_model()
    keywords = kw_model.extract_keywords(
        text,
        keyphrase_ngram_range=(1, 2),
        stop_words=None,
        top_n=20,
    )

    for kw, _score in keywords:
        kw_clean = kw.lower().strip()

        if kw_clean in _KNOWN_SKILLS:
            extracted_skills.add(kw_clean)
        elif kw_clean in _SYNONYMS:
            extracted_skills.add(_SYNONYMS[kw_clean])
        else:
            for word in kw_clean.split():
                if word in _KNOWN_SKILLS:
                    extracted_skills.add(word)
                elif word in _SYNONYMS:
                    extracted_skills.add(_SYNONYMS[word])

    return sorted(list(extracted_skills))


def process_all_jobs() -> None:
    """Fetch jobs without skills from Supabase and extract skills."""
    jobs_to_process = get_jobs_without_skills()

    if not jobs_to_process:
        logger.info("No jobs without skills to process.")
        return

    logger.info(
        "Extracting skills for %d jobs...", len(jobs_to_process)
    )

    processed = 0
    total_added = 0

    for job in tqdm(jobs_to_process, desc="Extracting skills"):
        try:
            description = job.get("description", "")
            skills = extract_skills(description)
            if skills:
                result = save_skills_for_job(job["id"], skills)
                if result:
                    total_added += len(skills)
                    processed += 1
        except Exception as e:
            logger.error(
                "Failed to process skills for job %s: %s",
                job.get("id"),
                e,
            )

    logger.info(
        "Finished. Extracted skills for %d jobs, %d total skills.",
        processed,
        total_added,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    process_all_jobs()
