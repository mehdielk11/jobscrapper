"""Recommendation ranker — Weighted Category-Aware Strict Matching.

Replaces the previous token-overlap heuristic with a precision-first
approach that categorizes skills and applies differential weights to
eliminate false positives from generic soft-skill overlap.
"""

import json
import logging
import re
from pathlib import Path
from typing import List, Set, Dict, Tuple

logger = logging.getLogger(__name__)

# ── Category weights ─────────────────────────────────────────────────────────
# Technical skills are decisive — a match here is strong signal.
# Soft skills are common across all jobs and inflate noise if weighted equally.
_CATEGORY_WEIGHTS: Dict[str, float] = {
    "technical": 3.0,
    "domain": 2.5,
    "tool": 2.0,
    "soft": 0.3,
}
_DEFAULT_WEIGHT = 1.5  # Unknown skills get moderate weight

# ── Load taxonomy categories ─────────────────────────────────────────────────
_TAXONOMY_PATH = (
    Path(__file__).resolve().parent.parent / "nlp" / "skills_taxonomy.json"
)
_SKILL_TO_CATEGORY: Dict[str, str] = {}
_SYNONYMS: Dict[str, str] = {}

try:
    with open(_TAXONOMY_PATH, "r", encoding="utf-8") as f:
        _taxonomy = json.load(f)

    for cat_name, skill_list in _taxonomy.get("categories", {}).items():
        for skill in skill_list:
            _SKILL_TO_CATEGORY[skill.lower().strip()] = cat_name

    _SYNONYMS = {
        k.lower().strip(): v.lower().strip()
        for k, v in _taxonomy.get("synonyms", {}).items()
    }
except Exception as e:
    logger.error("Failed to load skills_taxonomy.json: %s", e)

# ── Bilingual map (elite_skills.json) ─────────────────────────────────────────
_ELITE_PATH = (
    Path(__file__).resolve().parent.parent
    / "frontend"
    / "src"
    / "data"
    / "elite_skills.json"
)
_BILINGUAL_MAP: Dict[str, str] = {}

try:
    if _ELITE_PATH.exists():
        with open(_ELITE_PATH, "r", encoding="utf-8") as f:
            registry = json.load(f)
            for item in registry:
                en = item["en"].lower().strip()
                fr = item["fr"].lower().strip()
                if en != fr:  # Only store when translation differs
                    _BILINGUAL_MAP.setdefault(en, fr)
                    _BILINGUAL_MAP.setdefault(fr, en)
except Exception as e:
    logger.error("Failed to load elite_skills.json: %s", e)


def _get_category(skill: str) -> str:
    """Return the category of a skill, falling back heuristically."""
    s = skill.lower().strip()

    # Direct lookup
    if s in _SKILL_TO_CATEGORY:
        return _SKILL_TO_CATEGORY[s]

    # Resolve synonym first, then lookup
    canonical = _SYNONYMS.get(s, s)
    if canonical in _SKILL_TO_CATEGORY:
        return _SKILL_TO_CATEGORY[canonical]

    return "unknown"


def _get_weight(skill: str) -> float:
    """Return the scoring weight for a skill based on its category."""
    cat = _get_category(skill)
    return _CATEGORY_WEIGHTS.get(cat, _DEFAULT_WEIGHT)


def _normalize_to_canonical(skill: str) -> str:
    """Resolve a skill to its canonical form via synonyms."""
    s = skill.lower().strip()
    return _SYNONYMS.get(s, s)


def _build_match_set(skills: List[str]) -> Set[str]:
    """Expand a skill list to all matchable forms (canonical + bilingual).

    Returns a set of lowercase strings that can be compared with `in`.
    """
    expanded: Set[str] = set()
    for skill in skills:
        s = skill.lower().strip()
        canonical = _normalize_to_canonical(s)

        expanded.add(s)
        expanded.add(canonical)

        # Add bilingual equivalent of canonical form
        if canonical in _BILINGUAL_MAP:
            expanded.add(_BILINGUAL_MAP[canonical])
        # Also add bilingual of raw form
        if s in _BILINGUAL_MAP:
            expanded.add(_BILINGUAL_MAP[s])

    return expanded


def _is_strict_match(
    job_skill: str, student_match_set: Set[str]
) -> bool:
    """Check if a job skill matches the student's expanded skill set.

    Uses EXACT full-phrase matching only — no token overlap.
    """
    js = job_skill.lower().strip()
    canonical = _normalize_to_canonical(js)

    # 1. Direct match
    if js in student_match_set:
        return True

    # 2. Canonical (synonym-resolved) match
    if canonical in student_match_set:
        return True

    # 3. Bilingual match
    if js in _BILINGUAL_MAP and _BILINGUAL_MAP[js] in student_match_set:
        return True
    if (
        canonical in _BILINGUAL_MAP
        and _BILINGUAL_MAP[canonical] in student_match_set
    ):
        return True

    return False


def _title_relevance_score(
    student_skills: List[str], title: str
) -> float:
    """Score title relevance using exact whole-word skill matching.

    Returns a bonus between 0.0 and 0.15 — significantly lower than
    the old 0.30 to avoid title-driven inflation for unrelated jobs.
    """
    if not title:
        return 0.0

    title_lower = title.lower()
    matches = 0

    for skill in student_skills:
        s = skill.lower().strip()
        # Whole-word boundary match only
        pattern = r"\b" + re.escape(s) + r"\b"
        if re.search(pattern, title_lower):
            matches += 1

        # Also check bilingual version
        canonical = _normalize_to_canonical(s)
        if canonical != s:
            pattern = r"\b" + re.escape(canonical) + r"\b"
            if re.search(pattern, title_lower):
                matches += 1

    if matches == 0:
        return 0.0
    if matches == 1:
        return 0.08
    return 0.15  # Cap at 0.15 for 2+ matches


def get_recommendations(
    student_skills: List[str],
    jobs: List[dict],
    top_n: int = 20,
) -> List[dict]:
    """Rank jobs using Weighted Category-Aware Strict Matching.

    Scoring model:
    1. Weighted Recall (80%): Sum of matched skill weights / total skill
       weights — technical matches count 10× more than soft skill matches.
    2. Title Relevance (10%): Whole-word skill matches in job title.
    3. Technical Depth Bonus (10%): Extra credit when >50% of a job's
       technical skills are matched.

    Guards:
    - Technical Gate: If job has ≥2 technical/domain skills and student
      matches zero → score capped at 15%.
    - Minimum threshold: Jobs scoring <8% are excluded entirely.
    """
    if not student_skills or not jobs:
        return []

    # Pre-compute student's expanded match set once
    student_match_set = _build_match_set(student_skills)

    results: List[dict] = []

    for job in jobs:
        job_skills: List[str] = job.get("skills", [])
        title: str = job.get("title", "")

        if not job_skills and not title:
            continue

        # ── Weighted Recall ──────────────────────────────────────────
        matched_skills: List[str] = []
        matched_weight = 0.0
        total_weight = 0.0
        tech_domain_total = 0
        tech_domain_matched = 0

        for js in job_skills:
            w = _get_weight(js)
            total_weight += w
            cat = _get_category(js)

            is_tech_or_domain = cat in ("technical", "domain", "tool")
            if is_tech_or_domain:
                tech_domain_total += 1

            if _is_strict_match(js, student_match_set):
                matched_skills.append(js)
                matched_weight += w
                if is_tech_or_domain:
                    tech_domain_matched += 1

        # Weighted recall score (0.0 – 1.0)
        if total_weight > 0:
            recall = matched_weight / total_weight
        else:
            recall = 0.0

        # ── Technical Gate ───────────────────────────────────────────
        # If the job has substantive technical requirements and the
        # student matches none, the job is likely irrelevant.
        gate_capped = False
        if tech_domain_total >= 2 and tech_domain_matched == 0:
            gate_capped = True

        # ── Title Relevance ──────────────────────────────────────────
        title_bonus = _title_relevance_score(student_skills, title)

        # ── Technical Depth Bonus ────────────────────────────────────
        depth_bonus = 0.0
        if tech_domain_total > 0:
            tech_ratio = tech_domain_matched / tech_domain_total
            if tech_ratio >= 0.5:
                depth_bonus = 0.10
            elif tech_ratio >= 0.3:
                depth_bonus = 0.05

        # ── Final Score ──────────────────────────────────────────────
        # Recall carries 80%, title 10%, depth 10%
        final_score = (recall * 0.80) + title_bonus + depth_bonus

        # Apply technical gate cap
        if gate_capped:
            final_score = min(final_score, 0.15)

        # Clamp to [0, 1]
        final_score = max(0.0, min(final_score, 1.0))

        results.append(
            {
                **job,
                "match_score": round(final_score * 100, 1),
                "matched_skills": sorted(set(matched_skills)),
                "missing_skills": sorted(
                    set(job_skills) - set(matched_skills)
                ),
            }
        )

    # Filter out noise and sort by relevance
    results = [r for r in results if r["match_score"] >= 8]
    results.sort(key=lambda x: x["match_score"], reverse=True)

    return results[:top_n]
