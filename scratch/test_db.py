import sys
from pathlib import Path
_ROOT = str(Path(__file__).resolve().parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from database.db_manager import save_scraper_log, update_nlp_status

print("Testing save_scraper_log...")
try:
    save_scraper_log(None, "INFO", "Diagnostic test from verification script", source="nlp_engine")
    print("Log saved successfully.")
except Exception as e:
    print(f"Error saving log: {e}")

print("Testing update_nlp_status...")
try:
    update_nlp_status("processing", total=100, processed=5)
    print("Status updated successfully.")
except Exception as e:
    print(f"Error updating status: {e}")
