import threading
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db, SessionLocal
from backend.models.batch import BatchJob
from backend.models.resume import Resume
from backend.services.resume_service import ResumeService

logger = logging.getLogger("resume_analyzer.batch")
router = APIRouter()


# ─────────────────────────────────────────────────────────────────
# Background Processing
# ─────────────────────────────────────────────────────────────────

def _run_batch(batch_id: str, files_data: List[tuple], job_description: str):
    """Runs in a background thread. Processes all resumes, updates the BatchJob record."""
    db: Session = SessionLocal()
    try:
        job = db.query(BatchJob).filter(BatchJob.id == batch_id).first()
        if not job:
            return
        job.status = "processing"
        db.commit()

        results, errors = ResumeService.process_batch(files_data, job_description)

        # Persist each resume record with batch context
        for r in results:
            resume = Resume(
                filename=r["filename"],
                original_name=r["original_name"],
                email=r.get("email", ""),
                phone=r.get("phone", ""),
                linkedin=r.get("linkedin", ""),
                github=r.get("github", ""),
                skills=r.get("skills", []),
                missing_skills=r.get("missing_skills", []),
                skill_score=r.get("score", 0),
                exp_years=r.get("exp_years", 0),
                exp_score=0.0,
                total_score=r.get("score", 0),
                match_level=r.get("match_level", "Weak Match"),
                explanation=r.get("explanation", ""),
                strengths=r.get("strengths", []),
                gaps=r.get("gaps", []),
                education=r.get("education", []),
                projects=r.get("projects", []),
                certifications=r.get("certifications", []),
                retrieved_chunks=r.get("retrieved_chunks", []),
                confidence=r.get("confidence", 0.0),
                size=r.get("size", 0),
                job_applied=job_description,
            )
            db.add(resume)
            r["resume_id"] = resume.id  # attach DB id to result

        db.flush()

        # Sort by score descending, assign rank
        ranked = sorted(results, key=lambda x: x.get("score", 0), reverse=True)
        for i, r in enumerate(ranked):
            r["rank"] = i + 1

        scores = [r.get("score", 0) for r in ranked]
        avg = round(sum(scores) / len(scores), 2) if scores else 0.0
        high = max(scores) if scores else 0.0
        low = min(scores) if scores else 0.0
        top = ranked[0].get("original_name", "") if ranked else ""

        job.status = "done"
        job.completed = len(results)
        job.failed = len(errors)
        job.results = ranked
        job.errors = errors
        job.average_score = avg
        job.highest_score = high
        job.lowest_score = low
        job.top_candidate = top
        job.finished_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        logger.exception(f"Batch job {batch_id} failed: {e}")
        try:
            job = db.query(BatchJob).filter(BatchJob.id == batch_id).first()
            if job:
                job.status = "error"
                job.errors = [{"file": "batch", "error": str(e)}]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def start_batch_analysis(
    job_description: str = Form(..., description="Job description or role"),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """
    Start a new batch analysis job.
    Returns batch_id immediately. Poll /batch/{batch_id}/status for progress.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 files per batch")

    # Read all file bytes first (in async context)
    files_data = []
    for f in files:
        if not f.filename or not any(f.filename.lower().endswith(ext) for ext in [".pdf", ".doc", ".docx", ".txt"]):
            continue  # silently skip unsupported files
        content = await f.read()
        files_data.append((f.filename, content))

    if not files_data:
        raise HTTPException(status_code=400, detail="No valid files (PDF, DOCX, TXT) found in upload")

    # Create DB record
    job = BatchJob(
        status="pending",
        job_description=job_description,
        total_files=len(files_data),
        results=[],
        errors=[],
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Launch background thread
    t = threading.Thread(
        target=_run_batch,
        args=(job.id, files_data, job_description),
        daemon=True,
    )
    t.start()

    return {
        "batch_id": job.id,
        "status": "pending",
        "total_files": len(files_data),
        "message": f"Processing {len(files_data)} file(s). Poll /api/v1/batch/{job.id}/status for updates.",
    }


@router.get("/{batch_id}/status")
def get_batch_status(batch_id: str, db: Session = Depends(get_db)):
    """Poll this endpoint to check batch progress and retrieve results when done."""
    job = db.query(BatchJob).filter(BatchJob.id == batch_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    response: Dict[str, Any] = {
        "batch_id": job.id,
        "status": job.status,
        "total_files": job.total_files,
        "completed": job.completed,
        "failed": job.failed,
        "progress_pct": round((job.completed + job.failed) / max(job.total_files, 1) * 100, 1),
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }

    if job.status == "done":
        response.update({
            "results": job.results or [],
            "errors": job.errors or [],
            "summary": {
                "total_resumes": job.total_files,
                "successful": job.completed,
                "failed": job.failed,
                "average_score": job.average_score,
                "highest_score": job.highest_score,
                "lowest_score": job.lowest_score,
                "top_candidate": job.top_candidate,
            },
        })
    elif job.status == "error":
        response["errors"] = job.errors or []

    return response


@router.get("/")
def list_batches(
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List recent batch jobs."""
    jobs = (
        db.query(BatchJob)
        .order_by(BatchJob.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [
        {
            "batch_id": j.id,
            "status": j.status,
            "total_files": j.total_files,
            "completed": j.completed,
            "failed": j.failed,
            "average_score": j.average_score,
            "top_candidate": j.top_candidate,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]
