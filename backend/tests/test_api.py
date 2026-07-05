"""
API integration tests for resume endpoints, batch endpoints,
analytics, exports, and health check.
Uses auth-disabled client (open-access mode) for simplicity.
"""
import io
import pytest


# ── Health ────────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self, client_no_auth):
        r = client_no_auth.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] in ("ok", "degraded")
        assert "time" in body

    def test_root(self, client_no_auth):
        r = client_no_auth.get("/")
        assert r.status_code == 200
        body = r.json()
        assert "name" in body
        assert "docs" in body


# ── Candidates / Resumes list ─────────────────────────────────────

class TestCandidateList:
    def test_list_resumes_empty(self, client_no_auth):
        r = client_no_auth.get("/api/v1/resumes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_resumes_pagination_defaults(self, client_no_auth):
        r = client_no_auth.get("/api/v1/resumes?limit=10&offset=0")
        assert r.status_code == 200

    def test_list_resumes_invalid_limit_rejected(self, client_no_auth):
        # limit > 200 should be rejected by FastAPI query validation
        r = client_no_auth.get("/api/v1/resumes?limit=500")
        assert r.status_code == 422

    def test_get_nonexistent_resume_404(self, client_no_auth):
        r = client_no_auth.get("/api/v1/resumes/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404


# ── Analytics ─────────────────────────────────────────────────────

class TestAnalytics:
    def test_dashboard_returns_expected_keys(self, client_no_auth):
        r = client_no_auth.get("/api/v1/analytics/dashboard")
        assert r.status_code == 200
        body = r.json()
        for key in ["total_resumes", "average_score", "top_skills", "match_level_distribution"]:
            assert key in body, f"Missing key: {key}"

    def test_dashboard_zeros_when_empty(self, client_no_auth):
        r = client_no_auth.get("/api/v1/analytics/dashboard")
        assert r.status_code == 200
        body = r.json()
        assert body["total_resumes"] >= 0


# ── Exports ───────────────────────────────────────────────────────

class TestExports:
    def test_csv_export(self, client_no_auth):
        r = client_no_auth.get("/api/v1/exports/candidates/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")


# ── Batch Jobs ────────────────────────────────────────────────────

class TestBatchJobs:
    def test_list_batches_empty(self, client_no_auth):
        r = client_no_auth.get("/api/v1/batch/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_nonexistent_batch_404(self, client_no_auth):
        r = client_no_auth.get("/api/v1/batch/nonexistent-batch-id/status")
        assert r.status_code == 404

    def test_batch_analyze_no_files_400(self, client_no_auth):
        """Submitting empty file list should return 400."""
        r = client_no_auth.post(
            "/api/v1/batch/analyze",
            data={"job_description": "Python Developer"},
        )
        # FastAPI 422 (missing 'files' field) or 400 (no valid files)
        assert r.status_code in (400, 422)


# ── Interview ─────────────────────────────────────────────────────

class TestInterview:
    def test_get_kit_nonexistent_candidate(self, client_no_auth):
        r = client_no_auth.get("/api/v1/interview/nonexistent-id/kit")
        assert r.status_code == 404

    def test_generate_kit_nonexistent_candidate(self, client_no_auth):
        r = client_no_auth.post("/api/v1/interview/nonexistent-id/generate")
        assert r.status_code == 404

    def test_list_sessions_nonexistent_candidate(self, client_no_auth):
        r = client_no_auth.get("/api/v1/interview/nonexistent-id/sessions")
        assert r.status_code == 200
        assert r.json() == []


# ── Security Headers ──────────────────────────────────────────────

class TestSecurityHeaders:
    def test_security_headers_present(self, client_no_auth):
        r = client_no_auth.get("/health")
        assert r.status_code == 200
        headers = r.headers
        assert headers.get("x-content-type-options") == "nosniff"
        assert headers.get("x-frame-options") == "DENY"
