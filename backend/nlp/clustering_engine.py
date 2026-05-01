"""High-Precision Asynchronous Clustering Engine for Skills Normalization.

This module replaces static taxonomies by dynamically clustering raw skills
extracted by the LLM. It prioritizes Precision over Recall to avoid merging
distinct technologies (e.g., "Java" vs. "JavaScript").

Runs periodically via APScheduler (every 6 hours).
"""

import logging
import re
import threading
from typing import Dict, List, Set, Tuple
from collections import defaultdict

from rapidfuzz.distance import JaroWinkler

from database.supabase_client import get_service_client
from database.db_manager import save_scraper_log, update_clustering_status

logger = logging.getLogger(__name__)

_clustering_lock = threading.Lock()
_clustering_stop = threading.Event()


def request_clustering_stop():
    """Signal the clustering loop to stop."""
    _clustering_stop.set()


def is_clustering_running() -> bool:
    """Return True if the clustering loop currently holds the lock."""
    if _clustering_lock.acquire(blocking=False):
        _clustering_lock.release()
        return False
    return True

# ── Clustering Parameters ────────────────────────────────────────────────────

SIMILARITY_THRESHOLD = 90.0
MIN_FUZZY_LENGTH = 4


def clean_skill_string(skill: str) -> str:
    s = re.sub(r"[^\w\s]", "", skill.lower())
    s = re.sub(r"\s+", " ", s).strip()
    return s


def run_clustering() -> None:
    if not _clustering_lock.acquire(blocking=False):
        logger.info("Clustering already in progress. Skipping.")
        save_scraper_log(None, "WARNING", "Clustering already running — skipped.", source="clustering")
        return

    try:
        _clustering_stop.clear()
        logger.info("Starting High-Precision Skill Clustering Engine...")
        save_scraper_log(None, "INFO", "Clustering Engine started.", source="clustering")
        update_clustering_status("processing", "Fetching skills...", 0, 0)

        client = get_service_client()
        
        all_rows = []
        page_size = 1000
        offset = 0
        while True:
            if _clustering_stop.is_set():
                save_scraper_log(None, "WARNING", "Clustering stopped during fetch.", source="clustering")
                return
                
            res = (
                client.table("job_skills")
                .select("*")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            data = res.data or []
            all_rows.extend(data)
            if len(data) < page_size:
                break
            offset += page_size
            
            update_clustering_status("processing", "Fetching skills...", len(all_rows), len(all_rows))
            
        if not all_rows:
            logger.info("No skills found to cluster.")
            save_scraper_log(None, "INFO", "No skills found to cluster.", source="clustering")
            return

        total_skills = len(all_rows)
        logger.info("Fetched %d skill rows for clustering.", total_skills)
        update_clustering_status("processing", "Mapping frequencies...", 0, total_skills)

        frequency_map: Dict[str, int] = defaultdict(int)
        ids_by_raw_skill: Dict[str, List[str]] = defaultdict(list)
        
        for row in all_rows:
            raw = row.get("skill", "").strip()
            if not raw:
                continue
            frequency_map[raw] += 1
            ids_by_raw_skill[raw].append(row["id"])

        unique_skills = sorted(frequency_map.keys(), key=lambda k: frequency_map[k], reverse=True)
        total_unique = len(unique_skills)

        canonical_map: Dict[str, str] = {}
        
        update_clustering_status("processing", "Clustering skills...", 0, total_unique)
        
        for i, skill in enumerate(unique_skills):
            if _clustering_stop.is_set():
                logger.info("Clustering stop requested. Aborting.")
                save_scraper_log(None, "WARNING", f"Clustering stopped early after {i}/{total_unique} unique skills.", source="clustering")
                return

            if i % 100 == 0 or i == total_unique - 1:
                update_clustering_status("processing", "Clustering skills...", i + 1, total_unique)

            if skill in canonical_map:
                continue
                
            canonical_map[skill] = skill
            cleaned_centroid = clean_skill_string(skill)
            
            if len(cleaned_centroid) < MIN_FUZZY_LENGTH:
                continue
                
            for other_skill in unique_skills:
                if other_skill in canonical_map:
                    continue
                    
                cleaned_other = clean_skill_string(other_skill)
                if len(cleaned_other) < MIN_FUZZY_LENGTH:
                    continue
                    
                score = JaroWinkler.similarity(cleaned_centroid, cleaned_other) * 100
                if score >= SIMILARITY_THRESHOLD:
                    canonical_map[other_skill] = skill

        update_clustering_status("processing", "Saving updates...", 0, total_skills)
        
        updates = []
        for row in all_rows:
            raw = row.get("skill", "").strip()
            if not raw:
                continue
                
            new_canonical = canonical_map.get(raw, raw)
            old_canonical = row.get("canonical_skill")
            
            if new_canonical != old_canonical:
                updated_row = dict(row)
                updated_row["canonical_skill"] = new_canonical
                updates.append(updated_row)

        if updates:
            logger.info("Updating %d rows with new canonical mappings...", len(updates))
            save_scraper_log(None, "INFO", f"Applying {len(updates)} canonical mappings...", source="clustering")
            
            chunk_size = 500
            for i in range(0, len(updates), chunk_size):
                if _clustering_stop.is_set():
                    save_scraper_log(None, "WARNING", f"Clustering stopped during save. {i}/{len(updates)} saved.", source="clustering")
                    return
                    
                chunk = updates[i:i + chunk_size]
                client.table("job_skills").upsert(chunk).execute()
                update_clustering_status("processing", "Saving updates...", i + len(chunk), len(updates))
                
            logger.info("Successfully applied clustering updates.")
            save_scraper_log(None, "INFO", f"Clustering finished: {len(updates)} rows updated.", source="clustering")
        else:
            logger.info("No canonical updates needed. Clusters are stable.")
            save_scraper_log(None, "INFO", "Clustering finished: No updates needed.", source="clustering")

    except Exception as e:
        logger.error("Clustering Engine failed: %s", e)
        save_scraper_log(None, "ERROR", f"Clustering engine crashed: {e}", source="clustering")
    finally:
        update_clustering_status("idle", "", 0, 0)
        _clustering_lock.release()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_clustering()
