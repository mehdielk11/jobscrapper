import numpy as np

def build_skill_vector(skills: list[str], taxonomy: list[str]) -> np.ndarray:
    """
    Build a binary vector representing the presence of skills in a predefined taxonomy.
    
    Args:
        skills (list[str]): The user's or job's available skills.
        taxonomy (list[str]): The canonical list of all possible skills.
        
    Returns:
        np.ndarray: A binary vector of shape (len(taxonomy),) where 1 indicates presence.
    """
    skills_set = {skill.strip().lower() for skill in skills}
    
    vector = np.zeros(len(taxonomy), dtype=np.int8)
    
    for i, tax_skill in enumerate(taxonomy):
        if tax_skill.lower() in skills_set:
            vector[i] = 1
            
    return vector
