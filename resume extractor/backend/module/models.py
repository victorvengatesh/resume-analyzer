from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    name = Column(String(255))
    email = Column(String(255))
    phone = Column(String(20))
    summary = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Resume {self.name}>"

class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)

    def __repr__(self):
        return f"<Job {self.title}>"

class MatchResult(Base):
    __tablename__ = "match_results"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String, ForeignKey('resumes.id'), nullable=False)
    job_id = Column(String, ForeignKey('jobs.id'), nullable=False)
    overall_score = Column(Float)

    resume = relationship("Resume")
    job = relationship("Job")

    def __repr__(self):
        return f"<Match Resume:{self.resume_id} Job:{self.job_id} Score:{self.overall_score}>"
