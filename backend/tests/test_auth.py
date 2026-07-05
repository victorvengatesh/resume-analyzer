"""
Tests for authentication endpoints: register, login, refresh, logout,
/me, change-password, and RBAC enforcement.
"""
import pytest


# ── Registration ─────────────────────────────────────────────────

class TestRegistration:
    def test_register_success(self, client):
        r = client.post(
            "/api/v1/auth/register",
            json={"email": "new_user@example.com", "password": "Password1!", "role_name": "Recruiter"},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["email"] == "new_user@example.com"
        assert body["role"] == "Recruiter"
        assert body["is_active"] is True

    def test_register_duplicate_email(self, client):
        payload = {"email": "dup@example.com", "password": "Password1!", "role_name": "Viewer"}
        client.post("/api/v1/auth/register", json=payload)
        r = client.post("/api/v1/auth/register", json=payload)
        assert r.status_code == 400
        assert "already registered" in r.json()["detail"].lower()

    def test_register_invalid_role(self, client):
        r = client.post(
            "/api/v1/auth/register",
            json={"email": "badrole@example.com", "password": "Password1!", "role_name": "SuperAdmin"},
        )
        assert r.status_code == 422  # validator rejects invalid role_name

    def test_register_weak_password(self, client):
        r = client.post(
            "/api/v1/auth/register",
            json={"email": "weakpw@example.com", "password": "abc", "role_name": "Viewer"},
        )
        assert r.status_code == 422


# ── Login / Token ─────────────────────────────────────────────────

class TestLogin:
    def test_login_success(self, client, recruiter_tokens):
        assert "access_token" in recruiter_tokens
        assert "refresh_token" in recruiter_tokens
        assert recruiter_tokens["token_type"] == "bearer"

    def test_login_wrong_password(self, client):
        client.post(
            "/api/v1/auth/register",
            json={"email": "pwtest@example.com", "password": "Password1!", "role_name": "Viewer"},
        )
        r = client.post(
            "/api/v1/auth/login",
            json={"email": "pwtest@example.com", "password": "WrongPassword1!"},
        )
        assert r.status_code == 401

    def test_login_nonexistent_user(self, client):
        r = client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "Password1!"},
        )
        assert r.status_code == 401


# ── Token Lifecycle ──────────────────────────────────────────────

class TestTokens:
    def test_get_me(self, client, recruiter_tokens):
        r = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {recruiter_tokens['access_token']}"},
        )
        assert r.status_code == 200
        assert r.json()["role"] == "Recruiter"

    def test_get_me_invalid_token(self, client):
        r = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer totally.invalid.token"},
        )
        assert r.status_code == 401

    def test_refresh(self, client, recruiter_tokens):
        r = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": recruiter_tokens["refresh_token"]},
        )
        assert r.status_code == 200
        new_tokens = r.json()
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert new_tokens["token_type"] == "bearer"

    def test_refresh_with_access_token_fails(self, client, recruiter_tokens):
        """Passing an access token where a refresh token is expected must fail."""
        r = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": recruiter_tokens["access_token"]},
        )
        assert r.status_code == 401

    def test_logout(self, client, recruiter_tokens):
        r = client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {recruiter_tokens['access_token']}"},
        )
        assert r.status_code == 200
        assert "logged out" in r.json()["message"].lower()


# ── Password Change ──────────────────────────────────────────────

class TestPasswordChange:
    def test_change_password_success(self, client):
        client.post(
            "/api/v1/auth/register",
            json={"email": "changepw@example.com", "password": "OldPass1!", "role_name": "Viewer"},
        )
        tokens = client.post(
            "/api/v1/auth/login",
            json={"email": "changepw@example.com", "password": "OldPass1!"},
        ).json()
        r = client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            json={"current_password": "OldPass1!", "new_password": "NewPass2@"},
        )
        assert r.status_code == 200

    def test_change_password_wrong_current(self, client):
        client.post(
            "/api/v1/auth/register",
            json={"email": "changepw2@example.com", "password": "OldPass1!", "role_name": "Viewer"},
        )
        tokens = client.post(
            "/api/v1/auth/login",
            json={"email": "changepw2@example.com", "password": "OldPass1!"},
        ).json()
        r = client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            json={"current_password": "WrongOld1!", "new_password": "NewPass2@"},
        )
        assert r.status_code == 400


# ── RBAC ─────────────────────────────────────────────────────────

class TestRBAC:
    def test_viewer_cannot_add_notes(self, client, viewer_tokens):
        r = client.post(
            "/api/v1/resumes/nonexistent-id/notes",
            headers={"Authorization": f"Bearer {viewer_tokens['access_token']}"},
            json={"text": "should be forbidden"},
        )
        assert r.status_code == 403

    def test_admin_can_reach_status_update_route(self, client, admin_tokens):
        """Admin reaches the route; 404 means RBAC passed, the resume just doesn't exist."""
        r = client.patch(
            "/api/v1/resumes/nonexistent-id/status?status=Shortlisted",
            headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
        )
        assert r.status_code == 404  # auth passed, resource not found

    def test_unauthenticated_is_rejected(self, client):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401

    def test_forgot_password_no_enumeration(self, client):
        """Regardless of whether the email exists, the response is the same."""
        r1 = client.post("/api/v1/auth/forgot-password?email=exists@example.com")
        r2 = client.post("/api/v1/auth/forgot-password?email=doesnotexist@example.com")
        assert r1.status_code == r2.status_code == 200
