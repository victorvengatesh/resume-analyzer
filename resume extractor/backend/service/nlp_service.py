import os
import re
import json
import logging
from typing import List, Dict, Any

logger = logging.getLogger("resume_analyzer.nlp_service")

# ---------------------------------------------------------------------------
# Common skills / regex helpers
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

    def add_documents(self, chunks: List[str]) -> None:
        if not chunks:
            logger.warning("No chunks provided to add_documents.")
            return

        deduped = []
        seen = set()
        for chunk in chunks:
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
        logger.info("Indexed %d cleaned chunks.", len(deduped))

    def search(self, query: str, top_k: int = 3) -> List[str]:
        """
        Rank stored chunks against the query using Gemini.
        Falls back to simple keyword overlap scoring if Gemini is unavailable.
        Returns a list of top_k most relevant chunks.
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

    def _gemini_rank(self, query: str, top_k: int, api_key: str) -> List[str]:
        from google import genai

        numbered = "\n".join(
            f"[{i}] {chunk[:500]}" for i, chunk in enumerate(self.chunks)
        )

        prompt = f"""You are a resume-ranking assistant.

Job query: {query}

Resume chunks (numbered):
{numbered}

Return a JSON array of the top {top_k} most relevant chunk numbers.
Format: [0, 2, 1]
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

        try:
            ranked = json.loads(response.text)
            results = []
            if isinstance(ranked, list):
                for item in ranked:
                    if isinstance(item, dict):
                        idx = item.get("index")
                    else:
                        idx = item
                    try:
                        idx = int(idx)
                        if 0 <= idx < len(self.chunks):
                            results.append(self.chunks[idx])
                    except (ValueError, TypeError):
                        continue
            return results[:top_k]
        except Exception as e:
            logger.warning("Failed to parse Gemini ranking response: %s. Response text: %s", e, response.text)
            raise e

    def _keyword_rank(self, query: str, top_k: int) -> List[str]:
        """Simple keyword-overlap fallback when Gemini is unavailable."""
        query_words = set(clean_text(query).lower().split())
        scored = []
        for chunk in self.chunks:
            chunk_words = set(chunk.lower().split())
            overlap = len(query_words & chunk_words)
            total = len(query_words) if query_words else 1
            score = overlap / total
            scored.append((chunk, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [chunk for chunk, score in scored[:top_k]]


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
    def chunk_document(text: str) -> List[str]:
        """
        Splits text every 700 chars on sentence boundaries using simple Python only.
        """
        text = clean_text(text)
        if not text:
            return []

        # Simple sentence boundary splitting using regex (simple Python)
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks = []
        current_chunk = []
        current_length = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            # If a single sentence is longer than 700 chars, split it by character slices
            if len(sentence) > 700:
                if current_chunk:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = []
                    current_length = 0
                for i in range(0, len(sentence), 700):
                    chunks.append(sentence[i:i+700])
                continue

            if current_length + len(sentence) + (1 if current_chunk else 0) <= 700:
                current_chunk.append(sentence)
                current_length += len(sentence) + (1 if current_chunk else 0)
            else:
                chunks.append(" ".join(current_chunk))
                current_chunk = [sentence]
                current_length = len(sentence)

        if current_chunk:
            chunks.append(" ".join(current_chunk))

        return chunks

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
    def _semantic_fallback_score(job_query: str, resume_chunks: List[Any], raw_text: str = "") -> Dict[str, Any]:
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

        # Handle both list of dicts and list of strings
        context_list = []
        scores = []
        query_words = set(clean_text(job_query).lower().split())
        for c in resume_chunks:
            if isinstance(c, dict):
                context_list.append(c.get("text", ""))
                scores.append(float(c.get("score", 0.0)))
            else:
                context_list.append(c)
                # Compute simple keyword score
                chunk_words = set(c.lower().split())
                overlap = len(query_words & chunk_words)
                total = len(query_words) if query_words else 1
                scores.append(overlap / total)

        if not context_list:
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

        top_chunks = context_list[:3]

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
    def evaluate_resume_rag(query: str, chunks: List[Any], raw_text: str = "") -> Dict[str, Any]:
        logger.info(
            "evaluate_resume_rag called | chunks=%d | gemini=%s",
            len(chunks),
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

        # Handle both list of dicts and list of strings
        context_list = []
        scores = []
        for c in chunks:
            if isinstance(c, dict):
                context_list.append(c.get("text", ""))
                scores.append(float(c.get("score", 0.0)))
            else:
                context_list.append(c)
                scores.append(0.0)

        context = "\n\n---\n\n".join(context_list)
        confidence = max(scores, default=0.0)

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
{query}

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

        return NLPService._semantic_fallback_score(query, chunks, cleaned_text)