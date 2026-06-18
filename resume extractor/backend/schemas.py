from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CandidateOut(BaseModel):
    name: str
    email: str
    score: float
    match_level: str
    explanation: str
    skills: List[str]
    missing_skills: List[str]
    strengths: List[str]
    gaps: List[str]
    retrieved_chunks: List[str]
    confidence: float
    size: int
    exp: str

class AnalyzeResponse(BaseModel):
    id: str
    filename: str
    email: Optional[str]
    score: float
    match_level: str
    explanation: str
    skills: List[str]
    missing_skills: List[str]
    strengths: List[str]
    gaps: List[str]
    retrieved_chunks: List[str]
    confidence: float
    size: int
    uploaded_at: datetime
