"""Recommendation ranker — pure function, no DB calls.

Accepts pre-loaded data so it can be tested independently.
"""

from typing import List

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from recommender.vectorizer import build_skill_vector, get_all_skills


def get_recommendations(
    student_skills: List[str],
    jobs: List[dict],
    top_n: int = 10,
) -> List[dict]:
    """Rank jobs by cosine similarity to the student skill vector.

    Args:
        student_skills: List of normalized skill strings for the student.
        jobs: List of job dicts, each must have a 'skills' key (list[str]).
        top_n: Number of top results to return.

    Returns:
        List of job dicts with added keys: match_score, matched_skills,
        missing_skills.  Sorted by match_score descending.
    """
    if not student_skills or not jobs:
        return []

    jobs_with_skills = [j for j in jobs if j.get("skills")]
    if not jobs_with_skills:
        return []

    taxonomy = get_all_skills(student_skills, jobs_with_skills)

    student_vec = build_skill_vector(student_skills, taxonomy).reshape(
        1, -1
    )
    job_vecs = np.array(
        [
            build_skill_vector(job["skills"], taxonomy)
            for job in jobs_with_skills
        ]
    )

    scores = cosine_similarity(student_vec, job_vecs)[0]

    results: List[dict] = []
    for job, score in zip(jobs_with_skills, scores):
        job_skill_set = set(job["skills"])
        student_set = set(student_skills)
        results.append(
            {
                **job,
                "match_score": round(float(score) * 100, 1),
                "matched_skills": sorted(student_set & job_skill_set),
                "missing_skills": sorted(
                    job_skill_set - student_set
                ),
            }
        )

    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results[:top_n]
