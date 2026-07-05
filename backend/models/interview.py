import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, JSON, DateTime, Text, ForeignKey
from backend.db.database import Base


class InterviewKit(Base):
    """
    AI-generated interview kit for a specific candidate (resume).
    One kit per candidate per generation — can be regenerated.
    """
    __tablename__ = "interview_kits"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)

    # Questions
    technical_questions = Column(JSON)      # List[{question, difficulty, expected_answer, criteria, followups}]
    coding_questions = Column(JSON)
    scenario_questions = Column(JSON)
    behavioral_questions = Column(JSON)
    hr_questions = Column(JSON)

    # Scorecard template (blank — recruiter fills in)
    scorecard_categories = Column(JSON)     # List[{category, max_score}]

    # AI hiring recommendation
    recommendation = Column(String)         # Hire | Strong Hire | Maybe | Reject
    recommendation_reasoning = Column(Text)
    pros = Column(JSON)
    cons = Column(JSON)
    risks = Column(JSON)
    suggested_salary_level = Column(String)

    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    model_used = Column(String, default="gemini-1.5-flash")


class InterviewSession(Base):
    """
    Tracks a completed/in-progress interview session tied to a candidate.
    Stores recruiter notes, scorecard values, and final decision.
    """
    __tablename__ = "interview_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    resume_id = Column(String, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    kit_id = Column(String, ForeignKey("interview_kits.id", ondelete="SET NULL"), nullable=True)

    interviewer_name = Column(String, default="Recruiter")
    interview_date = Column(DateTime)
    notes = Column(Text, default="")

    # Filled scorecard: {category: score}
    scorecard_values = Column(JSON, default=dict)
    total_score = Column(Float)

    # Final decision
    decision = Column(String)               # Hire | Reject | On Hold | Second Round

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
