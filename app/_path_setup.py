"""Path setup helper — ensures project root is importable.

Import this module at the top of any script that needs to import from
project-level packages (database, scraper, nlp, recommender, app).
"""

import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
