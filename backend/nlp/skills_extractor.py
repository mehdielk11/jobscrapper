"""AI-powered skills extraction engine using Gemini 3.1 Flash Lite.

Extracts and classifies (soft/hard) key skills from job descriptions
using the Gemini API. No static taxonomy or dictionary — the LLM reads
the description and returns structured JSON.

Supports multiple API keys for parallel extraction. Each key gets its own
worker thread and independent rate limiter. With N keys, throughput is ~N×15 RPM.

Architecture (producer/consumer):
  - N extraction threads (one per API key): call Gemini, push results to queue
  - 1 DB writer thread: consumes queue, writes to Supabase sequentially
  Workers NEVER touch the database, so they run at full parallel speed.

Rate limits PER KEY (free tier):
  - 15 requests per minute  → enforced via 4.1s sleep
  - 500 requests per day
  - 250K peak input tokens per minute
"""

import json
import logging
import os
import queue
import threading
import time
from typing import List, Dict

from dotenv import load_dotenv

from database.db_manager import (
    get_jobs_without_skills,
    save_skills_for_job,
    update_nlp_status,
    save_scraper_log,
    mark_job_nlp_status,
)

load_dotenv()
logger = logging.getLogger(__name__)

# ── Prompt ───────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an expert HR skills extractor. Your task is to extract KEY professional skills from a job description and classify each as "soft" or "hard".

DEFINITIONS:
- HARD SKILL: A specific, teachable, measurable ability. Includes: programming languages, frameworks, tools, platforms, databases, methodologies (agile, scrum, kanban, lean), certifiable disciplines (project management, accounting, data analysis), domain knowledge, technologies.
- SOFT SKILL: An interpersonal or self-management ability developed through experience. Includes: communication, teamwork, leadership, adaptability, creativity, emotional intelligence, time management, negotiation, problem solving.

RULES:
1. Extract only the IMPORTANT, SPECIFIC skills — not generic phrases like "good candidate" or "motivated".
2. Return each skill as a SHORT label (1-3 words max), e.g. "react", "python", "machine learning", "teamwork".
3. Use LOWERCASE for all skill names.
4. Do NOT include job titles, degrees, or years of experience as skills.
5. Maximum 20 skills per job.

RESPONSE FORMAT — return ONLY a JSON array, no markdown, no explanation:
[{"skill": "python", "category": "hard"}, {"skill": "teamwork", "category": "soft"}]

If the text has no extractable skills, return: []"""

_MODEL = "gemini-3.1-flash-lite-preview"

# ── Multi-key worker pool ────────────────────────────────────────────────────

_MIN_DELAY_SECONDS = 4.1  # 60s / 15 RPM ≈ 4.0s, using 4.1 for safety margin


class _GeminiWorker:
    """One worker per API key — owns its own client and rate limiter."""

    def __init__(self, api_key: str, worker_id: int):
        self.worker_id = worker_id
        self._api_key = api_key
        self._client = None
        self._last_call = 0.0
        self._lock = threading.Lock()

    def _get_client(self):
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    def _wait_for_rate_limit(self):
        with self._lock:
            now = time.time()
            elapsed = now - self._last_call
            if elapsed < _MIN_DELAY_SECONDS:
                time.sleep(_MIN_DELAY_SECONDS - elapsed)
            self._last_call = time.time()

    def extract(self, text: str) -> List[Dict[str, str]]:
        """Extract skills using THIS worker's API key and rate limiter."""
        if not text or not text.strip() or len(text.strip()) < 30:
            return []

        truncated = text[:4000]
        self._wait_for_rate_limit()

        try:
            client = self._get_client()
            response = client.models.generate_content(
                model=_MODEL,
                contents=f"{_SYSTEM_PROMPT}\n\n---\nJOB DESCRIPTION:\n{truncated}",
            )

            raw = response.text.strip()

            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1]
                if raw.endswith("```"):
                    raw = raw[:-3].strip()

            skills = json.loads(raw)

            # Validate structure
            validated = []
            seen = set()
            for item in skills:
                if not isinstance(item, dict):
                    continue
                skill = item.get("skill", "").lower().strip()
                category = item.get("category", "").lower().strip()
                if not skill or category not in ("soft", "hard"):
                    continue
                if skill not in seen:
                    seen.add(skill)
                    validated.append({"skill": skill, "category": category})

            return validated[:20]  # Cap at 20

        except json.JSONDecodeError as e:
            logger.warning("[Worker %d] Gemini returned invalid JSON: %s", self.worker_id, e)
            return []
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "resource_exhausted" in error_str:
                logger.warning("[Worker %d] Rate limited. Waiting 60s...", self.worker_id)
                time.sleep(60)
                try:
                    return self.extract(text)
                except Exception:
                    pass
            logger.error("[Worker %d] Gemini extraction failed: %s", self.worker_id, e)
            return []


def _build_worker_pool() -> List[_GeminiWorker]:
    """Build the worker pool from all available GEMINI_API_KEY* env vars."""
    workers = []

    # Primary key (required)
    key1 = os.getenv("GEMINI_API_KEY")
    if not key1:
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is not set. "
            "Get a free key at https://aistudio.google.com/apikey"
        )
    workers.append(_GeminiWorker(key1, worker_id=0))

    # Additional keys (optional) — GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc.
    for i in range(2, 10):
        extra_key = os.getenv(f"GEMINI_API_KEY_{i}")
        if extra_key:
            workers.append(_GeminiWorker(extra_key, worker_id=i - 1))

    return workers


# Lazy-init pool
_worker_pool: List[_GeminiWorker] = []
_pool_init_lock = threading.Lock()


def _get_worker_pool() -> List[_GeminiWorker]:
    global _worker_pool
    if not _worker_pool:
        with _pool_init_lock:
            if not _worker_pool:
                _worker_pool = _build_worker_pool()
                logger.info("Gemini worker pool: %d key(s) loaded → ~%d RPM throughput",
                            len(_worker_pool), len(_worker_pool) * 15)
    return _worker_pool


# ── Legacy single-call interface (for use outside batch processing) ──────────

def extract_skills(text: str) -> List[Dict[str, str]]:
    """Extract skills using the first available worker. For single-call use."""
    pool = _get_worker_pool()
    return pool[0].extract(text)


# ── Batch processing (producer/consumer) ─────────────────────────────────────

_processing_lock = threading.Lock()
_stop_event = threading.Event()

# Sentinel to signal DB writer to exit
_QUEUE_DONE = object()


def request_stop():
    """Signal the extraction loop to stop after the current job."""
    _stop_event.set()


def is_running() -> bool:
    """Return True if the extraction loop currently holds the lock."""
    if _processing_lock.acquire(blocking=False):
        _processing_lock.release()
        return False
    return True


def _extraction_worker(worker: _GeminiWorker, jobs: list, result_queue: queue.Queue):
    """Dedicated thread: extract skills via Gemini, push results to queue.

    Does NOT touch the database — only API calls + queue writes.
    """
    for job in jobs:
        if _stop_event.is_set():
            break
        job_id = job.get("id")
        description = job.get("description", "")
        try:
            skills = worker.extract(description)
            result_queue.put(("ok", job_id, skills))
        except Exception as e:
            logger.error("[Worker %d] Job %s failed: %s", worker.worker_id, job_id, e)
            result_queue.put(("error", job_id, str(e)))


def _db_writer(result_queue: queue.Queue, total_jobs: int, results_out: list):
    """Single thread: consume extraction results and write to Supabase.

    DB writes happen here sequentially, completely decoupled from the
    extraction workers. The queue acts as a buffer so workers never wait.
    """
    completed = 0
    processed = 0
    no_skills = 0
    failed = 0
    total_added = 0

    while True:
        item = result_queue.get()
        if item is _QUEUE_DONE:
            break

        status, job_id, payload = item
        try:
            if status == "error":
                mark_job_nlp_status(job_id, "failed")
                save_scraper_log(None, "ERROR", f"Job {job_id} extraction failed: {payload}", source="nlp_engine")
                failed += 1
            elif payload:  # skills list is non-empty
                save_skills_for_job(job_id, payload)
                mark_job_nlp_status(job_id, "extracted")
                processed += 1
                total_added += len(payload)
            else:
                mark_job_nlp_status(job_id, "no_skills_found")
                no_skills += 1
        except Exception as e:
            logger.error("DB write failed for job %s: %s", job_id, e)
            failed += 1

        completed += 1
        if completed % 5 == 0 or completed == total_jobs:
            update_nlp_status("processing", total=total_jobs, processed=completed)

    # Write results back through mutable list
    results_out[:] = [processed, no_skills, failed, total_added]


def process_all_jobs(target_status: str = "pending") -> None:
    """Fetch jobs and extract skills using all available API keys in parallel.

    Architecture:
      - N extraction threads (one per API key): call Gemini, push to queue
      - 1 DB writer thread: pulls from queue, writes to Supabase

    Workers NEVER touch the database, so they run at full speed (~4.1s/job).
    With N keys, throughput is ~N × 15 RPM.
    """
    if not _processing_lock.acquire(blocking=False):
        logger.info("NLP extraction already in progress. Skipping redundant trigger.")
        return

    total_jobs = 0
    processed_count = 0
    writer_results: list = []

    try:
        pool = _get_worker_pool()
        num_workers = len(pool)

        jobs_to_process = get_jobs_without_skills(target_status=target_status)

        if not jobs_to_process:
            logger.info("No jobs with status '%s' to process.", target_status)
            save_scraper_log(None, "INFO", f"NLP Engine: No '{target_status}' jobs to process.", source="nlp_engine")
            update_nlp_status("idle", total=0, processed=0)
            return

        total_jobs = len(jobs_to_process)
        logger.info(
            "Extracting skills (Gemini) for %d jobs with %d worker(s)...",
            total_jobs, num_workers,
        )

        update_nlp_status("processing", total=total_jobs, processed=0)
        save_scraper_log(None, "INFO", f"NLP Engine started: {total_jobs} jobs, {num_workers} API key(s).", source="nlp_engine")
        _stop_event.clear()

        # Split jobs into slices — interleaved for fairness
        # Worker 0 gets jobs[0, 4, 8, ...], Worker 1 gets jobs[1, 5, 9, ...], etc.
        slices: list[list] = [[] for _ in range(num_workers)]
        for idx, job in enumerate(jobs_to_process):
            slices[idx % num_workers].append(job)

        result_queue: queue.Queue = queue.Queue()

        # 1. Start DB writer thread (consumer)
        db_thread = threading.Thread(
            target=_db_writer,
            args=(result_queue, total_jobs, writer_results),
            name="db-writer",
            daemon=True,
        )
        db_thread.start()

        # 2. Start extraction worker threads (producers)
        worker_threads = []
        for i, worker in enumerate(pool):
            t = threading.Thread(
                target=_extraction_worker,
                args=(worker, slices[i], result_queue),
                name=f"gemini-worker-{i}",
                daemon=True,
            )
            worker_threads.append(t)

        logger.info("Launching %d extraction workers + 1 DB writer...", num_workers)
        for t in worker_threads:
            t.start()

        # 3. Wait for all extraction workers to finish
        for t in worker_threads:
            t.join()

        # 4. Signal DB writer to drain remaining items and stop
        result_queue.put(_QUEUE_DONE)
        db_thread.join()

        processed, no_skills, failed, total_added = writer_results if len(writer_results) == 4 else (0, 0, 0, 0)
        processed_count = processed + no_skills + failed

        if _stop_event.is_set():
            save_scraper_log(None, "WARNING", f"NLP Engine stopped early. Completed {processed_count}/{total_jobs} jobs.", source="nlp_engine")
        else:
            save_scraper_log(None, "INFO", f"NLP Engine finished. Extracted: {processed}, No skills: {no_skills}, Failed: {failed} / {total_jobs} total ({num_workers} workers).", source="nlp_engine")

        logger.info(
            "Finished. Extracted: %d, No skills: %d, Failed: %d, Total skills: %d. Workers: %d.",
            processed, no_skills, failed, total_added, num_workers,
        )
    except Exception as e:
        logger.exception("Fatal error in NLP Engine: %s", e)
        save_scraper_log(None, "ERROR", f"NLP Engine crashed: {e}", source="nlp_engine")
    finally:
        if len(writer_results) == 4:
            processed_count = writer_results[0] + writer_results[1] + writer_results[2]
        
        # ALWAYS reset status to idle when leaving this function
        # Using processed_count so that if stopped early, it shows the correct # of processed jobs.
        update_nlp_status("idle", total=total_jobs, processed=processed_count)
        _processing_lock.release()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    process_all_jobs()
