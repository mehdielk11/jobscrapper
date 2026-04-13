"""Recommendation ranker — Elite Recruiter Hybrid Model (Option C).

Switches from global vector similarity to requirement-centric matching
to eliminate 'sparsity penalties' for broad profiles.
"""

import json
import logging
import re
from pathlib import Path
from typing import List, Set, Dict

logger = logging.getLogger(__name__)

# Load Elite Registry for Bilingual Normalization
_ELITE_PATH = Path(__file__).resolve().parent.parent / "frontend" / "src" / "data" / "elite_skills.json"
_BILINGUAL_MAP: Dict[str, str] = {
    # Core Overrides / Synonyms to ensure high accuracy for common terms
    "management": "gestion",
    "gestion": "management",
    "accounting": "comptabilité",
    "comptabilité": "accounting",
    "sales": "ventes",
    "ventes": "sales",
    "marketing": "marketing",
}

# Add Elite Registry mappings
try:
    if _ELITE_PATH.exists():
        with open(_ELITE_PATH, "r", encoding="utf-8") as f:
            registry = json.load(f)
            for item in registry:
                en, fr = item["en"].lower(), item["fr"].lower()
                # Don't overwrite our core overrides
                if en not in _BILINGUAL_MAP:
                    _BILINGUAL_MAP[en] = fr
                if fr not in _BILINGUAL_MAP:
                    _BILINGUAL_MAP[fr] = en
except Exception as e:
    logger.error("Failed to load elite_skills.json for ranking: %s", e)


def _normalize_skill(skill: str) -> Set[str]:
    """Expand a skill to its bilingual equivalents for matching."""
    s = skill.lower().strip()
    equivalents = {s}
    if s in _BILINGUAL_MAP:
        equivalents.add(_BILINGUAL_MAP[s])
    return equivalents


def _fuzzy_title_match(skill: str, title: str) -> bool:
    """Check if a skill (or its keywords) fuzzy matches the job title."""
    title_lower = title.lower()
    skill_lower = skill.lower()
    
    # 1. Exact or Substring match
    if skill_lower in title_lower:
        return True
    
    # 2. Keyword-based fuzzy match (stemming-lite)
    # If the skill is "Administration", check if "Administra" appears in title
    keywords = [k for k in skill_lower.split() if len(k) > 3]
    for kw in keywords:
        # Check for 80% prefix overlap
        pattern = re.compile(r"\b" + re.escape(kw[:int(len(kw)*0.8)]) + r"\w*\b")
        if pattern.search(title_lower):
            return True
            
    return False


def get_recommendations(
    student_skills: List[str],
    jobs: List[dict],
    top_n: int = 20,
) -> List[dict]:
    """Rank jobs using the Elite Recruiter Hybrid Model.
    
    Tiers:
    1. Requirement Recall (70%): How many of the JOB'S needs do you meet?
    2. Title Alignment (20%): Does the title context match your skillset?
    3. Density Bonus (10%): Depth of the match.
    """
    if not student_skills or not jobs:
        return []

    # Normalize student skills once
    student_expanded: Set[str] = set()
    for s in student_skills:
        student_expanded.update(_normalize_skill(s))

    results: List[dict] = []
    for job in jobs:
        job_skills = job.get("skills", [])
        title = job.get("title", "")
        
        if not job_skills and not title:
            continue

        # 1. Requirement Recall
        matched_skills = []
        for js in job_skills:
            js_norm = js.lower().strip()
            
            # Direct match
            if js_norm in student_expanded:
                matched_skills.append(js)
                continue
                
            # Bilingual match
            if js_norm in _BILINGUAL_MAP and _BILINGUAL_MAP[js_norm] in student_expanded:
                matched_skills.append(js)
                continue
                
            # Token overlap match (Elite heuristic)
            # If job wants "Asset Management" and user has "Management"
            js_tokens = set(js_norm.split())
            if any(token in student_expanded or _BILINGUAL_MAP.get(token) in student_expanded 
                   for token in js_tokens if len(token) > 3):
                matched_skills.append(js)

        recall_score = (len(matched_skills) / len(job_skills)) if job_skills else 0.5
        
        # 2. Title Match (Fuzzy)
        title_bonus = 0.0
        for s in student_skills:
            if _fuzzy_title_match(s, title):
                title_bonus = 0.3 # Max bonus for title alignment
                break
        
        # 3. Density / Confidence Bonus
        density_bonus = min(len(matched_skills) * 0.05, 0.1)

        # 4. Final Aggregation
        # Base (70%) + Title (20%) + Density (10%)
        # Scale recall to 70 max
        final_score = (recall_score * 0.7) + title_bonus + density_bonus
        
        # Cap at 1.0 (100%)
        final_score = min(final_score, 1.0)

        results.append({
            **job,
            "match_score": round(final_score * 100, 1),
            "matched_skills": sorted(list(set(matched_skills))),
            "missing_skills": sorted(list(set(job_skills) - set(matched_skills)))
        })

    # Sort by score and filter out zero matches
    results = [r for r in results if r["match_score"] > 5]
    results.sort(key=lambda x: x["match_score"], reverse=True)
    
    return results[:top_n]
