from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func, cast, String as SqlString

from backend.repositories.base import BaseRepository
from backend.models.resume import Resume
from backend.models.activity import CandidateActivity, CandidateNote


class ResumeRepository(BaseRepository[Resume]):
    def __init__(self, db: Session):
        super().__init__(Resume, db)

    # ── Read ─────────────────────────────────────────────────────

    def get_by_id(self, resume_id: str) -> Optional[Resume]:
        return self.get(resume_id)

    def count_resumes(
        self,
        q: Optional[str] = None,
        min_score: Optional[float] = None,
        job_role: Optional[str] = None,
        status: Optional[str] = None,
        location: Optional[str] = None,
        min_experience: Optional[float] = None,
    ) -> int:
        """Return filtered count (mirrors list_resumes filters)."""
        stmt = select(func.count(Resume.id))
        if q:
            ql = f"%{q.lower()}%"
            stmt = stmt.where(
                (Resume.original_name.ilike(ql))
                | (Resume.email.ilike(ql))
                | (Resume.job_applied.ilike(ql))
                | (cast(Resume.skills, SqlString).ilike(ql))
            )
        if min_score is not None:
            stmt = stmt.where(Resume.total_score >= min_score)
        if job_role:
            stmt = stmt.where(Resume.job_applied.ilike(f"%{job_role}%"))
        if status:
            stmt = stmt.where(Resume.status == status)
        if location:
            stmt = stmt.where(Resume.location.ilike(f"%{location}%"))
        if min_experience is not None:
            stmt = stmt.where(Resume.exp_years >= min_experience)
        return self.db.execute(stmt).scalar() or 0

    def list_resumes(
        self,
        q: Optional[str] = None,
        min_score: Optional[float] = None,
        job_role: Optional[str] = None,
        status: Optional[str] = None,
        location: Optional[str] = None,
        min_experience: Optional[float] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Resume]:
        stmt = select(Resume)
        if q:
            ql = f"%{q.lower()}%"
            stmt = stmt.where(
                (Resume.original_name.ilike(ql))
                | (Resume.email.ilike(ql))
                | (Resume.job_applied.ilike(ql))
                | (Resume.explanation.ilike(ql))
                | (cast(Resume.skills, SqlString).ilike(ql))
            )
        if min_score is not None:
            stmt = stmt.where(Resume.total_score >= min_score)
        if job_role:
            stmt = stmt.where(Resume.job_applied.ilike(f"%{job_role}%"))
        if status:
            stmt = stmt.where(Resume.status == status)
        if location:
            stmt = stmt.where(Resume.location.ilike(f"%{location}%"))
        if min_experience is not None:
            stmt = stmt.where(Resume.exp_years >= min_experience)
        stmt = stmt.order_by(desc(Resume.total_score)).limit(limit).offset(offset)
        return list(self.db.execute(stmt).scalars().all())

    def get_top_n(self, n: int = 10) -> List[Resume]:
        """Return top N resumes by total score."""
        return (
            self.db.query(Resume)
            .order_by(desc(Resume.total_score))
            .limit(n)
            .all()
        )

    def get_notes(self, resume_id: str) -> List[CandidateNote]:
        return (
            self.db.query(CandidateNote)
            .filter(CandidateNote.resume_id == resume_id)
            .order_by(desc(CandidateNote.created_at))
            .all()
        )

    # ── Write ────────────────────────────────────────────────────

    def update_status(self, resume_id: str, new_status: str) -> Optional[Resume]:
        resume = self.get(resume_id)
        if not resume:
            return None
        old_status = resume.status or "Applied"
        resume.status = new_status
        self.db.add(
            CandidateActivity(
                resume_id=resume_id,
                activity_type="status_changed",
                message=f"Status changed from '{old_status}' to '{new_status}'.",
            )
        )
        self.db.commit()
        self.db.refresh(resume)
        return resume

    def add_note(
        self, resume_id: str, text: str, author: str = "Recruiter"
    ) -> Optional[CandidateNote]:
        if not self.get(resume_id):
            return None
        note = CandidateNote(resume_id=resume_id, author=author, text=text)
        self.db.add(note)
        self.db.add(
            CandidateActivity(
                resume_id=resume_id,
                activity_type="note_added",
                message=f"Note added by {author}.",
            )
        )
        self.db.commit()
        self.db.refresh(note)
        return note

    def delete_resume(self, resume_id: str) -> bool:
        """Hard-delete a resume and all its cascade-related rows."""
        return self.delete(resume_id)
