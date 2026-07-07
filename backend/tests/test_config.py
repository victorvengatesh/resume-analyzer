"""
Tests for Settings configuration loading and defaults.
"""
import importlib
import os
import pytest


def reload_settings():
    module = importlib.import_module("backend.core.config")
    importlib.reload(module)
    return module.settings


def test_defaults(monkeypatch):
    """All env vars cleared → defaults should apply."""
    for key in [
        "DATABASE_URL", "UPLOAD_DIR", "ROLE_SKILLS_FILE", "USE_OCR",
        "MAX_FILE_BYTES", "FRONTEND_URL", "APP_NAME", "APP_MODE",
        "APP_VERSION", "ENABLE_AUTH", "ENABLE_USAGE_LIMITS",
        "ENABLE_ANALYTICS", "SECRET_KEY", "GEMINI_API_KEY",
    ]:
        monkeypatch.delenv(key, raising=False)

    # Ensure .env values don't bleed in by overriding Optional fields to empty.
    # Settings._coerce_empty_optionals will convert "" → None.
    monkeypatch.setenv("FRONTEND_URL", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")

    s = reload_settings()
    assert s.database_url == "sqlite:///./resume_ai.db"
    assert s.upload_dir == "./uploads"
    assert s.use_ocr is False
    assert s.max_file_bytes == 10 * 1024 * 1024
    assert s.frontend_url is None
    assert s.app_name == "Resume Analyzer"
    assert s.app_mode == "demo"
    assert s.enable_auth is False
    assert s.enable_usage_limits is False
    assert s.access_token_expire_minutes == 30
    assert s.refresh_token_expire_days == 7


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost/testdb")
    monkeypatch.setenv("APP_MODE", "production")
    monkeypatch.setenv("ENABLE_AUTH", "true")
    monkeypatch.setenv("MAX_FILE_BYTES", "5242880")
    monkeypatch.setenv("SECRET_KEY", "a-real-secret-key-thats-long-enough")

    s = reload_settings()
    assert s.database_url == "postgresql://user:pass@localhost/testdb"
    assert s.app_mode == "production"
    assert s.enable_auth is True
    assert s.max_file_bytes == 5242880
    assert s.secret_key == "a-real-secret-key-thats-long-enough"


def test_algorithm_default(monkeypatch):
    monkeypatch.delenv("ALGORITHM", raising=False)
    s = reload_settings()
    assert s.algorithm == "HS256"
