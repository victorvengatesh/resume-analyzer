import os
import re
import tempfile
import logging
from typing import Dict, Any, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.core.config import settings
from backend.services.nlp_service import NLPService, EndeeIndex

logger = logging.getLogger("resume_analyzer.resume_service")

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    from docx import Document
except ImportError:
    Document = None

try:
    import magic
except ImportError:
    magic = None

try:
    from PIL import Image
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


PHONE_RE = re.compile(r"\+?\d[\d .()-]{7,}\d")
EMAIL_RE = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")
LINK_RE = re.compile(r"(https?://[^\s]+)")
YEARS_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)", re.I)
RANGE_RE = re.compile(r"(\b\d{4}\b).{0,20}?(\b\d{4}\b)")


def find_email(text: str) -> str:
    m = EMAIL_RE.search(text)
    return m.group(0) if m else ""


def find_phone(text: str) -> str:
    m = PHONE_RE.search(text)
    return m.group(0) if m else ""


def find_links(text: str) -> Dict[str, str]:
    links = LINK_RE.findall(text)
    out = {"linkedin": "", "github": ""}
    for link in links:
        if "linkedin.com" in link.lower():
            out["linkedin"] = link
        if "github.com" in link.lower():
            out["github"] = link
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


class FileProcessor:
    @staticmethod
    def extract_text(path: str) -> str:
        mime = ""
        if magic:
            try:
                mime = magic.from_file(path, mime=True)
            except Exception:
                pass
        ext = os.path.splitext(path)[1].lower()

        text = ""
        if ("pdf" in mime or ext == ".pdf") and pdfplumber:
            try:
                with pdfplumber.open(path) as pdf:
                    text = "\n".join((p.extract_text() or "") for p in pdf.pages)
            except Exception as e:
                logger.warning(f"PDF extract error for {path}: {e}")
        elif ("word" in mime or ext == ".docx") and Document:
            try:
                doc = Document(path)
                text = "\n".join(p.text for p in doc.paragraphs)
            except Exception as e:
                logger.warning(f"DOCX extract error for {path}: {e}")
        elif "text" in mime or ext in (".txt", ".md"):
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
            except Exception as e:
                logger.warning(f"TXT extract error for {path}: {e}")

        if not text and settings.use_ocr and OCR_AVAILABLE:
            try:
                text = pytesseract.image_to_string(Image.open(path))
            except Exception as e:
                logger.warning(f"OCR failed for {path}: {e}")

        return text.strip()


class ResumeService:
    @staticmethod
    def process_single_resume(file_content: bytes, filename: str, job_role: str) -> Dict[str, Any]:
        if len(file_content) > settings.max_file_bytes:
            raise ValueError(f"File {filename} exceeds max size")

        suffix = os.path.splitext(filename)[1] or ""
        tf = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tf.write(file_content)
        tf.flush()
        tf.close()
        
        try:
            text = FileProcessor.extract_text(tf.name)
            email = find_email(text)
            phone = find_phone(text)
            links = find_links(text)
            years = parse_experience(text)

            # Build a semantic query from the job role and skills mentioned in it
            # NLPService will also do keyword extraction on the full text
            from backend.services.nlp_service import COMMON_SKILLS
            job_lower = job_role.lower()
            # Find skills mentioned in the job role string
            role_skills = [s for s in COMMON_SKILLS if s in job_lower]
            extras = ", ".join(role_skills[:8]) if role_skills else "python, sql, communication"
            semantic_query = f"{job_role}. Required skills and qualifications: {extras}"

            chunks = NLPService.chunk_document(text)
            index = EndeeIndex()
            index.add_documents(chunks)
            top_chunks = index.search(semantic_query, top_k=3)

            rag_result = NLPService.evaluate_resume_rag(semantic_query, top_chunks, raw_text=text)
            
            return {
                "filename": filename,
                "original_name": filename,
                "email": email,
                "phone": phone,
                "linkedin": links.get("linkedin", ""),
                "github": links.get("github", ""),
                "exp_years": years,
                "skills": rag_result.get("skills", []),
                "missing_skills": rag_result.get("missing_skills", []),
                "score": rag_result.get("score", 0),
                "match_level": rag_result.get("match_level", "Weak Match"),
                "explanation": rag_result.get("explanation", ""),
                "strengths": rag_result.get("strengths", []),
                "gaps": rag_result.get("gaps", []),
                "education": rag_result.get("education", []),
                "projects": rag_result.get("projects", []),
                "certifications": rag_result.get("certifications", []),
                "retrieved_chunks": rag_result.get("retrieved_chunks", []),
                "confidence": rag_result.get("confidence", 0.0),
                "size": len(file_content),
                "job_applied": job_role,
            }
        finally:
            try:
                os.remove(tf.name)
            except Exception:
                pass

    @staticmethod
    def process_batch(files_data: List[Tuple[str, bytes]], job_role: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, str]]]:
        """
        Process every file independently and return results in the SAME ORDER as
        files_data (i.e. the order the caller uploaded them).

        as_completed() yields futures in *completion* order, which is non-
        deterministic under concurrent execution.  We therefore store each
        future alongside its original list index, collect results into a
        pre-sized list, and fill errors by position so ordering is preserved.
        """
        n = len(files_data)
        ordered: List[Optional[Dict[str, Any]]] = [None] * n   # result slot per file
        errors: List[Dict[str, str]] = []

        with ThreadPoolExecutor(max_workers=settings.max_workers) as exe:
            # Key: future → (original_index, filename)
            futures = {
                exe.submit(ResumeService.process_single_resume, data, name, job_role): (idx, name)
                for idx, (name, data) in enumerate(files_data)
            }
            for fut in as_completed(futures):
                idx, name = futures[fut]
                try:
                    ordered[idx] = fut.result()
                except Exception as e:
                    logger.exception(f"Processing '{name}' (index {idx}) failed: {e}")
                    errors.append({"file": name, "error": str(e)})

        # Drop None slots (files that errored) from the results list while
        # keeping successful results in original upload order.
        results = [r for r in ordered if r is not None]
        return results, errors
