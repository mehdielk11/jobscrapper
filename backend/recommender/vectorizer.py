"""Skill vectorization utilities."""

from typing import List

import numpy as np


def get_all_skills(
    student_skills: List[str], jobs: List[dict]
) -> List[str]:
    """Build the full unified skill vocabulary from student + all jobs."""
    all_skills: set = set(student_skills)
    for job in jobs:
        all_skills.update(job.get("skills", []))
    return sorted(all_skills)


def build_skill_vector(
    skills: List[str], taxonomy: List[str]
) -> np.ndarray:
    """Return a binary numpy vector: 1 if skill is in taxonomy, 0 otherwise."""
    skill_set = {s.lower().strip() for s in skills}
    return np.array(
        [1.0 if s in skill_set else 0.0 for s in taxonomy]
    )
