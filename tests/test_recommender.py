"""Unit tests for the recommender engine."""

import numpy as np
import pytest

from recommender.vectorizer import build_skill_vector
from recommender.similarity import compute_similarities

def test_build_skill_vector():
    """Test generating binary vectors from skill lists."""
    taxonomy = ["python", "sql", "machine learning", "java"]
    skills = ["Python", "Machine Learning", "missing_skill"]
    
    vector = build_skill_vector(skills, taxonomy)
    
    assert vector.shape == (4,)
    # Python is present (index 0)
    assert vector[0] == 1
    # SQL is missing (index 1)
    assert vector[1] == 0
    # ML is present (index 2)
    assert vector[2] == 1
    # Java is missing (index 3)
    assert vector[3] == 0

def test_compute_similarities_exact_match():
    """Test similarities computation with exact match."""
    student = np.array([1, 1, 0, 0])
    jobs = [
        np.array([1, 1, 0, 0]),  # Exact match (1.0)
        np.array([1, 0, 0, 0]),  # Partial (subset)
        np.array([0, 0, 1, 1])   # Disjoint (0.0)
    ]
    
    sims = compute_similarities(student, jobs)
    
    assert len(sims) == 3
    assert np.isclose(sims[0], 1.0)
    assert sims[1] > 0.0 and sims[1] < 1.0
    assert np.isclose(sims[2], 0.0)

def test_compute_similarities_empty_jobs():
    """Test similarity handles empty job list."""
    student = np.array([1, 0])
    sims = compute_similarities(student, [])
    assert sims == []

def test_compute_similarities_zero_vectors():
    """Test edge cases with zero content vectors (no division by zero)."""
    student = np.array([0, 0, 0])
    jobs = [np.array([1, 0, 0]), np.array([0, 0, 0])]
    
    sims = compute_similarities(student, jobs)
    
    assert len(sims) == 2
    # Scikit-learn outputs 0.0 for zero-vectors
    assert np.isclose(sims[0], 0.0)
    assert np.isclose(sims[1], 0.0)
