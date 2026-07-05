import logging
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session

from backend.api.v1.dependencies import get_current_user, require_roles
from backend.core.security import rate_limit_dependency, secure_file_validation
from backend.db.database import get_db
from backend.models.resume import Resume
from backend.models.user import User
from backend.repositories.audit_repository import AuditRepository
from backend.repositories.resume_repository import ResumeRepository
from backend.schemas.resume import AnalyzeResponse
from backend.services.resume_service import ResumeService

logger = logging.getLogger("resume_analyzer.endpoints")
router = APIRouter()


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def _result_to_resume(result: dict) -> Resume:
    """Convert a ResumeService result dict to a Resume ORM instance."""
    return Resume(
        filename=result["filename"],
        original_name=result["original_name"],
        email=result.get("email", ""),
        phone=result.get("phone", ""),
        linkedin=result.get("linkedin", ""),
        github=result.get("github", ""),
        skills=result.get("skills", []),
        missing_skills=result.get("missing_skills", []),
        skill_score=result.get("score", 0),
        exp_years=result.get("exp_years", 0),
        exp_score=0.0,
        total_score=result.get("score", 0),
        match_level=result.get("match_level", "Weak Match"),
        explanation=result.get("explanation", ""),
        strengths=result.get("strengths", []),
        gaps=result.get("gaps", []),
        education=result.get("education", []),
        projects=result.get("projects", []),
        certifications=result.get("certifications", []),
        retrieved_chunks=result.get("retrieved_chunks", []),
        confidence=result.get("confidence", 0.0),
        size=result.get("size", 0),
        job_applied=result.get("job_applied", ""),
    )


def _resume_to_response(r: Resume) -> AnalyzeResponse:
    """Serialize a Resume ORM instance to the API response schema."""
    return AnalyzeResponse(
        id=r.id,
        filename=r.original_name,
        email=r.email,
        phone=r.phone,
        linkedin=r.linkedin,
        github=r.github,
        skills=r.skills or [],
        skill_score=r.skill_score or 0.0,
        exp_years=r.exp_years or 0.0,
        exp_score=r.exp_score or 0.0,
        total_score=r.total_score or 0.0,
        job_applied=r.job_applied,
        match_level=r.match_level or "Weak Match",
        explanation=r.explanation or "",
        missing_skills=r.missing_skills or [],
        strengths=r.strengths or [],
        gaps=r.gaps or [],
        education=r.education or [],
        projects=r.projects or [],
        certifications=r.certifications or [],
        retrieved_chunks=r.retrieved_chunks or [],
        confidence=r.confidence or 0.0,
        size=r.size or 0,
        status=r.status or "Applied",
        location=r.location or "",
        uploaded_at=r.uploaded_at,
    )


# ─────────────────────────────────────────────────────────────────
# Resume Analysis
# ─────────────────────────────────────────────────────────────────

@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    dependencies=[Depends(rate_limit_dependency)],
)
async def analyze_one(
    request: Request,
    job_role: str = Query(..., description="Job role to match against"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Analyze a single resume against a job role and persist the result."""
    content = await secure_file_validation(file)
    result = ResumeService.process_single_resume(content, file.filename, job_role)

    resume = _result_to_resume(result)
    resume_repo = ResumeRepository(db)
    try:
        resume_repo.create(resume)
    except Exception as exc:
        logger.error("DB save failed: %s", exc)
        raise HTTPException(status_code=500, detail="Database save failed")

    uid = current_user.id if current_user else "anonymous"
    uemail = current_user.email if current_user else "anonymous"
    ip = request.client.host if request.client else "unknown"
    AuditRepository(db).log_action(
        "RESUME_ANALYZE", uid, uemail, ip,
        {"resume_id": resume.id, "filename": resume.original_name},
    )

    return _resume_to_response(resume)


# ─────────────────────────────────────────────────────────────────
# Candidate List & Detail
# ─────────────────────────────────────────────────────────────────

@router.get(
    "/resumes",
    dependencies=[Depends(require_roles(["Admin", "Recruiter", "HR", "Viewer"]))],
)
def list_resumes(
    q: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    job_role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    min_experience: Optional[float] = Query(None),
    skills: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List resumes with optional filters. `skills` is a comma-separated list (any-match)."""
    resume_repo = ResumeRepository(db)
    rows = resume_repo.list_resumes(
        q=q,
        min_score=min_score,
        job_role=job_role,
        status=status,
        location=location,
        min_experience=min_experience,
        limit=limit,
        offset=offset,
    )

    # Skills filter: comma-separated list, any-match against the JSON skills column.
    # Applied in-process because JSON array containment queries differ across DB backends.
    if skills:
        skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
        rows = [
            r for r in rows
            if any(s in [sk.lower() for sk in (r.skills or [])] for s in skill_list)
        ]

    return [
        {
            "id": r.id,
            "name": r.original_name,
            "email": r.email,
            "skills": r.skills or [],
            "score": r.total_score or 0.0,
            "match_level": r.match_level or "Weak Match",
            "status": r.status or "Applied",
            "location": r.location or "",
            "exp_years": r.exp_years or 0.0,
            "uploaded_at": r.uploaded_at,
        }
        for r in rows
    ]


@router.get(
    "/resumes/{resume_id}",
    response_model=AnalyzeResponse,
    dependencies=[Depends(require_roles(["Admin", "Recruiter", "HR", "Viewer"]))],
)
def get_resume(resume_id: str, db: Session = Depends(get_db)):
    """Retrieve full details for a single candidate."""
    r = ResumeRepository(db).get_by_id(resume_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return _resume_to_response(r)


# ─────────────────────────────────────────────────────────────────
# Candidate Status
# ─────────────────────────────────────────────────────────────────

@router.patch(
    "/resumes/{resume_id}/status",
    dependencies=[Depends(require_roles(["Admin", "Recruiter", "HR"]))],
)
def update_candidate_status(
    resume_id: str,
    request: Request,
    status: str = Query(
        ...,
        description="Applied|Screening|Interview Scheduled|Interviewed|Shortlisted|Offer Sent|Hired|Rejected",
    ),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Update the pipeline status for a candidate."""
    r = ResumeRepository(db).update_status(resume_id, status)
    if not r:
        raise HTTPException(status_code=404, detail="Candidate not found")

    uid = current_user.id if current_user else "anonymous"
    uemail = current_user.email if current_user else "anonymous"
    ip = request.client.host if request.client else "unknown"
    AuditRepository(db).log_action(
        "STATUS_UPDATE", uid, uemail, ip, {"resume_id": resume_id, "status": status}
    )

    return {"status": r.status, "message": "Candidate status updated successfully."}


# ─────────────────────────────────────────────────────────────────
# Candidate Notes
# ─────────────────────────────────────────────────────────────────

@router.get(
    "/resumes/{resume_id}/notes",
    dependencies=[Depends(require_roles(["Admin", "Recruiter", "HR", "Viewer"]))],
)
def get_candidate_notes(resume_id: str, db: Session = Depends(get_db)):
    """List notes for a candidate."""
    notes = ResumeRepository(db).get_notes(resume_id)
    return [
        {"id": n.id, "author": n.author, "text": n.text, "created_at": n.created_at.isoformat()}
        for n in notes
    ]


@router.post(
    "/resumes/{resume_id}/notes",
    dependencies=[Depends(require_roles(["Admin", "Recruiter", "HR"]))],
)
def add_candidate_note(
    resume_id: str,
    request: Request,
    text: str = Body(..., embed=True),
    author: str = Query("Recruiter"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Add a note to a candidate record."""
    note = ResumeRepository(db).add_note(resume_id, text, author)
    if not note:
        raise HTTPException(status_code=404, detail="Candidate not found")

    uid = current_user.id if current_user else "anonymous"
    uemail = current_user.email if current_user else "anonymous"
    ip = request.client.host if request.client else "unknown"
    AuditRepository(db).log_action("NOTE_ADD", uid, uemail, ip, {"resume_id": resume_id})

    return {"id": note.id, "author": note.author, "text": note.text, "created_at": note.created_at.isoformat()}


# ─────────────────────────────────────────────────────────────────
# Candidate Timeline
# ─────────────────────────────────────────────────────────────────

@router.get(
    "/resumes/{resume_id}/timeline",
    dependencies=[Depends(require_roles(["Admin", "Recruiter", "HR", "Viewer"]))],
)
def get_candidate_timeline(resume_id: str, db: Session = Depends(get_db)):
    """Return chronological activity and interview history for a candidate."""
    from backend.models.activity import CandidateActivity
    from backend.models.interview import InterviewSession

    activities = db.query(CandidateActivity).filter(CandidateActivity.resume_id == resume_id).all()
    sessions = db.query(InterviewSession).filter(InterviewSession.resume_id == resume_id).all()

    timeline = []
    for a in activities:
        timeline.append({
            "type": "activity",
            "activity_type": a.activity_type,
            "message": a.message,
            "date": a.created_at.isoformat(),
        })
    for s in sessions:
        timeline.append({
            "type": "interview",
            "message": (
                f"Interview session conducted by {s.interviewer_name}. "
                f"Decision: {s.decision or 'N/A'}. Score: {s.total_score or 'N/A'}"
            ),
            "date": s.interview_date.isoformat() if s.interview_date else s.created_at.isoformat(),
        })

    timeline.sort(key=lambda x: x["date"], reverse=True)
    return timeline
