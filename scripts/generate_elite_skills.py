import pandas as pd
import json
import ast
import os
from collections import Counter

# Configuration
CSV_PATH = 'all_job_post.csv'
OUTPUT_PATH = 'frontend/src/data/elite_skills.json'
MAX_WORDS = 3

# Massive Bilingual Dictionary (Covering common professional domains)
BILINGUAL_MAP = {
    # Management & Strategy
    "project management": "gestion de projet",
    "management": "management",
    "strategic planning": "planification stratégique",
    "business analysis": "analyse d'affaires",
    "leadership": "leadership",
    "operations": "opérations",
    "strategy": "stratégie",
    "planning": "planification",
    "team management": "gestion d'équipe",
    "budgeting": "budgétisation",
    "budget management": "gestion budgétaire",
    "risk management": "gestion des risques",
    "supply chain": "chaîne logistique",
    "change management": "gestion du changement",
    "process improvement": "amélioration des processus",
    "performance management": "gestion de la performance",
    "stakeholder management": "gestion des parties prenantes",
    "agile": "méthodes agiles",
    "scrum": "scrum",

    # Soft Skills
    "communication": "communication",
    "teamwork": "travail d'équipe",
    "problem solving": "résolution de problèmes",
    "critical thinking": "pensée critique",
    "time management": "gestion du temps",
    "adaptability": "adaptabilité",
    "creativity": "créativité",
    "negotiation": "négociation",
    "presentation": "présentation",
    "public speaking": "prise de parole en public",
    "conflict resolution": "résolution de conflits",
    "interpersonal skills": "compétences interpersonnelles",
    "active listening": "écoute active",
    "empathy": "empathie",
    "customer service": "service client",
    "decision making": "prise de décision",
    "organizational skills": "compétences organisationnelles",
    "attention to detail": "attention aux détails",
    "work ethic": "éthique de travail",
    "collaboration": "collaboration",
    "continuous learning": "apprentissage continu",
    "flexibility": "flexibilité",

    # HR & Recruitment
    "human resources": "ressources humaines",
    "recruitment": "recrutement",
    "training": "formation",
    "onboarding": "intégration des employés",
    "talent acquisition": "acquisition de talents",
    "employee relations": "relations sociales",
    "payroll": "paie",
    "payroll management": "gestion de la paie",
    "compensation": "rémunération",
    "workforce planning": "planification des effectifs",
    "interviews": "entretiens",

    # Finance & Accounting
    "accounting": "comptabilité",
    "finance": "finance",
    "auditing": "audit",
    "financial analysis": "analyse financière",
    "financial reporting": "reporting financier",
    "accounts payable": "comptabilité fournisseurs",
    "accounts receivable": "comptabilité clients",
    "bookkeeping": "tenue de livres",
    "taxation": "fiscalité",
    "internal audit": "audit interne",
    "banking": "banque",
    "investment": "investissement",

    # Sales & Marketing
    "sales": "ventes",
    "marketing": "marketing",
    "digital marketing": "marketing digital",
    "social media": "réseaux sociaux",
    "advertising": "publicité",
    "business development": "développement commercial",
    "account management": "gestion de comptes",
    "customer relations": "relations clients",
    "market research": "étude de marché",
    "seo": "référencement (seo)",
    "content strategy": "stratégie de contenu",
    "brand management": "gestion de marque",
    "e-commerce": "e-commerce",

    # IT & Engineering (Tech names are usually kept, but concepts translated)
    "software development": "développement logiciel",
    "web development": "développement web",
    "data science": "science des données",
    "data analysis": "analyse de données",
    "database management": "gestion de base de données",
    "cybersecurity": "cybersécurité",
    "cloud computing": "cloud computing",
    "network security": "sécurité réseau",
    "technical support": "support technique",
    "quality assurance": "assurance qualité",
    "it infrastructure": "infrastructure informatique",
    "system administration": "administration système",
    "ai": "intelligence artificielle",
    "machine learning": "apprentissage automatique",
    "ui design": "design d'interface (ui)",
    "ux design": "design d'expérience (ux)",
    "frontend": "front-end",
    "backend": "back-end",
    "mobile development": "développement mobile",
    "devops": "devops",
    "programming": "programmation",
    "troubleshooting": "dépannage",
    "it management": "management informatique",

    # Administrative & Operations
    "administration": "administration",
    "data entry": "saisie de données",
    "office management": "gestion de bureau",
    "logistics": "logistique",
    "procurement": "achats",
    "purchasing": "achats",
    "project coordination": "coordination de projet",
    "clerical": "tâches administratives",
    "record keeping": "archivage",

    # Healthcare
    "healthcare": "santé",
    "nursing": "soins infirmiers",
    "patient care": "soins aux patients",
    "clinical research": "recherche clinique",

    # General / Other
    "research": "recherche",
    "writing": "rédaction",
    "editing": "édition",
    "translation": "traduction",
    "teaching": "enseignement",
    "mentoring": "mentorat",
    "customer success": "succès client",
    "hospitality": "hôtellerie",
    "manufacturing": "production industrielle",
    "engineering": "ingénierie",
    "quality control": "contrôle qualité",
}

# Heuristic Rules
def heuristic_translate(s):
    """Fallback rules for common suffixes/patterns."""
    if s.endswith("ing") and s.split()[0] + "ion" in BILINGUAL_MAP.values():
         # E.g. "Planning" -> "Planification"
         pass # Handled by the map usually

    # Handle common prefixes/suffixes
    transformations = {
        " management": " gestion",
        " developer": " développeur",
        " designer": " designer",
        " assistant": " assistant",
        " consultant": " consultant",
        " specialist": " spécialiste",
        " expert": " expert",
        " analyst": " analyste",
        " support": " support",
        " analysis": " analyse",
        " strategy": " stratégie",
        " planning": " planification",
        " services": " services",
        " skills": " compétences",
    }
    
    translated = s
    for en, fr in transformations.items():
        if en in s:
            translated = translated.replace(en, fr)
    
    return translated

def clean_skill(skill):
    s = str(skill).strip().lower()
    words = s.split()
    if len(words) > MAX_WORDS or len(words) == 0:
        return None
    return s

def generate():
    print(f"Reading {CSV_PATH}...")
    if not os.path.exists(CSV_PATH):
        print(f"Error: {CSV_PATH} not found.")
        return

    df = pd.read_csv(CSV_PATH)
    all_skills = []
    
    print("Parsing skill sets...")
    for entry in df['job_skill_set']:
        if pd.isna(entry):
            continue
        try:
            skill_list = ast.literal_eval(entry)
            for s in skill_list:
                cleaned = clean_skill(s)
                if cleaned:
                    all_skills.append(cleaned)
        except:
            continue

    counts = Counter(all_skills)
    unique_skills = sorted(counts.keys())

    print(f"Enriching {len(unique_skills)} unique skills with French translations...")

    result = []
    for s in unique_skills:
        # 1. Direct Map
        fr_version = BILINGUAL_MAP.get(s)
        
        # 2. Heuristic (if not mapped)
        if not fr_version:
            fr_version = heuristic_translate(s)
            
        # 3. Fallback (if heuristic didn't change it, and it's not a common soft skill)
        # We assume specialized tech names (Python, React) are kept as-is.
        
        result.append({
            "en": s,
            "fr": fr_version,
            "freq": counts[s]
        })

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Successfully generated {OUTPUT_PATH}")

if __name__ == "__main__":
    generate()
