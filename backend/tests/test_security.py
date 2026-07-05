"""
Tests for security utilities: password hashing, JWT tokens,
password-strength validation, rate limiter.
"""
import time
import pytest
from backend.services.auth_service import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    validate_password_strength,
)
from backend.core.security import TokenBucketLimiter


# ── Password Hashing ─────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_and_verify(self):
        # Keep passwords well under 72 bytes (bcrypt hard limit)
        hashed = get_password_hash("MySecret1!")
        assert verify_password("MySecret1!", hashed)
        assert not verify_password("WrongPass1!", hashed)

    def test_different_passwords_produce_different_hashes(self):
        h1 = get_password_hash("Alpha1!")
        h2 = get_password_hash("Beta2@")
        assert h1 != h2


# ── Password Strength ────────────────────────────────────────────

class TestPasswordStrength:
    def test_valid_password(self):
        assert validate_password_strength("Password1!") is None

    def test_too_short(self):
        err = validate_password_strength("Ab1!")
        assert err is not None
        assert "8" in err

    def test_no_digits(self):
        err = validate_password_strength("NoDigitsHere!")
        assert err is not None

    def test_no_letters(self):
        err = validate_password_strength("12345678")
        assert err is not None

    def test_exactly_8_chars(self):
        assert validate_password_strength("Abcde1!x") is None


# ── JWT Tokens ────────────────────────────────────────────────────

class TestJWT:
    def test_access_token_round_trip(self):
        data = {"email": "test@example.com", "user_id": "abc123", "role": "Recruiter"}
        token = create_access_token(data)
        payload = verify_token(token, expected_type="access")
        assert payload is not None
        assert payload["email"] == "test@example.com"
        assert payload["role"] == "Recruiter"

    def test_refresh_token_round_trip(self):
        data = {"email": "test@example.com", "user_id": "abc123", "role": "Recruiter"}
        token = create_refresh_token(data)
        payload = verify_token(token, expected_type="refresh")
        assert payload is not None
        assert payload["user_id"] == "abc123"

    def test_wrong_type_rejected(self):
        data = {"email": "test@example.com", "user_id": "abc123", "role": "Recruiter"}
        access = create_access_token(data)
        # Should reject access token when refresh is expected
        assert verify_token(access, expected_type="refresh") is None

    def test_invalid_token_returns_none(self):
        assert verify_token("this.is.not.valid", expected_type="access") is None

    def test_tampered_token_returns_none(self):
        data = {"email": "test@example.com", "user_id": "abc123", "role": "Recruiter"}
        token = create_access_token(data)
        tampered = token[:-5] + "XXXXX"
        assert verify_token(tampered, expected_type="access") is None


# ── Rate Limiter ──────────────────────────────────────────────────

class TestTokenBucketLimiter:
    def test_allows_within_capacity(self):
        limiter = TokenBucketLimiter(rate=0, capacity=5)  # rate=0: no refill during test
        from backend.core import config as cfg
        original = cfg.settings.enable_usage_limits
        cfg.settings.enable_usage_limits = True
        try:
            # First call seeds bucket at capacity-1=4 then consumes 1 → 3 remaining
            # Calls 2-5 each consume 1 token: 3→2→1→0
            # All 5 calls should be allowed (capacity=5 means 5 requests allowed)
            results = [limiter.is_allowed("127.0.0.1") for _ in range(5)]
            assert all(results), f"Expected all True but got: {results}"
        finally:
            cfg.settings.enable_usage_limits = original

    def test_blocks_when_exceeded(self):
        limiter = TokenBucketLimiter(rate=0, capacity=2)  # rate=0: no refill
        from backend.core import config as cfg
        original = cfg.settings.enable_usage_limits
        cfg.settings.enable_usage_limits = True
        try:
            # First call: bucket initialises to (capacity-1), allowed
            assert limiter.is_allowed("10.0.0.2") is True
            # Second call: 1 token left -> allowed, bucket now empty
            assert limiter.is_allowed("10.0.0.2") is True
            # Third call: 0 tokens -> blocked
            assert limiter.is_allowed("10.0.0.2") is False
        finally:
            cfg.settings.enable_usage_limits = original

    def test_disabled_always_allows(self):
        limiter = TokenBucketLimiter(rate=0.001, capacity=1)
        from backend.core import config as cfg
        original = cfg.settings.enable_usage_limits
        cfg.settings.enable_usage_limits = False
        try:
            for _ in range(20):
                assert limiter.is_allowed("192.168.1.1") is True
        finally:
            cfg.settings.enable_usage_limits = original
