import json
from pathlib import Path
import numpy as np

from database.db_manager import get_student, get_all_jobs
from recommender.vectorizer import build_skill_vector
from recommender.similarity import compute_similarities

def load_taxonomy() -> list[str]:
    """Load the skills taxonomy."""
    taxonomy_path = Path(__file__).resolve().parent.parent / "nlp" / "skills_taxonomy.json"
    with open(taxonomy_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("skills", [])

def get_recommendations(student_id: int, top_n: int = 10) -> list[dict]:
    """
    Generate tailored job recommendations for a student based on their skills.
    
    Args:
        student_id (int): The ID of the student to generate recommendations for.
        top_n (int): The maximum number of top recommendations to return.
        
    Returns:
        list[dict]: A sorted list of recommended jobs with scores and matched/missing skills.
    """
    student = get_student(student_id)
    if not student:
        return []
        
    # 1. Load taxonomy and prepare student vector
    taxonomy = load_taxonomy()
    if not taxonomy:
        return []
        
    student_skills = [s.skill for s in student.skills]
    if not student_skills:
        return []
        
    student_vector = build_skill_vector(student_skills, taxonomy)
    
    # 2. Extract valid jobs
    jobs = get_all_jobs()
    # Filter jobs that have at least one skill to avoid recommending un-analyzable noise
    valid_jobs = []
    job_vectors = []
    
    for job in jobs:
        j_skills = [s.skill for s in job.skills]
        if j_skills:
            valid_jobs.append({
                "job_id": job.id,
                "title": job.title,
                "company": job.company,
                "location": job.location,
                "url": job.url,
                "api_job_skills": j_skills
            })
            job_vectors.append(build_skill_vector(j_skills, taxonomy))
            
    if not valid_jobs:
        return []
        
    # 3. Compute semantic cosine similarity
    similarity_scores = compute_similarities(student_vector, job_vectors)
    
    # 4. Construct final recommendation packages
    recommendations = []
    student_skill_set = {s.lower() for s in student_skills}
    
    for idx, job_meta in enumerate(valid_jobs):
        score = similarity_scores[idx]
        
        # Only recommend if there's *any* match or if it's generally useful
        # We'll just rely on the sort to filter naturally.
        
        job_skills_set = {s.lower() for s in job_meta["api_job_skills"]}
        
        # Match computation
        matched_skills = list(student_skill_set.intersection(job_skills_set))
        missing_skills = list(job_skills_set.difference(student_skill_set))
        
        rec = {
            "job_id": job_meta["job_id"],
            "title": job_meta["title"],
            "company": job_meta["company"],
            "location": job_meta["location"],
            "url": job_meta["url"],
            "match_score": round(score * 100, 1),
            "matched_skills": [s.title() for s in matched_skills],
            "missing_skills": [s.title() for s in missing_skills]
        }
        recommendations.append(rec)
        
    # 5. Sort by score descending and return top_n
    recommendations.sort(key=lambda x: x["match_score"], reverse=True)
    return recommendations[:top_n]
