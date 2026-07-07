import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.models.resume import Resume
from backend.models.interview import InterviewKit, InterviewSession

logger = logging.getLogger("resume_analyzer.interview")
router = APIRouter()

# ─────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────

class SessionUpsert(BaseModel):
    interviewer_name: Optional[str] = "Recruiter"
    interview_date: Optional[str] = None
    notes: Optional[str] = ""
    scorecard_values: Optional[Dict[str, float]] = {}
    decision: Optional[str] = None


# Module-level Pydantic models for Gemini structured output.
# Defined here once — not inside helper functions — to avoid repeated class creation.

class _QuestionItem(BaseModel):
    question: str
    difficulty: str
    expected_answer: str
    criteria: str
    followups: List[str]


class _AllQuestions(BaseModel):
    technical: List[_QuestionItem]
    coding: List[_QuestionItem]
    scenario: List[_QuestionItem]
    behavioral: List[_QuestionItem]
    hr: List[_QuestionItem]


class _Recommendation(BaseModel):
    recommendation: str
    reasoning: str
    pros: List[str]
    cons: List[str]
    risks: List[str]
    suggested_salary_level: str


# ─────────────────────────────────────────────────────────────────
# Gemini Helper
# ─────────────────────────────────────────────────────────────────

SCORECARD_CATEGORIES = [
    {"category": "Technical Knowledge", "max_score": 10},
    {"category": "Problem Solving", "max_score": 10},
    {"category": "Communication", "max_score": 10},
    {"category": "Experience", "max_score": 10},
    {"category": "Leadership", "max_score": 10},
    {"category": "Culture Fit", "max_score": 10},
    {"category": "Confidence", "max_score": 10},
]

FALLBACK_QUESTIONS = {
    "technical": [
        {
            "question": "Explain the difference between synchronous and asynchronous programming.",
            "difficulty": "Medium",
            "expected_answer": "Synchronous executes sequentially; async allows non-blocking I/O through coroutines or callbacks.",
            "criteria": "Clarity, real-world examples, understanding of event loops.",
            "followups": ["Can you show an async example?", "When would you choose sync over async?"]
        },
        {
            "question": "What are the key principles of RESTful API design?",
            "difficulty": "Medium",
            "expected_answer": "Statelessness, uniform interface, resource-based URLs, HTTP verb semantics, HATEOAS.",
            "criteria": "Depth of understanding, practical examples.",
            "followups": ["How do you handle API versioning?", "What's the difference between REST and GraphQL?"]
        },
        {
            "question": "Describe your experience with databases. When do you choose SQL vs NoSQL?",
            "difficulty": "Medium",
            "expected_answer": "SQL for relational/transactional data; NoSQL for unstructured/high-write scale.",
            "criteria": "Real-world tradeoffs, indexing, normalization awareness.",
            "followups": ["How have you optimized a slow query?", "Describe an ACID transaction."]
        },
    ],
    "coding": [
        {
            "question": "Write a function to find the two numbers in an array that sum to a target value.",
            "difficulty": "Easy",
            "expected_answer": "Use a hash map for O(n) time complexity.",
            "criteria": "Correct solution, time/space complexity awareness.",
            "followups": ["Can you optimize further?", "What if there are duplicate elements?"]
        },
        {
            "question": "Implement a simple LRU Cache.",
            "difficulty": "Hard",
            "expected_answer": "Use OrderedDict or doubly-linked list + hash map for O(1) operations.",
            "criteria": "Data structure choice, edge case handling.",
            "followups": ["How would you make it thread-safe?", "What's the time complexity?"]
        },
    ],
    "scenario": [
        {
            "question": "A production service is experiencing intermittent 500 errors. Walk me through your debugging process.",
            "difficulty": "Hard",
            "expected_answer": "Check logs, metrics, recent deploys, isolate the failing component, apply fix, verify.",
            "criteria": "Systematic approach, logging usage, communication skills.",
            "followups": ["How do you prevent this in future?", "What monitoring tools would you use?"]
        },
    ],
    "behavioral": [
        {
            "question": "Tell me about a time you disagreed with a technical decision. How did you handle it?",
            "difficulty": "Medium",
            "expected_answer": "STAR format: evidence-based disagreement, diplomatic communication, outcome.",
            "criteria": "Maturity, professionalism, outcome focus.",
            "followups": ["What would you do differently?", "Was the outcome positive?"]
        },
    ],
    "hr": [
        {
            "question": "Where do you see yourself in 3 years?",
            "difficulty": "Easy",
            "expected_answer": "Growth-oriented, aligned with company direction.",
            "criteria": "Ambition, realistic goals, company alignment.",
            "followups": ["What skills are you currently developing?"]
        },
    ],
}


def _call_gemini(prompt: str, schema_class=None) -> Optional[Dict]:
    """Centralized Gemini call with graceful fallback."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key in ("your_gemini_api_key_here", ""):
        return None

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        config = {"temperature": 0.3}
        if schema_class:
            config["response_mime_type"] = "application/json"
            config["response_schema"] = schema_class

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=config,
        )
        if schema_class:
            return json.loads(response.text)
        return {"text": response.text}
    except Exception as e:
        logger.warning(f"Gemini call failed: {e}")
        return None


def _build_candidate_context(r: Resume) -> str:
    """Build a rich context string from a Resume row."""
    return f"""
Candidate: {r.original_name}
Email: {r.email}
Job Applied: {r.job_applied}
ATS Score: {r.total_score}/100
Match Level: {r.match_level}
Experience: {r.exp_years} years
Skills: {', '.join(r.skills or [])}
Missing Skills: {', '.join(r.missing_skills or [])}
Strengths: {', '.join(r.strengths or [])}
Gaps: {', '.join(r.gaps or [])}
Education: {', '.join(r.education or [])}
Certifications: {', '.join(r.certifications or [])}
Projects: {', '.join(r.projects or [])}
AI Explanation: {r.explanation or 'N/A'}
""".strip()


def _generate_questions_with_gemini(resume: Resume) -> Dict[str, List]:
    """Generate all question categories via Gemini. Falls back to templates if unavailable."""
    ctx = _build_candidate_context(resume)

    prompt = f"""You are an expert technical interviewer. Based on this candidate profile, generate a comprehensive interview question set.

CANDIDATE PROFILE:
{ctx}

Generate exactly this JSON structure — no extra text:
{{
  "technical": [
    {{
      "question": "...",
      "difficulty": "Easy|Medium|Hard",
      "expected_answer": "...",
      "criteria": "...",
      "followups": ["...", "..."]
    }}
  ],
  "coding": [...],
  "scenario": [...],
  "behavioral": [...],
  "hr": [...]
}}

Rules:
- technical: 10 questions (focus on skills listed in profile)
- coding: 5 questions (appropriate to their experience level)
- scenario: 5 questions (based on their domain)
- behavioral: 5 questions (STAR format)
- hr: 5 questions
- Make questions specific to this candidate's background
- Vary difficulty across Easy/Medium/Hard
"""

    result = _call_gemini(prompt, _AllQuestions)

    if result:
        def to_list(items):
            if not items:
                return []
            return [i if isinstance(i, dict) else i.model_dump() for i in items]

        return {
            "technical": to_list(result.get("technical", [])),
            "coding": to_list(result.get("coding", [])),
            "scenario": to_list(result.get("scenario", [])),
            "behavioral": to_list(result.get("behavioral", [])),
            "hr": to_list(result.get("hr", [])),
        }

    # Fallback: return template questions as-is (no duplication)
    return {k: list(v) for k, v in FALLBACK_QUESTIONS.items()}


def _generate_recommendation_with_gemini(resume: Resume) -> Dict[str, Any]:
    """Generate hiring recommendation via Gemini. Falls back to rule-based if unavailable."""
    ctx = _build_candidate_context(resume)

    prompt = f"""You are a senior hiring manager. Based on this candidate profile, provide a structured hiring recommendation.

CANDIDATE PROFILE:
{ctx}

Return exactly this JSON — no extra text:
{{
  "recommendation": "Strong Hire|Hire|Maybe|Reject",
  "reasoning": "2-3 sentence explanation",
  "pros": ["...", "..."],
  "cons": ["...", "..."],
  "risks": ["...", "..."],
  "suggested_salary_level": "Junior|Mid-Level|Senior|Lead|Principal"
}}

Be objective and evidence-based. Base the recommendation on the ATS score, skills, experience, and gaps.
"""

    result = _call_gemini(prompt, _Recommendation)
    if result:
        return result if isinstance(result, dict) else result.model_dump()

    # Rule-based fallback
    score = resume.total_score or 0
    if score >= 80:
        rec, reasoning = "Strong Hire", f"Candidate scores {score}/100 — strong alignment with requirements."
    elif score >= 65:
        rec, reasoning = "Hire", f"Candidate scores {score}/100 — good overall fit with minor gaps."
    elif score >= 45:
        rec, reasoning = "Maybe", f"Candidate scores {score}/100 — moderate fit; further evaluation recommended."
    else:
        rec, reasoning = "Reject", f"Candidate scores {score}/100 — significant skill gaps detected."

    exp = resume.exp_years or 0
    level = "Junior" if exp < 2 else "Mid-Level" if exp < 5 else "Senior" if exp < 8 else "Lead"

    return {
        "recommendation": rec,
        "reasoning": reasoning,
        "pros": resume.strengths or ["Some relevant skills detected"],
        "cons": resume.gaps or ["Skill gaps present"],
        "risks": [f"Missing: {s}" for s in (resume.missing_skills or [])[:3]] or ["Limited information available"],
        "suggested_salary_level": level,
    }


# ─────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────

@router.post("/{resume_id}/generate")
def generate_interview_kit(resume_id: str, db: Session = Depends(get_db)):
    """
    Generate (or regenerate) a complete AI interview kit for a candidate.
    Stores the result in `interview_kits` table.
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Generate questions and recommendation
    questions = _generate_questions_with_gemini(resume)
    recommendation_data = _generate_recommendation_with_gemini(resume)

    # Upsert: delete old kit for this resume, create fresh one
    existing = db.query(InterviewKit).filter(InterviewKit.resume_id == resume_id).first()
    if existing:
        db.delete(existing)
        db.flush()

    kit = InterviewKit(
        resume_id=resume_id,
        technical_questions=questions.get("technical", []),
        coding_questions=questions.get("coding", []),
        scenario_questions=questions.get("scenario", []),
        behavioral_questions=questions.get("behavioral", []),
        hr_questions=questions.get("hr", []),
        scorecard_categories=SCORECARD_CATEGORIES,
        recommendation=recommendation_data.get("recommendation", "Maybe"),
        recommendation_reasoning=recommendation_data.get("reasoning", ""),
        pros=recommendation_data.get("pros", []),
        cons=recommendation_data.get("cons", []),
        risks=recommendation_data.get("risks", []),
        suggested_salary_level=recommendation_data.get("suggested_salary_level", "Mid-Level"),
        model_used="gemini-2.5-flash" if os.getenv("GEMINI_API_KEY") else "rule-based-fallback",
    )
    db.add(kit)
    db.commit()
    db.refresh(kit)

    return _kit_to_dict(kit, resume)


@router.get("/{resume_id}/kit")
def get_interview_kit(resume_id: str, db: Session = Depends(get_db)):
    """Retrieve an existing interview kit for a candidate."""
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Candidate not found")

    kit = db.query(InterviewKit).filter(InterviewKit.resume_id == resume_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Interview kit not generated yet. Call POST /generate first.")

    return _kit_to_dict(kit, resume)


@router.get("/{resume_id}/sessions")
def list_sessions(resume_id: str, db: Session = Depends(get_db)):
    """List all interview sessions for a candidate."""
    sessions = db.query(InterviewSession).filter(
        InterviewSession.resume_id == resume_id
    ).order_by(InterviewSession.created_at.desc()).all()
    return [_session_to_dict(s) for s in sessions]


@router.post("/{resume_id}/sessions")
def create_session(
    resume_id: str,
    payload: SessionUpsert,
    db: Session = Depends(get_db),
):
    """Create a new interview session (notes, scorecard, decision)."""
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Candidate not found")

    kit = db.query(InterviewKit).filter(InterviewKit.resume_id == resume_id).first()

    interview_date = None
    if payload.interview_date:
        try:
            interview_date = datetime.fromisoformat(payload.interview_date)
        except Exception:
            interview_date = datetime.now(timezone.utc)

    # Calculate total score from scorecard values
    total = None
    if payload.scorecard_values:
        total = round(sum(payload.scorecard_values.values()), 2)

    session = InterviewSession(
        resume_id=resume_id,
        kit_id=kit.id if kit else None,
        interviewer_name=payload.interviewer_name or "Recruiter",
        interview_date=interview_date or datetime.now(timezone.utc),
        notes=payload.notes or "",
        scorecard_values=payload.scorecard_values or {},
        total_score=total,
        decision=payload.decision,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_dict(session)


@router.patch("/{resume_id}/sessions/{session_id}")
def update_session(
    resume_id: str,
    session_id: str,
    payload: SessionUpsert,
    db: Session = Depends(get_db),
):
    """Update notes, scorecard, or decision for an existing session."""
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.resume_id == resume_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if payload.notes is not None:
        session.notes = payload.notes
    if payload.decision is not None:
        session.decision = payload.decision
    if payload.interviewer_name:
        session.interviewer_name = payload.interviewer_name
    if payload.scorecard_values is not None:
        session.scorecard_values = payload.scorecard_values
        session.total_score = round(sum(payload.scorecard_values.values()), 2)
    if payload.interview_date:
        try:
            session.interview_date = datetime.fromisoformat(payload.interview_date)
        except Exception:
            pass

    session.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)
    return _session_to_dict(session)


# ─────────────────────────────────────────────────────────────────
# Serializers
# ─────────────────────────────────────────────────────────────────

def _kit_to_dict(kit: InterviewKit, resume: Resume) -> Dict[str, Any]:
    return {
        "kit_id": kit.id,
        "resume_id": kit.resume_id,
        "candidate": {
            "name": resume.original_name,
            "email": resume.email,
            "phone": resume.phone,
            "linkedin": resume.linkedin,
            "github": resume.github,
            "job_applied": resume.job_applied,
            "ats_score": resume.total_score,
            "match_level": resume.match_level,
            "exp_years": resume.exp_years,
            "skills": resume.skills or [],
            "missing_skills": resume.missing_skills or [],
            "strengths": resume.strengths or [],
            "gaps": resume.gaps or [],
            "education": resume.education or [],
            "certifications": resume.certifications or [],
            "projects": resume.projects or [],
            "explanation": resume.explanation or "",
        },
        "questions": {
            "technical": kit.technical_questions or [],
            "coding": kit.coding_questions or [],
            "scenario": kit.scenario_questions or [],
            "behavioral": kit.behavioral_questions or [],
            "hr": kit.hr_questions or [],
        },
        "scorecard_categories": kit.scorecard_categories or SCORECARD_CATEGORIES,
        "recommendation": {
            "verdict": kit.recommendation,
            "reasoning": kit.recommendation_reasoning,
            "pros": kit.pros or [],
            "cons": kit.cons or [],
            "risks": kit.risks or [],
            "suggested_salary_level": kit.suggested_salary_level,
        },
        "generated_at": kit.generated_at.isoformat() if kit.generated_at else None,
        "model_used": kit.model_used,
    }


def _session_to_dict(s: InterviewSession) -> Dict[str, Any]:
    return {
        "session_id": s.id,
        "resume_id": s.resume_id,
        "kit_id": s.kit_id,
        "interviewer_name": s.interviewer_name,
        "interview_date": s.interview_date.isoformat() if s.interview_date else None,
        "notes": s.notes,
        "scorecard_values": s.scorecard_values or {},
        "total_score": s.total_score,
        "decision": s.decision,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }
