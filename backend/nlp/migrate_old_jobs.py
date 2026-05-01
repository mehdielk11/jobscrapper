import os
import logging
from dotenv import load_dotenv
from supabase import create_client

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def migrate_old_jobs():
    """Finds jobs that lack categorized skills and marks them for re-extraction."""
    logger.info("Initializing database connection...")
    
    # Load environment variables
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(env_path)
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")
        return
        
    client = create_client(url, key)
    
    try:
        # Step 1: Identify jobs that were processed by the old engine
        # We find jobs that are marked 'completed' but let's just find jobs that have skills
        # without a 'category' or 'canonical_skill' mapping, or just reset everything extracted before today.
        
        # The easiest approach: Find jobs with nlp_status='completed' that don't have
        # proper hard/soft categorizations. Since the old system didn't write 'category',
        # any 'completed' job that lacks a 'soft' or 'hard' category in its job_skills needs re-processing.
        
        logger.info("Fetching jobs currently marked as 'extracted' or 'no_skills_found'...")
        jobs_res = client.table("jobs").select("id").in_("nlp_status", ["extracted", "no_skills_found"]).execute()
        completed_jobs = jobs_res.data or []
        
        if not completed_jobs:
            logger.info("No completed jobs found to migrate.")
            return
            
        logger.info(f"Found {len(completed_jobs)} completed jobs. Resetting their status to 'pending'...")
        
        # We will reset their status to 'pending'.
        # The new skills_extractor will automatically clear their old job_skills 
        # when it processes them via `save_skills_for_job()`.
        
        batch_size = 500
        job_ids = [job["id"] for job in completed_jobs]
        
        for i in range(0, len(job_ids), batch_size):
            chunk = job_ids[i:i + batch_size]
            client.table("jobs").update({"nlp_status": "pending"}).in_("id", chunk).execute()
            logger.info(f"Reset {min(i + batch_size, len(job_ids))}/{len(job_ids)} jobs...")
            
        logger.info("✅ Migration complete! The Gemini extraction engine will now pick these up automatically.")
        logger.info("It will process them at 15 jobs/minute to respect API limits.")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate_old_jobs()
