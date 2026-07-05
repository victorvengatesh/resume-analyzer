import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, JSON, DateTime, Integer, Text
from backend.db.database import Base


class BatchJob(Base):
    __tablename__ = "batch_jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(String, default="pending")          # pending | processing | done | error
    job_description = Column(Text)
    total_files = Column(Integer, default=0)
    completed = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    results = Column(JSON)                               # ranked list of resume dicts
    errors = Column(JSON)                                # per-file error list
    average_score = Column(Float)
    highest_score = Column(Float)
    lowest_score = Column(Float)
    top_candidate = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime)
