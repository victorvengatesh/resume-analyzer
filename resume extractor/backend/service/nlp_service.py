import os
import re
import json
import logging
from threading import Lock
from typing import List, Dict, Any, Optional

try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
except ImportError:
    np = None
    SentenceTransformer = None

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    RecursiveCharacterTextSplitter = None


logger = logging.getLogger("resume_analyzer.nlp_service")

COMMON_SKILLS = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "ruby", "rust", "scala",
    "sql", "mysql", "postgresql", "mongodb", "redis", "sqlite", "oracle",
    "react", "angular", "vue", "node", "express", "django", "flask", "fastapi", "spring",
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform", "ansible", "ci/cd",
    "git", "linux", "bash", "powershell",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "scikit-learn",
    "data analysis", "pandas", "numpy", "matplotlib", "tableau", "power bi", "excel",
    "statistics", "r", "spark", "hadoop", "airflow",
    "html", "css", "rest api", "graphql", "microservices", "agile", "scrum",
    "communication", "leadership", "problem solving", "teamwork",
]

SKILL_PATTERNS = {
    skill: re.compile(r"\b" + re.escape(skill) + r"\b", re.IGNORECASE)
    for skill in COMMON_SKILLS
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
MULTISPACE_RE = re.compile(r"\s+")
NON_PRINTABLE_RE = re.compile(r"[^\x09\x0A\x0D\x20-\x7E]+")


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = NON_PRINTABLE_RE.sub(" ", text)
    text = text.replace("\x00", " ")
    text = MULTISPACE_RE.sub(" ", text)
    return text.strip()


class EndeeIndex:
    """
    Lightweight in-memory semantic index for resume chunks.
    Keeps retrieval stable and always returns top chunks when text exists.
    """

    def __init__(self, embedder: Optional[SentenceTransformer]):
        self.embedder = embedder
        self.chunks: List[str] = []
        self.embeddings = None

    def add_documents(self, text_chunks: List[str]) -> None:
        if not text_chunks:
            logger.warning("No chunks provided to add_documents.")
            return
        if self.embedder is None or np is None:
            logger.warning("Embedder unavailable; skipping vector indexing.")
            return

        deduped = []
        seen = set()
        for chunk in text_chunks:
            c = clean_text(chunk)
            if len(c) < 40:
                continue
            key = c.lower()
            if key not in seen:
                seen.add(key)
                deduped.append(c)

        if not deduped:
            logger.warning("All chunks were empty/too small after cleaning.")
            return

        new_embeddings = self.embedder.encode(
            deduped,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )

        self.chunks.extend(deduped)
        if self.embeddings is None:
            self.embeddings = new_embeddings
        else:
            self.embeddings = np.vstack([self.embeddings, new_embeddings])

        logger.info("Indexed %d cleaned chunks.", len(deduped))

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        if not query or not self.chunks or self.embeddings is None or self.embedder is None or np is None:
            logger.warning("Search skipped: query/chunks/embedder missing.")
            return []

        query = clean_text(query)
        if not query:
            return []

        contextualized_query = f"Skills, experience, tools, and qualifications relevant to: {query}"
        query_emb = self.embedder.encode(
            [contextualized_query],
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )[0]

        similarities = np.dot(self.embeddings, query_emb)
        top_indices = np.argsort(similarities)[::-1][:top_k]

        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            results.append({
                "text": self.chunks[int(idx)],
                "score": round(score, 4)
            })

        logger.info(
            "Retrieved %d chunks | best score=%.4f",
            len(results),
            results[0]["score"] if results else 0.0
        )
        return results


class NLPService:
    _embedder = None
    _embedder_lock = Lock()

    @classmethod
    def get_embedder(cls):
        if cls._embedder is not None:
            return cls._embedder

        if SentenceTransformer is None:
            logger.error("sentence-transformers is not installed.")
            return None

        with cls._embedder_lock:
            if cls._embedder is None:
                try:
                    logger.info("Loading embedder: all-MiniLM-L6-v2")
                    cls._embedder = SentenceTransformer("all-MiniLM-L6-v2")
                    logger.info("Embedder loaded successfully.")
                except Exception as e:
                    logger.exception("Failed to load embedder: %s", e)
                    cls._embedder = None

        return cls._embedder

    @staticmethod
    def extract_entities(text: str) -> Dict[str, str]:
        cleaned = clean_text(text)
        email = EMAIL_RE.search(cleaned)

        lines = [line.strip() for line in text.splitlines() if line.strip()]
        name = lines[0] if lines else "Unknown"

        if len(name) > 80:
            name = "Unknown"

        return {
            "name": name,
            "email": email.group(0) if email else "N/A"
        }

    @staticmethod
    def chunk_document(text: str, chunk_size: int = 700, chunk_overlap: int = 120) -> List[str]:
        text = clean_text(text)
        if not text:
            logger.warning("chunk_document received empty text.")
            return []

        if RecursiveCharacterTextSplitter is not None:
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                separators=["\n\n", "\n", ".", ";", ",", " ", ""]
            )
            chunks = splitter.split_text(text)
        else:
            words = text.split()
            if not words:
                return []
            window = 120
            step = 90
            chunks = []
            for i in range(0, len(words), step):
                chunk = " ".join(words[i:i + window]).strip()
                if chunk:
                    chunks.append(chunk)

        cleaned_chunks = []
        seen = set()
        for chunk in chunks:
            c = clean_text(chunk)
            if len(c) < 40:
                continue
            key = c.lower()
            if key not in seen:
                seen.add(key)
                cleaned_chunks.append(c)

        logger.info("Created %d useful chunks.", len(cleaned_chunks))
        return cleaned_chunks[:20]

    @staticmethod
    def _extract_skills(text: str) -> List[str]:
        text = clean_text(text)
        found = []
        for skill, pattern in SKILL_PATTERNS.items():
            if pattern.search(text):
                found.append(skill)
        return found

    @staticmethod
    def _infer_missing_skills(job_query: str, found_skills: List[str]) -> List[str]:
        job_lower = clean_text(job_query).lower()
        requested = [skill for skill in COMMON_SKILLS if skill in job_lower]
        missing = [skill for skill in requested if skill not in found_skills]
        return missing[:8]

    @staticmethod
    def _semantic_fallback_score(job_query: str, resume_chunks: List[Dict[str, Any]], raw_text: str = "") -> Dict[str, Any]:
        cleaned_text = clean_text(raw_text)

        if not cleaned_text:
            return {
                "score": 0,
                "match_level": "Weak Match",
                "skills": [],
                "missing_skills": [],
                "explanation": "No readable text could be extracted from this resume.",
                "strengths": [],
                "gaps": ["Resume text extraction failed or returned empty content."],
                "retrieved_chunks": [],
                "confidence": 0.0
            }

        if not resume_chunks:
            found_skills = NLPService._extract_skills(cleaned_text)
            missing = NLPService._infer_missing_skills(job_query, found_skills)

            base_score = min(len(found_skills) * 4, 35)
            explanation = (
                "Resume text was extracted, but strong semantic evidence for the job requirement "
                "was not retrieved. Some general skills were detected, but the match appears weak."
            )

            return {
                "score": base_score,
                "match_level": "Weak Match" if base_score < 40 else "Moderate Match",
                "skills": found_skills,
                "missing_skills": missing,
                "explanation": explanation,
                "strengths": [f"Resume mentions {s}" for s in found_skills[:4]],
                "gaps": [f"Missing or unclear: {s}" for s in missing[:4]] if missing else ["Role-specific evidence is limited."],
                "retrieved_chunks": [],
                "confidence": 0.0
            }

        scores = [float(c.get("score", 0.0)) for c in resume_chunks]
        best_score = max(scores) if scores else 0.0
        avg_score = sum(scores) / len(scores) if scores else 0.0

        found_skills = NLPService._extract_skills(cleaned_text)
        missing = NLPService._infer_missing_skills(job_query, found_skills)

        # Better scaling for semantic scores from MiniLM cosine space
        semantic_component = max(0.0, min(best_score, 1.0)) * 70
        evidence_component = max(0.0, min(avg_score, 1.0)) * 20
        skill_component = min(len(found_skills) * 1.5, 10)

        final_score = round(min(semantic_component + evidence_component + skill_component, 100))

        if final_score >= 75:
            match_level = "Strong Match"
        elif final_score >= 60:
            match_level = "Good Match"
        elif final_score >= 40:
            match_level = "Moderate Match"
        else:
            match_level = "Weak Match"

        top_chunks = [c["text"] for c in resume_chunks[:3]]

        explanation = (
            f"The resume shows a semantic match score of {best_score:.2f} on the strongest retrieved chunk "
            f"and {avg_score:.2f} on average across the top results. "
            f"Relevant evidence was found in the resume content, and {len(found_skills)} recognizable skills were detected."
        )

        strengths = []
        if found_skills:
            strengths.append(f"Detected skills include: {', '.join(found_skills[:5])}")
        if top_chunks:
            strengths.append("Relevant resume sections were retrieved successfully.")

        gaps = []
        if missing:
            gaps.extend([f"Missing or unclear requirement: {skill}" for skill in missing[:5]])
        if not gaps:
            gaps.append("No major missing requirements were detected from the query text.")

        return {
            "score": final_score,
            "match_level": match_level,
            "skills": found_skills,
            "missing_skills": missing,
            "explanation": explanation,
            "strengths": strengths,
            "gaps": gaps,
            "retrieved_chunks": top_chunks,
            "confidence": round(best_score, 3)
        }

    @staticmethod
    def evaluate_resume_rag(job_query: str, resume_chunks: List[Dict[str, Any]], raw_text: str = "") -> Dict[str, Any]:
        logger.info(
            "evaluate_resume_rag called | chunks=%d | gemini=%s",
            len(resume_chunks),
            bool(os.getenv("GEMINI_API_KEY"))
        )

        cleaned_text = clean_text(raw_text)
        if not cleaned_text:
            return {
                "score": 0,
                "match_level": "Weak Match",
                "skills": [],
                "missing_skills": [],
                "explanation": "No readable text could be extracted from this resume.",
                "strengths": [],
                "gaps": ["Text extraction returned empty content."],
                "retrieved_chunks": [],
                "confidence": 0.0
            }

        context_list = [c["text"] for c in resume_chunks]
        context = "\n\n---\n\n".join(context_list)
        confidence = max([c.get("score", 0.0) for c in resume_chunks], default=0.0)

        api_key = os.getenv("GEMINI_API_KEY")
        if api_key and api_key.strip() and api_key != "your_gemini_api_key_here" and context_list:
            try:
                from google import genai
                from pydantic import BaseModel

                class RAGResult(BaseModel):
                    score: int
                    match_level: str
                    skills_found: List[str]
                    missing_skills: List[str]
                    explanation: str
                    strengths: List[str]
                    gaps: List[str]

                client = genai.Client(api_key=api_key)

                system_instruction = (
                    "You are a Senior Technical Recruiter evaluating a candidate for a job role. "
                    "Use ONLY the provided resume context fragments. "
                    "Do not assume or invent any missing details. "
                    "Be objective, concise, and evidence-based. "
                    "Return strict JSON only."
                )

                prompt = f"""
Job Requirement:
{job_query}

Resume Context Fragments:
{context}

Return JSON with exactly these fields:
{{
  "score": <integer from 0 to 100>,
  "match_level": "<Strong Match | Good Match | Moderate Match | Weak Match>",
  "skills_found": [<list>],
  "missing_skills": [<list>],
  "explanation": "<2 to 3 sentence explanation>",
  "strengths": [<list>],
  "gaps": [<list>]
}}

Rules:
1. Use ONLY the provided resume context.
2. Do not infer missing qualifications.
3. If evidence is weak, lower the score.
4. Keep it concise and evidence-based.
5. Output JSON only.
"""

                response = client.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=prompt,
                    config={
                        "system_instruction": system_instruction,
                        "response_mime_type": "application/json",
                        "response_schema": RAGResult,
                        "temperature": 0.1,
                    },
                )

                res = json.loads(response.text)

                return {
                    "score": res.get("score", 0),
                    "match_level": res.get("match_level", "Weak Match"),
                    "skills": res.get("skills_found", []),
                    "missing_skills": res.get("missing_skills", []),
                    "explanation": res.get("explanation", "No explanation provided."),
                    "strengths": res.get("strengths", []),
                    "gaps": res.get("gaps", []),
                    "retrieved_chunks": context_list[:3],
                    "confidence": round(confidence, 3)
                }

            except Exception as e:
                logger.exception("Gemini evaluation failed, falling back to semantic scorer: %s", e)

        return NLPService._semantic_fallback_score(job_query, resume_chunks, cleaned_text)