import os
import re
import uuid
import shutil
import tempfile
import logging
from datetime import datetime
from typing import List, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import FastAPI, UploadFile, File, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Float, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import pdfplumber
from docx import Document
import magic  # python-magic-bin

from service.nlp_service import NLPService, EndeeIndex

# Optional OCR
try:
    from PIL import Image
    import pytesseract
    OCR_AVAILABLE = True
except Exception:
    OCR_AVAILABLE = False

# ---- Config ----
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./resume_ai.db")
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "10"))
MAX_FILE_BYTES = int(os.getenv("MAX_FILE_BYTES", str(10 * 1024 * 1024)))  # 10MB

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resume_analyzer")

# ---- DB ----
Base = declarative_base()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String)
    email = Column(String)
    skills = Column(JSON)
    score = Column(Float)
    match_level = Column(String)
    missing_skills = Column(JSON)
    explanation = Column(String)
    strengths = Column(JSON)
    gaps = Column(JSON)
    retrieved_chunks = Column(JSON)
    confidence = Column(Float)
    job_role = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# ---- FastAPI ----
app = FastAPI(title="Advanced Resume Analyzer")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ---- Utilities ----
def save_temp_file(filename: str, data: bytes) -> str:
    suffix = os.path.splitext(filename)[1] or ""
    tf = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tf.write(data)
    tf.flush()
    tf.close()
    return tf.name

def read_text_from_pdf(path: str) -> str:
    try:
        with pdfplumber.open(path) as pdf:
            return " ".join(p.extract_text() or "" for p in pdf.pages)
    except Exception as e:
        logger.debug("pdf read failed: %s", e)
        return ""

def read_text_from_docx(path: str) -> str:
    try:
        doc = Document(path)
        return " ".join(p.text for p in doc.paragraphs)
    except Exception as e:
        logger.debug("docx read failed: %s", e)
        return ""

def read_text_from_txt(path: str) -> str:
    try:
        return open(path, "r", errors="ignore").read()
    except Exception:
        return ""

def ocr_image_file(path: str) -> str:
    if not OCR_AVAILABLE:
        return ""
    try:
        return pytesseract.image_to_string(Image.open(path))
    except Exception as e:
        logger.debug("OCR failed: %s", e)
        return ""

def extract_text(path: str) -> str:
    mime = ""
    try:
        mime = magic.from_file(path, mime=True)
    except Exception:
        pass
    ext = os.path.splitext(path)[1].lower()

    text = ""
    if "pdf" in mime or ext == ".pdf":
        text = read_text_from_pdf(path)
    elif "word" in mime or ext == ".docx":
        text = read_text_from_docx(path)
    elif "text" in mime or ext in (".txt", ".md"):
        text = read_text_from_txt(path)
    else:
        # fallback to trying common readers then OCR
        text = read_text_from_pdf(path) or read_text_from_docx(path) or read_text_from_txt(path)
    if not text and OCR_AVAILABLE:
        text = ocr_image_file(path)
    return (text or "").strip()

# regexes
EMAIL_RE = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")
YEARS_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)", re.I)
YEAR_RANGE_RE = re.compile(r"(\b(19|20)\d{2}\b).{0,30}?(\b(19|20)\d{2}\b)")

# ---- Scoring & RAG replaced fuzzy exact matching ----

# ---- Worker ----
def process_single_resume(file_tuple: Tuple[str, bytes], job_role: str) -> Dict[str, Any]:
    filename, content = file_tuple
    if len(content) > MAX_FILE_BYTES:
        raise ValueError(f"File {filename} exceeds max size")
    tmp_path = save_temp_file(filename, content)
    try:
        text = extract_text(tmp_path)
        email_m = EMAIL_RE.search(text)
        
        # New RAG flow: Query -> Embed -> Endee -> Retrieve -> Context -> LLM -> Response
        chunks = NLPService.chunk_document(text)
        embedder = NLPService.get_embedder()
        index = EndeeIndex(embedder)
        
        index.add_documents(chunks)
        top_chunks = index.search(job_role, top_k=3)
        
        rag_result = NLPService.evaluate_resume_rag(job_role, top_chunks)
        sc = rag_result.get("score", 0)
        found = rag_result.get("skills", [])
        explanation = rag_result.get("explanation", "")
        match_level = rag_result.get("match_level", "Weak Match")
        missing = rag_result.get("missing_skills", [])
        strengths = rag_result.get("strengths", [])
        gaps = rag_result.get("gaps", [])
        chunks = rag_result.get("retrieved_chunks", [])
        conf = rag_result.get("confidence", 0.0)
        
        return {
            "name": filename, 
            "email": email_m.group(0) if email_m else "N/A", 
            "skills": found, 
            "missing_skills": missing,
            "score": sc, 
            "match_level": match_level,
            "explanation": explanation,
            "strengths": strengths,
            "gaps": gaps,
            "retrieved_chunks": chunks,
            "confidence": conf,
            "size": len(content),
            "exp": f"0.0 Yrs"
        }
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

# ---- Pydantic response ----
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
    retrieved_chunks: List[str]
    confidence: float
    size: int
    exp: str

# ---- API ----
@app.post("/batch-analyze", response_model=List[CandidateOut])
async def batch_analyze(job_role: str = Query(...), files: List[UploadFile] = File(...)):
    # read files into memory
    file_tasks = []
    for f in files:
        content = await f.read()
        file_tasks.append((f.filename, content))

    results = []
    errors = []
    
    # Parallel processing with bounded workers
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as exe:
        futures = {exe.submit(process_single_resume, ft, job_role): ft[0] for ft in file_tasks}
        for fut in as_completed(futures):
            name = futures[fut]
            try:
                r = fut.result()
                results.append(r)
            except Exception as e:
                logger.exception("Processing %s failed: %s", name, e)
                errors.append({"file": name, "error": str(e)})

    # Bulk insert
    db: Session = SessionLocal()
    try:
        objs = []
        for r in results:
            objs.append(Resume(
                name=r["name"], 
                email=r["email"], 
                skills=r["skills"], 
                missing_skills=r["missing_skills"],
                score=r["score"], 
                match_level=r["match_level"],
                explanation=r["explanation"],
                strengths=r["strengths"],
                gaps=r["gaps"],
                job_role=job_role
            ))
        db.bulk_save_objects(objs)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("DB save failed")
    finally:
        db.close()

    # sort and return top results
    sorted_res = sorted(results, key=lambda x: x["score"], reverse=True)
    if errors:
        logger.warning("Some files failed: %s", errors)
    return sorted_res
