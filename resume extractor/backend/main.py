import os
import re
import json
import uuid
import shutil
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Float, JSON, DateTime, Integer, select, desc
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from service.nlp_service import NLPService, EndeeIndex

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resume_analyzer.main")

# Optional dependencies
try:
    import pdfplumber
except Exception:
    pdfplumber = None

try:
    from docx import Document
except Exception:
    Document = None

try:
    from PIL import Image
    import pytesseract
except Exception:
    pytesseract = None


# --- Settings ---
class Settings:
    DATABASE_URL: str = "sqlite:///./resume_ai.db"
    UPLOAD_DIR: str = "./uploads"
    ROLE_SKILLS_FILE: str = "./role_skills.json"
    USE_OCR: bool = False


settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# --- DB setup ---
Base = declarative_base()
engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    email = Column(String)
    phone = Column(String)
    location = Column(String)
    linkedin = Column(String)
    github = Column(String)
    skills = Column(JSON)
    skill_score = Column(Float)
    exp_years = Column(Float)
    exp_score = Column(Float)
    total_score = Column(Float, index=True)
    job_applied = Column(String)
    match_level = Column(String)
    missing_skills = Column(JSON)
    explanation = Column(String)
    strengths = Column(JSON)
    gaps = Column(JSON)
    retrieved_chunks = Column(JSON)
    confidence = Column(Float)
    size = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)

# --- FastAPI app ---
app = FastAPI(title="Resume Analyzer - Advanced")

# Configure CORS
frontend_url = os.getenv("FRONTEND_URL", "*")
if frontend_url and frontend_url != "*":
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        frontend_url.rstrip("/"),
    ]
    allow_credentials = True
else:
    allowed_origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Utilities ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def safe_filename(name: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9_.-]", "_", name)
    return f"{uuid.uuid4().hex}_{name}"


def read_role_skills(path: str) -> Dict[str, Any]:
    default = {
        "data analyst": ["python", "sql", "tableau", "excel", "statistics", "power bi", "pandas", "numpy"],
        "developer": ["react", "javascript", "node", "html", "css", "git", "api"],
        "python developer": ["python", "django", "fastapi", "sql", "aws", "docker"],
    }
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.warning("Failed to read role_skills.json: %s", e)
    return default


ROLE_SKILLS = {k.lower(): [s.lower() for s in v] for k, v in read_role_skills(settings.ROLE_SKILLS_FILE).items()}

PHONE_RE = re.compile(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}")
EMAIL_RE = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")
LINK_RE = re.compile(r"(https?://[^\s]+)")
YEARS_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)", re.I)
RANGE_RE = re.compile(r"(\b\d{4}\b).{0,20}?(\b\d{4}\b)")


def extract_text_from_pdf(path: str) -> str:
    if pdfplumber:
        try:
            with pdfplumber.open(path) as pdf:
                return "\n".join((p.extract_text() or "") for p in pdf.pages)
        except Exception as e:
            logger.warning("PDF extraction failed for %s: %s", path, e)
    return ""


def extract_text_from_docx(path: str) -> str:
    if Document:
        try:
            doc = Document(path)
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            logger.warning("DOCX extraction failed for %s: %s", path, e)
    return ""


def extract_text_from_txt(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        logger.warning("TXT extraction failed for %s: %s", path, e)
    return ""


def ocr_image(path: str) -> str:
    if pytesseract:
        try:
            return pytesseract.image_to_string(Image.open(path))
        except Exception as e:
            logger.warning("OCR failed for %s: %s", path, e)
    return ""


def extract_text(path: str, use_ocr: bool = False) -> str:
    ext = Path(path).suffix.lower()
    text = ""
    if ext == ".pdf":
        text = extract_text_from_pdf(path)
        if not text and use_ocr:
            text = ocr_image(path)
    elif ext == ".docx":
        text = extract_text_from_docx(path)
    else:
        text = extract_text_from_txt(path)

    if use_ocr and not text:
        text = ocr_image(path)

    return text or ""


def find_email(text: str) -> Optional[str]:
    m = EMAIL_RE.search(text)
    return m.group(0) if m else None


def find_phone(text: str) -> Optional[str]:
    m = PHONE_RE.search(text)
    return m.group(0) if m else None


def find_links(text: str) -> Dict[str, Optional[str]]:
    links = LINK_RE.findall(text)
    out = {"linkedin": None, "github": None}
    for l in links:
        if "linkedin.com" in l.lower():
            out["linkedin"] = l
        if "github.com" in l.lower():
            out["github"] = l
    return out


def parse_experience(text: str) -> float:
    m = YEARS_RE.search(text)
    if m:
        try:
            return float(m.group(1))
        except Exception:
            pass

    m2 = RANGE_RE.search(text)
    if m2:
        try:
            start = int(m2.group(1))
            end = int(m2.group(2))
            return float(abs(end - start))
        except Exception:
            pass

    return 0.0


def build_search_query(job_role: str, target_skills: List[str]) -> str:
    """
    Make semantic retrieval stronger than searching with 'data analyst' alone.
    """
    extras = ", ".join(target_skills[:8]) if target_skills else ""
    if extras:
        return f"{job_role}. Required skills and qualifications: {extras}"
    return job_role


def process_resume_file(file: UploadFile, job_role: str) -> Dict[str, Any]:
    safe_name = safe_filename(file.filename)
    path = os.path.join(settings.UPLOAD_DIR, safe_name)

    try:
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to save upload") from exc

    real_file_size = os.path.getsize(path)
    text = extract_text(path, use_ocr=settings.USE_OCR)

    logger.info(
        "Processing file=%s | size=%d bytes | text_length=%d | preview=%s",
        file.filename,
        real_file_size,
        len(text),
        repr(text[:250]),
    )

    email = find_email(text)
    phone = find_phone(text)
    links = find_links(text)
    years = parse_experience(text)

    role_key = job_role.lower()
    target_skills = ROLE_SKILLS.get(role_key, ROLE_SKILLS.get("python developer", []))
    semantic_query = build_search_query(job_role, target_skills)

    chunks = NLPService.chunk_document(text)
    embedder = NLPService.get_embedder()
    index = EndeeIndex(embedder)

    index.add_documents(chunks)
    top_chunks = index.search(semantic_query, top_k=3)

    rag_result = NLPService.evaluate_resume_rag(semantic_query, top_chunks, raw_text=text)

    return {
        "filename": safe_name,
        "original_name": file.filename,
        "email": email,
        "phone": phone,
        "linkedin": links.get("linkedin"),
        "github": links.get("github"),
        "exp_years": years,
        "skills": rag_result.get("skills", []),
        "missing_skills": rag_result.get("missing_skills", []),
        "score": rag_result.get("score", 0),
        "match_level": rag_result.get("match_level", "Weak Match"),
        "explanation": rag_result.get("explanation", ""),
        "strengths": rag_result.get("strengths", []),
        "gaps": rag_result.get("gaps", []),
        "retrieved_chunks": rag_result.get("retrieved_chunks", []),
        "confidence": rag_result.get("confidence", 0.0),
        "size": real_file_size,
        "job_applied": job_role,
    }


# --- Pydantic schemas ---
class AnalyzeResponse(BaseModel):
    id: str
    filename: str
    email: Optional[str]
    phone: Optional[str]
    linkedin: Optional[str]
    github: Optional[str]
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
    retrieved_chunks: List[str]
    confidence: float
    size: int
    uploaded_at: datetime


# --- Endpoints ---
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_one(
    job_role: str = Query(..., description="Job role to match against"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    result = process_resume_file(file, job_role)

    resume = Resume(
        filename=result["filename"],
        original_name=result["original_name"],
        email=result["email"],
        phone=result["phone"],
        linkedin=result["linkedin"],
        github=result["github"],
        skills=result["skills"],
        missing_skills=result["missing_skills"],
        skill_score=result["score"],
        exp_years=result["exp_years"],
        exp_score=0.0,
        total_score=result["score"],
        match_level=result["match_level"],
        explanation=result["explanation"],
        strengths=result["strengths"],
        gaps=result["gaps"],
        retrieved_chunks=result["retrieved_chunks"],
        confidence=result["confidence"],
        size=result["size"],
        job_applied=result["job_applied"],
    )

    try:
        db.add(resume)
        db.commit()
        db.refresh(resume)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="DB error")

    return AnalyzeResponse(
        id=resume.id,
        filename=resume.original_name,
        email=resume.email,
        phone=resume.phone,
        linkedin=resume.linkedin,
        github=resume.github,
        skills=resume.skills or [],
        skill_score=resume.skill_score or 0.0,
        exp_years=resume.exp_years or 0.0,
        exp_score=resume.exp_score or 0.0,
        total_score=resume.total_score or 0.0,
        job_applied=resume.job_applied,
        match_level=resume.match_level or "Weak Match",
        explanation=resume.explanation or "",
        missing_skills=resume.missing_skills or [],
        strengths=resume.strengths or [],
        gaps=resume.gaps or [],
        retrieved_chunks=resume.retrieved_chunks or [],
        confidence=resume.confidence or 0.0,
        size=resume.size or 0,
        uploaded_at=resume.uploaded_at,
    )


@app.post("/batch-analyze")
async def batch_analyze(
    job_role: str = Query(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    results = []
    resumes_to_save = []

    for file in files:
        result = process_resume_file(file, job_role)

        resume = Resume(
            filename=result["filename"],
            original_name=result["original_name"],
            email=result["email"],
            phone=result["phone"],
            linkedin=result["linkedin"],
            github=result["github"],
            skills=result["skills"],
            missing_skills=result["missing_skills"],
            skill_score=result["score"],
            exp_years=result["exp_years"],
            exp_score=0.0,
            total_score=result["score"],
            match_level=result["match_level"],
            explanation=result["explanation"],
            strengths=result["strengths"],
            gaps=result["gaps"],
            retrieved_chunks=result["retrieved_chunks"],
            confidence=result["confidence"],
            size=result["size"],
            job_applied=result["job_applied"],
        )

        resumes_to_save.append(resume)

        results.append({
            "name": result["original_name"],
            "email": result["email"] or "N/A",
            "score": result["score"],
            "match_level": result["match_level"],
            "skills": result["skills"],
            "missing_skills": result["missing_skills"],
            "explanation": result["explanation"],
            "strengths": result["strengths"],
            "gaps": result["gaps"],
            "retrieved_chunks": result["retrieved_chunks"],
            "confidence": result["confidence"],
            "exp_years": result["exp_years"],
            "size": result["size"],
        })

    try:
        db.add_all(resumes_to_save)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB commit failed: {e}")

    return sorted(results, key=lambda r: r["score"] or 0, reverse=True)


@app.get("/resumes")
def list_resumes(
    q: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    job_role: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(Resume)
    if q:
        ql = f"%{q.lower()}%"
        stmt = stmt.where(Resume.original_name.ilike(ql) | Resume.email.ilike(ql))
    if min_score is not None:
        stmt = stmt.where(Resume.total_score >= min_score)
    if job_role:
        stmt = stmt.where(Resume.job_applied == job_role)

    stmt = stmt.order_by(desc(Resume.total_score)).limit(limit).offset(offset)
    rows = db.execute(stmt).scalars().all()

    return [
        {
            "id": r.id,
            "name": r.original_name,
            "email": r.email,
            "skills": r.skills,
            "score": r.total_score,
            "uploaded_at": r.uploaded_at,
        }
        for r in rows
    ]


@app.get("/resumes/{resume_id}", response_model=AnalyzeResponse)
def get_resume(resume_id: str, db: Session = Depends(get_db)):
    r = db.query(Resume).filter(Resume.id == resume_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")

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
        retrieved_chunks=r.retrieved_chunks or [],
        confidence=r.confidence or 0.0,
        size=r.size or 0,
        uploaded_at=r.uploaded_at,
    )


@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}