import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, JSON, DateTime, Integer
from backend.db.database import Base


class Resume(Base):
    __tablename__ = "resumes"

    # BUG FIX: id is pre-populated in __init__ so that resume.id is a real
    # UUID string immediately after Resume(...) is constructed in Python —
    # before db.add() / db.flush() / db.commit().
    #
    # SQLAlchemy's column-level default= only runs when the INSERT statement
    # is built (i.e. at flush/commit time).  Any code that reads resume.id
    # between construction and flush — such as:
    #
    #   db.add(resume)
    #   r["resume_id"] = resume.id   ← was None without this fix
    #   db.flush()
    #
    # would previously receive None, causing every batch result to have
    # resume_id: null in the API response, breaking "View Profile" navigation
    # and making result-to-file matching impossible.
    #
    # The column default= is kept as a safety net; __init__ takes precedence.
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    email = Column(String)
    phone = Column(String)
    location = Column(String)
    linkedin = Column(String)
    github = Column(String)
    skills = Column(JSON)
    skill_score = Column(Float)
    exp_years = Column(Float)
    exp_score = Column(Float)
    total_score = Column(Float, index=True)
    job_applied = Column(String)
    match_level = Column(String)
    missing_skills = Column(JSON)
    explanation = Column(String)
    strengths = Column(JSON)
    gaps = Column(JSON)
    education = Column(JSON)
    projects = Column(JSON)
    certifications = Column(JSON)
    retrieved_chunks = Column(JSON)
    confidence = Column(Float)
    size = Column(Integer)
    status = Column(String, default="Applied")
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __init__(self, **kwargs):
        # Pre-assign id before SQLAlchemy touches this object, so any code
        # that reads self.id before the flush has a real UUID, not None.
        if "id" not in kwargs:
            kwargs["id"] = str(uuid.uuid4())
        # Pre-assign uploaded_at for the same reason (batch code may read it
        # before the INSERT if it ever serialises the object early).
        if "uploaded_at" not in kwargs:
            kwargs["uploaded_at"] = datetime.now(timezone.utc)
        super().__init__(**kwargs)
