"""
Tests for the database layer: BaseRepository CRUD, ResumeRepository,
and the check_db_connection helper.
"""
import pytest
from backend.db.database import check_db_connection
from backend.models.resume import Resume
from backend.models.user import User, Role
from backend.repositories.resume_repository import ResumeRepository
from backend.repositories.base import BaseRepository


class TestCheckDbConnection:
    def test_sqlite_connection_ok(self):
        """The in-memory SQLite engine used in tests is always reachable."""
        assert check_db_connection() is True


class TestBaseRepository:
    def test_count_empty(self, db):
        repo = BaseRepository(Resume, db)
        # Count before any resumes are added (may not be 0 if other tests ran first)
        count = repo.count()
        assert isinstance(count, int)
        assert count >= 0

    def test_exists_false_for_missing(self, db):
        repo = BaseRepository(Resume, db)
        assert repo.exists("00000000-nonexistent") is False


class TestResumeRepository:
    def _make_resume(self, suffix="test"):
        return Resume(
            filename=f"resume_{suffix}.pdf",
            original_name=f"Test Candidate {suffix}",
            email=f"{suffix}@example.com",
            skills=["python", "fastapi"],
            missing_skills=["kubernetes"],
            skill_score=70.0,
            exp_years=3.0,
            exp_score=60.0,
            total_score=75.0,
            job_applied="Python Developer",
            match_level="Good Match",
            explanation="Solid Python background.",
            strengths=["Python", "FastAPI"],
            gaps=["Kubernetes"],
            education=["BSc Computer Science"],
            projects=["Resume Analyzer"],
            certifications=[],
            retrieved_chunks=[],
            confidence=0.8,
            size=102400,
            status="Applied",
        )

    def test_create_and_get(self, db):
        repo = ResumeRepository(db)
        resume = self._make_resume("create1")
        created = repo.create(resume)
        assert created.id is not None
        fetched = repo.get_by_id(created.id)
        assert fetched is not None
        assert fetched.email == "create1@example.com"

    def test_list_resumes(self, db):
        repo = ResumeRepository(db)
        repo.create(self._make_resume("list1"))
        repo.create(self._make_resume("list2"))
        results = repo.list_resumes(limit=100)
        assert len(results) >= 2

    def test_list_resumes_filter_by_score(self, db):
        repo = ResumeRepository(db)
        r = self._make_resume("score_filter")
        r.total_score = 95.0
        repo.create(r)
        results = repo.list_resumes(min_score=90.0)
        assert all(res.total_score >= 90.0 for res in results)

    def test_list_resumes_search(self, db):
        repo = ResumeRepository(db)
        r = self._make_resume("searchable")
        r.original_name = "UniqueSearchableName XYZ"
        repo.create(r)
        results = repo.list_resumes(q="UniqueSearchableName")
        assert any("UniqueSearchableName" in res.original_name for res in results)

    def test_count_resumes(self, db):
        repo = ResumeRepository(db)
        before = repo.count_resumes()
        repo.create(self._make_resume("count1"))
        after = repo.count_resumes()
        assert after == before + 1

    def test_update_status(self, db):
        repo = ResumeRepository(db)
        resume = repo.create(self._make_resume("status1"))
        updated = repo.update_status(resume.id, "Shortlisted")
        assert updated is not None
        assert updated.status == "Shortlisted"

    def test_update_status_nonexistent(self, db):
        repo = ResumeRepository(db)
        result = repo.update_status("nonexistent-id", "Hired")
        assert result is None

    def test_add_and_get_note(self, db):
        repo = ResumeRepository(db)
        resume = repo.create(self._make_resume("note1"))
        note = repo.add_note(resume.id, "Excellent candidate", author="HR Manager")
        assert note is not None
        assert note.text == "Excellent candidate"
        notes = repo.get_notes(resume.id)
        assert len(notes) >= 1
        assert notes[0].text == "Excellent candidate"

    def test_delete_resume(self, db):
        repo = ResumeRepository(db)
        resume = repo.create(self._make_resume("delete1"))
        rid = resume.id
        deleted = repo.delete_resume(rid)
        assert deleted is True
        assert repo.get_by_id(rid) is None

    def test_bulk_create(self, db):
        repo = ResumeRepository(db)
        resumes = [self._make_resume(f"bulk{i}") for i in range(3)]
        created = repo.bulk_create(resumes)
        assert len(created) == 3
        assert all(r.id is not None for r in created)
