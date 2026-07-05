import logging
import os
from typing import Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.core.config import settings
from backend.db.database import get_db
from backend.models.interview import InterviewSession
from backend.models.resume import Resume

logger = logging.getLogger("resume_analyzer.analytics")

router = APIRouter()


@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    total_resumes = db.query(Resume).count()
    total_interviews = db.query(InterviewSession).count()

    if total_resumes == 0:
        return {
            "total_resumes": 0,
            "total_candidates": 0,
            "total_interviews": 0,
            "shortlisted_candidates": 0,
            "rejected_candidates": 0,
            "pending_candidates": 0,
            "average_score": 0.0,
            "average_interview_score": 0.0,
            "average_confidence": 0.0,
            "highest_match_score": 0.0,
            "lowest_match_score": 0.0,
            "top_skills": [],
            "missing_skills_analytics": [],
            "match_level_distribution": [],
            "status_distribution": [],
        }

    avg_score = db.query(func.avg(Resume.total_score)).scalar() or 0.0
    avg_conf = db.query(func.avg(Resume.confidence)).scalar() or 0.0

    highest_score = db.query(func.max(Resume.total_score)).scalar() or 0.0
    lowest_score = db.query(func.min(Resume.total_score)).scalar() or 0.0

    avg_interview_score = db.query(func.avg(InterviewSession.total_score)).scalar() or 0.0

    shortlisted_candidates = db.query(Resume).filter(Resume.status == "Shortlisted").count()
    rejected_candidates = db.query(Resume).filter(Resume.status == "Rejected").count()
    pending_candidates = db.query(Resume).filter(
        Resume.status.in_(["Applied", "Screening", "Interview Scheduled"])
    ).count()

    match_levels = db.query(Resume.match_level, func.count(Resume.id)).group_by(Resume.match_level).all()
    match_dist = [{"level": m[0], "count": m[1]} for m in match_levels]

    status_counts = db.query(Resume.status, func.count(Resume.id)).group_by(Resume.status).all()
    status_dist = [{"status": s[0], "count": s[1]} for s in status_counts]

    # Aggregate skills — load only the JSON columns needed
    all_resumes = db.query(Resume.skills, Resume.missing_skills).all()
    skill_counts: Dict[str, int] = {}
    missing_counts: Dict[str, int] = {}

    for r in all_resumes:
        if r.skills:
            for s in r.skills:
                skill_counts[s] = skill_counts.get(s, 0) + 1
        if r.missing_skills:
            for m in r.missing_skills:
                missing_counts[m] = missing_counts.get(m, 0) + 1

    top_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    top_missing = sorted(missing_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "total_resumes": total_resumes,
        "total_candidates": total_resumes,
        "total_interviews": total_interviews,
        "shortlisted_candidates": shortlisted_candidates,
        "rejected_candidates": rejected_candidates,
        "pending_candidates": pending_candidates,
        "average_score": round(avg_score, 2),
        "average_interview_score": round(avg_interview_score, 2),
        "average_confidence": round(avg_conf, 2),
        "highest_match_score": round(highest_score, 2),
        "lowest_match_score": round(lowest_score, 2),
        "top_skills": [{"name": k, "count": v} for k, v in top_skills],
        "missing_skills_analytics": [{"name": k, "count": v} for k, v in top_missing],
        "match_level_distribution": match_dist,
        "status_distribution": status_dist,
    }


@router.get("/insights")
def get_ai_insights(db: Session = Depends(get_db)):
    """Generates AI insights over the candidate pool via Gemini."""
    resumes = db.query(Resume).order_by(Resume.total_score.desc()).limit(20).all()
    if not resumes:
        return {"insights": "Not enough data to generate insights yet."}

    # Build summary for Gemini
    lines = []
    for r in resumes:
        line = f"Candidate: {r.original_name}, Score: {r.total_score}, Level: {r.match_level}"
        if r.skills:
            line += f", Skills: {', '.join(r.skills[:5])}"
        lines.append(line)
    summary = "\n".join(lines)

    prompt = (
        "Analyze this recent candidate pool and provide a 4–5 sentence strategic hiring insight "
        "for a recruiter. Focus on overall quality and skill gaps:\n" + summary
    )

    api_key = settings.gemini_api_key
    if not api_key or api_key == "your_gemini_api_key_here":
        top_name = resumes[0].original_name if resumes else "N/A"
        return {
            "insights": (
                "Gemini API key is not configured. Cannot generate advanced insights. "
                f"The top candidate by ATS score is {top_name}."
            )
        }

    try:
        from google import genai  # deferred: only needed when API key is present

        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config={"temperature": 0.3},
        )
        return {"insights": resp.text}
    except Exception as e:
        logger.error("Failed to generate insights: %s", e)
        return {"insights": "Error generating insights from AI provider."}
