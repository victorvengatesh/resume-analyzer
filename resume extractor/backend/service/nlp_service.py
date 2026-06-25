import os
import re
import json
import logging
from typing import List, Dict, Any

logger = logging.getLogger("resume_analyzer.nlp_service")

# ---------------------------------------------------------------------------
# Common skills / regex helpers (unchanged from original)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# EndeeIndex — Gemini-powered semantic search (no torch / numpy / embeddings)
# ---------------------------------------------------------------------------
class EndeeIndex:
    """
    Lightweight in-memory semantic index for resume chunks.
    Uses Gemini to rank chunks against a query instead of local embeddings.
    """

    def __init__(self, embedder=None):
        # embedder parameter kept for API compatibility — ignored
        self.chunks: List[str] = []

    def add_documents(self, text_chunks: List[str]) -> None:
        if not text_chunks:
            logger.warning("No chunks provided to add_documents.")
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

        self.chunks.extend(deduped)
        logger.info("Indexed %d cleaned chunks (text-only, no embeddings).", len(deduped))

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Rank stored chunks against the query using Gemini.
        Falls back to simple keyword overlap scoring if Gemini is unavailable.
        """
        if not query or not self.chunks:
            logger.warning("Search skipped: query or chunks missing.")
            return []

        query = clean_text(query)
        if not query:
            return []

        # --- Try Gemini-powered ranking ---
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key and api_key.strip() and api_key != "your_gemini_api_key_here":
            try:
                return self._gemini_rank(query, top_k, api_key)
            except Exception as e:
                logger.warning("Gemini chunk-ranking failed, using keyword fallback: %s", e)

        # --- Keyword overlap fallback ---
        return self._keyword_rank(query, top_k)

    # ---- private helpers ----

    def _gemini_rank(self, query: str, top_k: int, api_key: str) -> List[Dict[str, Any]]:
        from google import genai

        numbered = "\n".join(
            f"[{i}] {chunk[:500]}" for i, chunk in enumerate(self.chunks)
        )

        prompt = f"""You are a resume-ranking assistant.

Job query: {query}

Resume chunks (numbered):
{numbered}

Return a JSON array of the top {top_k} most relevant chunk numbers, each with a relevance score from 0.0 to 1.0.
Format: [{{"index": 0, "score": 0.85}}, ...]
Only return the JSON array, nothing else."""

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0.0,
            },
        )

        ranked = json.loads(response.text)

        results = []
        for item in ranked[:top_k]:
            idx = int(item.get("index", 0))
            score = float(item.get("score", 0.0))
            if 0 <= idx < len(self.chunks):
                results.append({
                    "text": self.chunks[idx],
                    "score": round(min(max(score, 0.0), 1.0), 4),
                })

        if results:
            logger.info(
                "Gemini ranked %d chunks | best score=%.4f",
                len(results),
                results[0]["score"],
            )
        return results

    def _keyword_rank(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """Simple keyword-overlap fallback when Gemini is unavailable."""
        query_words = set(clean_text(query).lower().split())
        scored = []
        for chunk in self.chunks:
            chunk_words = set(chunk.lower().split())
            overlap = len(query_words & chunk_words)
            total = len(query_words) if query_words else 1
            score = round(overlap / total, 4)
            scored.append({"text": chunk, "score": score})

        scored.sort(key=lambda x: x["score"], reverse=True)
        results = scored[:top_k]

        if results:
            logger.info(
                "Keyword-ranked %d chunks | best score=%.4f",
                len(results),
                results[0]["score"],
            )
        return results


# ---------------------------------------------------------------------------
# NLPService — all Gemini, zero torch
# ---------------------------------------------------------------------------
class NLPService:

    @classmethod
    def get_embedder(cls):
        """
        Kept for API compatibility with main.py.
        Returns None — embeddings are no longer used.
        """
        return None

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
        """
        Pure-Python text chunking — no langchain dependency needed.
        Splits on paragraph breaks, then sentences, then by character limit.
        """
        text = clean_text(text)
        if not text:
            logger.warning("chunk_document received empty text.")
            return []

        # Split on double-newlines first, then single newlines
        paragraphs = re.split(r"\n{2,}", text)
        raw_segments: List[str] = []
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(para) <= chunk_size:
                raw_segments.append(para)
            else:
                # Split long paragraphs by sentences
                sentences = re.split(r"(?<=[.!?;])\s+", para)
                current = ""
                for sent in sentences:
                    if len(current) + len(sent) + 1 <= chunk_size:
                        current = (current + " " + sent).strip()
                    else:
                        if current:
                            raw_segments.append(current)
                        current = sent
                if current:
                    raw_segments.append(current)

        # Merge small segments and enforce chunk_size with overlap
        chunks: List[str] = []
        buffer = ""
        for seg in raw_segments:
            if len(buffer) + len(seg) + 1 <= chunk_size:
                buffer = (buffer + " " + seg).strip()
            else:
                if buffer:
                    chunks.append(buffer)
                # Carry overlap from end of previous buffer
                if chunk_overlap > 0 and buffer:
                    overlap_text = buffer[-chunk_overlap:]
                    buffer = (overlap_text + " " + seg).strip()
                else:
                    buffer = seg
        if buffer:
            chunks.append(buffer)

        # Deduplicate and filter tiny chunks
        cleaned_chunks: List[str] = []
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

        # Scoring: weighted combination of semantic + evidence + skills
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