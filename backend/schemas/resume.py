from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class AnalyzeResponse(BaseModel):
    id: str
    filename: str
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    skills: List[str]
    skill_score: float
    exp_years: float
    exp_score: float
    total_score: float
    job_applied: str
    match_level: str
    explanation: str
    missing_skills: List[str]
    strengths: List[str]
    gaps: List[str]
    education: List[str]
    projects: List[str]
    certifications: List[str]
    retrieved_chunks: List[str]
    confidence: float
    size: int
    # status defaults to "Applied" — not passed by /analyze but required by /resumes/{id}
    status: str = "Applied"
    location: Optional[str] = None
    uploaded_at: datetime

class CandidateOut(BaseModel):
    name: str
    email: str
    skills: List[str]
    missing_skills: List[str]
    score: float
    match_level: str
    explanation: str
    strengths: List[str]
    gaps: List[str]
    education: List[str]
    projects: List[str]
    certifications: List[str]
    retrieved_chunks: List[str]
    confidence: float
    size: int
    status: str = "Applied"
    location: Optional[str] = None
    exp_years: float
