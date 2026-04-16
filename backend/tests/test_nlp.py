"""Unit tests for the NLP skills extraction module."""

import pytest
from nlp.skills_extractor import extract_skills

def test_extract_skills_french():
    """Test extracting skills from a typical French job description."""
    text = (
        "Nous recherchons un Data Scientist pour rejoindre notre équipe. "
        "Vous maitrisez Python, le Machine Learning et SQL. "
        "Une expérience en NLP et Deep Learning serait un plus. "
        "La gestion de projet Agile est également demandée."
    )
    
    skills = extract_skills(text)
    
    # Assert exact matches and synonyms resolution
    assert "python" in skills
    assert "machine learning" in skills
    assert "sql" in skills
    assert "natural language processing" in skills  # Synonym for NLP
    assert "deep learning" in skills
    assert "agile" in skills

def test_extract_skills_english():
    """Test extracting skills from an English job description."""
    text = (
        "We are looking for an ML Engineer with strong background in Python "
        "and Computer Vision. You must be proficient with PyTorch and Pandas. "
        "Excellent communication and teamwork skills are required."
    )
    
    skills = extract_skills(text)
    
    assert "machine learning" in skills  # ML -> machine learning
    assert "python" in skills
    assert "computer vision" in skills
    assert "pytorch" in skills
    assert "pandas" in skills
    assert "communication" in skills
    assert "teamwork" in skills

def test_extract_skills_empty():
    """Test edge case with empty or None description."""
    assert extract_skills("") == []
    assert extract_skills("   ") == []
    assert extract_skills(None) == []  # type: ignore

def test_extract_skills_irrelevant():
    """Test description with no recognizable skills."""
    text = "Nous cherchons quelqu'un de motivé pour ce poste."
    skills = extract_skills(text)
    assert skills == []
