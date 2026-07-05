import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.api.v1.dependencies import require_roles
from backend.db.database import get_db
from backend.models.resume import Resume

router = APIRouter()


@router.get(
    "/candidates/csv",
    dependencies=[Depends(require_roles(["Admin", "Recruiter", "HR"]))],
)
def export_candidates_csv(db: Session = Depends(get_db)):
    """Export all candidates as a CSV file. Restricted to Admin, Recruiter, and HR roles."""
    resumes = db.query(Resume).order_by(desc(Resume.total_score)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Name", "Email", "Phone", "Score", "Match Level",
        "Skills", "Missing Skills", "Status", "Uploaded At",
    ])

    for r in resumes:
        writer.writerow([
            r.id,
            r.original_name,
            r.email or "",
            r.phone or "",
            r.total_score,
            r.match_level,
            ", ".join(r.skills) if r.skills else "",
            ", ".join(r.missing_skills) if r.missing_skills else "",
            r.status or "Applied",
            r.uploaded_at.isoformat() if r.uploaded_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=candidates.csv"},
    )
