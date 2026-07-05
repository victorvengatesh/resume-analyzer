import os
import sys
import logging
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("resume_analyzer.config")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    database_url: str = "sqlite:///./resume_ai.db"
    upload_dir: str = "./uploads"
    role_skills_file: str = "./role_skills.json"
    use_ocr: bool = False
    max_file_bytes: int = 10 * 1024 * 1024
    frontend_url: Optional[str] = None
    app_name: str = "Resume Analyzer"
    app_mode: str = "demo"
    app_version: str = "1.0.0"
    enable_auth: bool = False
    enable_usage_limits: bool = False
    enable_analytics: bool = False
    gemini_api_key: Optional[str] = None
    max_workers: int = 10

    # Auth settings
    secret_key: str = "supersecretkeychangeinproduction"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7


settings = Settings()

# Warn loudly if running in production with the default secret key
if settings.app_mode == "production" and settings.secret_key == "supersecretkeychangeinproduction":
    logger.critical(
        "SECURITY WARNING: SECRET_KEY is set to the default insecure value in production mode. "
        "Set a strong SECRET_KEY environment variable immediately."
    )
    print(
        "\n\033[91m[CRITICAL SECURITY] SECRET_KEY is the default value in production mode! "
        "Set SECRET_KEY environment variable.\033[0m\n",
        file=sys.stderr,
    )


def ensure_upload_dir(path: Optional[str] = None) -> Path:
    target = Path(path or settings.upload_dir)
    target.mkdir(parents=True, exist_ok=True)
    return target
