import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, JSON, DateTime, Integer
from backend.db.database import Base

class Resume(Base):
    __tablename__ = "resumes"

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
