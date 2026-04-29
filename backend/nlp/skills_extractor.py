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

from sklearn.feature_extraction.text import CountVectorizer
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

    # 2. Sklearn keyword extraction
    vectorizer = CountVectorizer(ngram_range=(1, 2), stop_words="english")
    try:
        vectorizer.fit([text])
        keywords = vectorizer.get_feature_names_out()
    except ValueError:
        keywords = []

    for kw in keywords:
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


# Global lock to prevent parallel extractions
import threading
_processing_lock = threading.Lock()


def process_all_jobs(target_status: str = "pending") -> None:
    """Fetch jobs matching the given status and extract skills.
    
    Protected by a singleton lock to ensure only one extraction runs at a time.
    
    Args:
        target_status: Which nlp_status to target ('pending', 'failed', 'no_skills_found').
    """
    if not _processing_lock.acquire(blocking=False):
        logger.info("NLP extraction already in progress. Skipping redundant trigger.")
        return

    try:
        jobs_to_process = get_jobs_without_skills(target_status=target_status)

        if not jobs_to_process:
            logger.info("No jobs with status '%s' to process.", target_status)
            from database.db_manager import update_nlp_status, save_scraper_log
            save_scraper_log(None, "INFO", f"NLP Engine: No '{target_status}' jobs to process.", source="nlp_engine")
            update_nlp_status("idle", total=0, processed=0)
            return

        logger.info(
            "Extracting skills for %d jobs...", len(jobs_to_process)
        )

        from database.db_manager import (
            update_nlp_status, 
            save_scraper_log,
            mark_job_nlp_status
        )

        total_jobs = len(jobs_to_process)
        update_nlp_status("processing", total=total_jobs, processed=0)
        save_scraper_log(None, "INFO", f"NLP Engine started: Processing {total_jobs} jobs.", source="nlp_engine")

        processed = 0
        no_skills = 0
        total_added = 0

        for i, job in enumerate(tqdm(jobs_to_process, desc="Extracting skills")):
            try:
                description = job.get("description", "")
                skills = extract_skills(description)
                if skills:
                    result = save_skills_for_job(job["id"], skills)
                    if result:
                        total_added += len(skills)
                        processed += 1
                    mark_job_nlp_status(job["id"], "extracted")
                else:
                    no_skills += 1
                    mark_job_nlp_status(job["id"], "no_skills_found")
                
                # Update status in DB every 5 jobs to throttle network traffic but maintain responsivity
                if (i + 1) % 5 == 0 or (i + 1) == total_jobs:
                    update_nlp_status("processing", total=total_jobs, processed=i + 1)

            except Exception as e:
                logger.error(
                    "Failed to process skills for job %s: %s",
                    job.get("id"),
                    e,
                )
                mark_job_nlp_status(job["id"], "failed")
                save_scraper_log(None, "ERROR", f"Job {job.get('id')} extraction failed: {str(e)}", source="nlp_engine")

        update_nlp_status("idle", total=total_jobs, processed=total_jobs)
        save_scraper_log(None, "INFO", f"NLP Engine finished. Extracted: {processed}, No skills: {no_skills}, Failed: {total_jobs - processed - no_skills} / {total_jobs} total.", source="nlp_engine")

        logger.info(
            "Finished. Extracted skills for %d jobs (%d no skills found), %d total skills.",
            processed,
            no_skills,
            total_added,
        )
    finally:
        _processing_lock.release()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    process_all_jobs()
