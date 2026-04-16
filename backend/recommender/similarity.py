import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

def compute_similarities(student_vector: np.ndarray, job_vectors: list[np.ndarray]) -> list[float]:
    """
    Compute similarity scores between a student vector and a list of job vectors.
    
    Args:
        student_vector (np.ndarray): 1D array representing student skills.
        job_vectors (list[np.ndarray]): List of 1D arrays representing job skills.
    
    Returns:
        list[float]: A list of similarity scores bounded [0.0, 1.0].
    """
    if not job_vectors:
        return []
        
    # Ensure 2D shapes for scikit-learn
    # reshape student: (1, n_features)
    student_reshaped = student_vector.reshape(1, -1)
    
    # stack jobs: (n_jobs, n_features)
    jobs_matrix = np.vstack(job_vectors)
    
    # Cosine similarity returns shape (n_queries, n_targets) -> (1, n_jobs)
    similarities = cosine_similarity(student_reshaped, jobs_matrix)
    
    return similarities[0].tolist()
