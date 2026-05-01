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

# ── No more static taxonomy ──────────────────────────────────────────────────
# Skills categories (hard/soft) and canonical forms are now dynamically 
# extracted by the Gemini AI pipeline and fetched via skill_objects.

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


def _normalize_to_canonical(skill: str) -> str:
    """Pass-through, as canonicalization is handled by the DB clustering engine."""
    return skill.lower().strip()


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


from rapidfuzz.distance import JaroWinkler

def _clean_skill_string(skill: str) -> str:
    """Mirror of clustering engine's cleaning function."""
    s = re.sub(r"[^\w\s]", "", skill.lower())
    s = re.sub(r"\s+", " ", s).strip()
    return s

def _is_strict_match(
    job_skill: str, student_match_set: Set[str]
) -> bool:
    """Check if a job skill matches the student's expanded skill set.

    Uses EXACT full-phrase matching + Bilingual map + Jaro-Winkler clustering
    logic to guarantee alignment with the DB clustering engine.
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

    # 4. Clustering Engine Mirror (Jaro-Winkler)
    cleaned_js = _clean_skill_string(js)
    if len(cleaned_js) >= 4:
        for student_skill in student_match_set:
            cleaned_student = _clean_skill_string(student_skill)
            if len(cleaned_student) >= 4:
                score = JaroWinkler.similarity(cleaned_js, cleaned_student)
                if score >= 0.90:
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
    student_hard_skills: List[str],
    student_soft_skills: List[str],
    jobs: List[dict],
    top_n: int = 20,
) -> List[dict]:
    """Rank jobs using Weighted Category-Aware Strict Matching.

    Scoring model:
    1. Weighted Recall (80%): Sum of matched skill weights / total skill
       weights — technical matches (3.0) count slightly more than soft skill matches (2.0).
    2. Title Relevance (10%): Whole-word skill matches in job title.
    3. Technical Depth Bonus (10%): Extra credit when >50% of a job's
       technical skills are matched.

    Guards:
    - Technical Gate: If job has ≥2 technical/domain skills and student
      matches zero → score capped at 15%.
    - Minimum threshold: Jobs scoring <8% are excluded entirely.
    """
    if (not student_hard_skills and not student_soft_skills) or not jobs:
        return []

    # Pre-compute student's expanded match sets once
    hard_match_set = _build_match_set(student_hard_skills)
    soft_match_set = _build_match_set(student_soft_skills)
    # Combine for title bonus
    student_all_skills = student_hard_skills + student_soft_skills

    results: List[dict] = []

    for job in jobs:
        job_skill_objects = job.get("skill_objects", [])
        if not job_skill_objects:
            # Fallback to string list if skill_objects not present
            job_skill_objects = [{"skill": s, "category": "hard"} for s in job.get("skills", [])]
        
        title: str = job.get("title", "")
        title_lower = title.lower()

        if not job_skill_objects and not title:
            continue

        # ── Deduplicate & Identify Core Skills ───────────────────────
        unique_skills = {}
        core_skills = set()
        
        for js_obj in job_skill_objects:
            raw_skill = js_obj.get("skill", "")
            js = (js_obj.get("canonical_skill") or raw_skill).lower().strip()
            if not js:
                continue
            cat = (js_obj.get("category") or "hard").lower().strip()
            
            # Keep hard category if there's a conflict
            if js not in unique_skills or unique_skills[js]["cat"] == "soft":
                unique_skills[js] = {
                    "cat": cat,
                    "w": 3.0 if cat != "soft" else 2.0,
                    "is_tech": cat != "soft",
                    "raw": raw_skill
                }
            
            # Core Skill Penalty Detection: If a technical skill from the job explicitly appears in the job title
            if cat != "soft":
                # Check if canonical or raw skill word is in the title
                if re.search(r"\b" + re.escape(js) + r"\b", title_lower) or \
                   (raw_skill and re.search(r"\b" + re.escape(raw_skill.lower()) + r"\b", title_lower)):
                    core_skills.add(js)

        # ── Weighted Recall ──────────────────────────────────────────
        matched_skills: List[str] = []
        matched_weight = 0.0
        total_weight = 0.0
        tech_domain_total = 0
        tech_domain_matched = 0
        user_matched_core = False

        for js, info in unique_skills.items():
            total_weight += info["w"]
            if info["is_tech"]:
                tech_domain_total += 1

            target_match_set = hard_match_set if info["is_tech"] else soft_match_set

            if _is_strict_match(js, target_match_set):
                matched_skills.append(js)
                matched_weight += info["w"]
                if info["is_tech"]:
                    tech_domain_matched += 1
                if js in core_skills:
                    user_matched_core = True

        # Bound denominator so highly verbose jobs don't endlessly dilute recall.
        # Max expected required weight = 15.0 (equivalent to matching 5 hard skills perfectly)
        effective_total_weight = min(total_weight, 15.0)

        if effective_total_weight > 0:
            recall = min(matched_weight / effective_total_weight, 1.0)
        else:
            recall = 0.0

        # ── Technical Gate ───────────────────────────────────────────
        # If the user is specialized (has hard skills), they shouldn't get generic jobs with 0 hard skills.
        # If the job requires hard skills, the user MUST match at least one.
        gate_capped = False
        if tech_domain_total > 0 and tech_domain_matched == 0:
            gate_capped = True
        elif tech_domain_total == 0 and len(hard_match_set) > 0:
            gate_capped = True

        # ── Title Relevance ──────────────────────────────────────────
        title_bonus = _title_relevance_score(student_all_skills, title)

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
            
        # Apply Core Skill Penalty
        # If the job advertises a specific tech skill in the title, and user lacks it, penalize severely.
        if core_skills and not user_matched_core:
            final_score *= 0.25

        # Clamp to [0, 1]
        final_score = max(0.0, min(final_score, 1.0))

        results.append(
            {
                **job,
                "match_score": round(final_score * 100, 1),
                "matched_skills": sorted(set(matched_skills)),
                "missing_skills": sorted(set(unique_skills.keys()) - set(matched_skills)),
            }
        )

    # Filter out noise and sort by relevance
    results = [r for r in results if r["match_score"] >= 8]
    results.sort(key=lambda x: x["match_score"], reverse=True)

    return results[:top_n]
