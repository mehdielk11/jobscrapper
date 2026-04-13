"""SQLAlchemy ORM models for the Job Recommender application.

Defines four tables matching the PRD data model:
- jobs: scraped job offers
- job_skills: normalized skills extracted per job
- students: student profiles
- student_skills: skills declared by each student
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Shared base class for all ORM models."""


class Job(Base):
    """A scraped job offer from a Moroccan job platform."""

    __tablename__ = "jobs"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    title: str = Column(Text, nullable=False)
    company: str = Column(Text, nullable=False)
    location: str = Column(Text, nullable=True)
    description: str = Column(Text, nullable=False)
    source: str = Column(Text, nullable=False)
    url: str = Column(Text, unique=True, nullable=False)
    scraped_at: datetime = Column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # One-to-many → job_skills
    skills = relationship(
        "JobSkill", back_populates="job", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Job(id={self.id}, title='{self.title}', company='{self.company}')>"


class JobSkill(Base):
    """A single normalized skill extracted from a job description."""

    __tablename__ = "job_skills"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    job_id: int = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    skill: str = Column(Text, nullable=False)

    # Prevent duplicate skills per job
    __table_args__ = (
        UniqueConstraint("job_id", "skill", name="uq_job_skill"),
    )

    job = relationship("Job", back_populates="skills")

    def __repr__(self) -> str:
        return f"<JobSkill(job_id={self.job_id}, skill='{self.skill}')>"


class Student(Base):
    """A student who has created a skill profile."""

    __tablename__ = "students"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    name: str = Column(Text, nullable=False)
    created_at: datetime = Column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # One-to-many → student_skills
    skills = relationship(
        "StudentSkill", back_populates="student", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Student(id={self.id}, name='{self.name}')>"


class StudentSkill(Base):
    """A single skill declared by a student."""

    __tablename__ = "student_skills"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    student_id: int = Column(
        Integer, ForeignKey("students.id"), nullable=False
    )
    skill: str = Column(Text, nullable=False)

    # Prevent duplicate skills per student
    __table_args__ = (
        UniqueConstraint("student_id", "skill", name="uq_student_skill"),
    )

    student = relationship("Student", back_populates="skills")

    def __repr__(self) -> str:
        return f"<StudentSkill(student_id={self.student_id}, skill='{self.skill}')>"
