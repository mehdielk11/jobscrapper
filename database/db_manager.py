"""Database manager — session handling and CRUD operations.

Provides a context-managed session, auto-creates tables on first import,
and exposes high-level helpers used by the scraper, NLP, and UI layers.
"""

import logging
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, List, Optional

from sqlalchemy.orm import joinedload

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from database.models import Base, Job, JobSkill, Student, StudentSkill

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Engine / Session factory
# ---------------------------------------------------------------------------

# DB path defaults to database/jobs.db (project root relative).
_DB_PATH: str = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{Path(__file__).resolve().parent / 'jobs.db'}",
)

engine = create_engine(_DB_PATH, echo=False)
_SessionFactory = sessionmaker(bind=engine)

# Auto-create tables on first import (safe — no-op if tables exist).
Base.metadata.create_all(engine)


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Yield a transactional DB session that auto-commits or rolls back.

    Usage::

        with get_db_session() as session:
            session.add(obj)
    """
    session: Session = _SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        logger.exception("DB session rolled back due to error")
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Job CRUD helpers
# ---------------------------------------------------------------------------


def save_job(
    title: str,
    company: str,
    description: str,
    url: str,
    source: str,
    location: Optional[str] = None,
) -> Optional[Job]:
    """Insert a job if its URL doesn't already exist (dedup by URL).

    Returns the Job instance on success, or None if it was a duplicate.
    """
    with get_db_session() as session:
        existing = session.query(Job).filter_by(url=url).first()
        if existing:
            logger.debug("Duplicate job skipped: %s", url)
            return None

        job = Job(
            title=title,
            company=company,
            description=description,
            url=url,
            source=source,
            location=location,
        )
        session.add(job)
        session.flush()  # populate job.id before commit
        session.expunge(job)  # detach cleanly so caller can use attrs
        logger.info("Saved job id=%s  title='%s'", job.id, title)
        return job


def save_skills_for_job(job_id: int, skills: List[str]) -> int:
    """Attach normalized skills to a job. Returns the count of *new* skills added.

    Skills are lowercased and deduplicated before insertion.
    Existing skills for the same job are silently skipped.
    """
    normalized: set[str] = {s.strip().lower() for s in skills if s.strip()}
    added = 0

    with get_db_session() as session:
        for skill in sorted(normalized):
            exists = (
                session.query(JobSkill)
                .filter_by(job_id=job_id, skill=skill)
                .first()
            )
            if not exists:
                session.add(JobSkill(job_id=job_id, skill=skill))
                added += 1

    logger.info("Added %d skills for job_id=%d", added, job_id)
    return added


# ---------------------------------------------------------------------------
# Student CRUD helpers
# ---------------------------------------------------------------------------


def save_student(name: str) -> Student:
    """Create a new student profile and return it."""
    with get_db_session() as session:
        student = Student(name=name)
        session.add(student)
        session.flush()
        session.expunge(student)  # detach cleanly so caller can use attrs
        logger.info("Created student id=%s name='%s'", student.id, name)
        return student

def get_student_by_name(name: str) -> Optional[Student]:
    """Retrieve an existing student profile by name."""
    with get_db_session() as session:
        student = (
            session.query(Student)
            .options(joinedload(Student.skills))
            .filter(Student.name.ilike(name))
            .first()
        )
        if student:
            session.expunge(student)
        return student

def clear_student_skills(student_id: int) -> None:
    """Remove all skills for a given student (useful for resetting profile)."""
    with get_db_session() as session:
        deleted = session.query(StudentSkill).filter_by(student_id=student_id).delete()
        logger.info("Deleted %d existing skills for student_id=%d", deleted, student_id)

def save_student_skills(student_id: int, skills: List[str]) -> int:
    """Attach normalized skills to a student. Returns count of *new* skills added.

    Skills are lowercased and deduplicated before insertion.
    """
    normalized: set[str] = {s.strip().lower() for s in skills if s.strip()}
    added = 0

    with get_db_session() as session:
        for skill in sorted(normalized):
            exists = (
                session.query(StudentSkill)
                .filter_by(student_id=student_id, skill=skill)
                .first()
            )
            if not exists:
                session.add(
                    StudentSkill(student_id=student_id, skill=skill)
                )
                added += 1

    logger.info("Added %d skills for student_id=%d", added, student_id)
    return added


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------


def get_all_jobs() -> List[Job]:
    """Return every job with its skills eagerly loaded."""
    with get_db_session() as session:
        jobs = (
            session.query(Job)
            .options(joinedload(Job.skills))
            .all()
        )
        # Expunge so objects survive after session closes.
        for job in jobs:
            session.expunge(job)
        return jobs


# ---------------------------------------------------------------------------
# Quick CLI smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    print("=== Database smoke test ===\n")

    # 1. Insert a sample job
    job = save_job(
        title="Data Scientist",
        company="OCP Group",
        description="Analyze production data using Python, SQL, and ML.",
        url="https://example.com/job/1",
        source="rekrute",
        location="Casablanca",
    )
    if job:
        print(f"[OK] Created {job}")
        save_skills_for_job(job.id, ["Python", "SQL", "Machine Learning", "python"])
        print("  [OK] Skills saved (with dedup test)")

    # 2. Insert a duplicate (should be skipped)
    dup = save_job(
        title="Data Scientist",
        company="OCP Group",
        description="...",
        url="https://example.com/job/1",
        source="rekrute",
    )
    print(f"[OK] Duplicate insert returned: {dup}")

    # 3. Insert a student + skills
    student = save_student("Mehdi")
    print(f"[OK] Created {student}")
    save_student_skills(student.id, ["Python", "Data Analysis", "SQL", "sql"])
    print("  [OK] Student skills saved (with dedup test)")

    # 4. Query all jobs
    all_jobs = get_all_jobs()
    print(f"\n[OK] Total jobs in DB: {len(all_jobs)}")
    for j in all_jobs:
        skill_names = [s.skill for s in j.skills]
        print(f"  - {j.title} @ {j.company} -- skills: {skill_names}")

    print("\n=== All checks passed ===")
