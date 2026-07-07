"""
core/security.py
────────────────
Rate limiting, MIME/magic-byte file validation, and security-header middleware.
"""
import re
import time
import logging
import threading
from typing import Dict, Tuple

from fastapi import Request, HTTPException, Response, status, UploadFile
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core import config as config_module

logger = logging.getLogger("resume_analyzer.security")

# ─────────────────────────────────────────────────────────────────
# Rate Limiting — thread-safe Token Bucket (per IP)
# ─────────────────────────────────────────────────────────────────
# NOTE: This implementation is in-process only.
# For multi-worker production deployments, replace with Redis-backed
# rate limiting (e.g. slowapi + redis) or a reverse-proxy (nginx).

class TokenBucketLimiter:
    """Thread-safe token-bucket rate limiter keyed by client IP."""

    def __init__(self, rate: float, capacity: float):
        self.rate = rate          # tokens restored per second
        self.capacity = capacity  # max burst size
        self._buckets: Dict[str, Tuple[float, float]] = {}
        self._lock = threading.Lock()

    def is_allowed(self, ip: str) -> bool:
        if not config_module.settings.enable_usage_limits:
            return True

        now = time.monotonic()
        with self._lock:
            if ip not in self._buckets:
                self._buckets[ip] = (self.capacity - 1.0, now)
                return True

            tokens, last = self._buckets[ip]
            refill = (now - last) * self.rate
            tokens = min(self.capacity, tokens + refill)

            if tokens >= 1.0:
                self._buckets[ip] = (tokens - 1.0, now)
                return True
            self._buckets[ip] = (tokens, now)
            return False

    def reset(self, ip: str) -> None:
        """Remove a specific IP bucket (for testing)."""
        with self._lock:
            self._buckets.pop(ip, None)


# Limit: 5 req/s sustained, burst of 20 — generous for file uploads
rate_limiter = TokenBucketLimiter(rate=5, capacity=20)


def rate_limit_dependency(request: Request) -> None:
    """FastAPI dependency — raises 429 when the caller's bucket is empty."""
    ip = request.client.host if request.client else "unknown"
    if not rate_limiter.is_allowed(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down.",
            headers={"Retry-After": "1"},
        )


# ─────────────────────────────────────────────────────────────────
# Secure File Validation
# ─────────────────────────────────────────────────────────────────

# Magic-byte signatures for each supported extension
_MAGIC: Dict[str, list] = {
    ".pdf":  [b"%PDF"],
    ".docx": [b"PK\x03\x04"],                          # ZIP-based OOXML
    ".doc":  [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],   # OLE2 compound
    ".txt":  [],   # No binary signature; validated by UTF-8 decode
    ".md":   [],
}

# Filename safety: allow only alphanumeric, dash, underscore, dot, space
_SAFE_FILENAME_RE = re.compile(r"^[\w\s.\-]+$")


def _safe_filename(name: str) -> bool:
    return bool(_SAFE_FILENAME_RE.match(name)) and ".." not in name


async def secure_file_validation(file: UploadFile) -> bytes:
    """
    1. Validate filename for path traversal.
    2. Check magic bytes against the declared extension.
    3. Enforce max file size.
    Returns full file bytes on success; raises HTTPException on failure.
    """
    raw_name = file.filename or ""
    safe_name = raw_name.lower()

    # 1. Filename safety
    if not _safe_filename(raw_name):
        logger.warning("Unsafe filename rejected: %s", raw_name)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename contains invalid characters.",
        )

    # 2. Extension check
    ext = ""
    for candidate in _MAGIC:
        if safe_name.endswith(candidate):
            ext = candidate
            break
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed: PDF, DOCX, DOC, TXT.",
        )

    # 3. Read the ENTIRE file once into memory, then slice for magic-byte check.
    #    Reading head separately and then calling read() again would return
    #    bytes AFTER position 2048 — concatenating both would duplicate the
    #    first 2 KB and corrupt PDFs (broken offset table) and DOCX files
    #    (broken ZIP local-file-header offsets).
    content = await file.read()
    await file.seek(0)  # leave the file pointer in a clean state

    head = content[:2048]  # slice — no extra I/O, no duplication

    signatures = _MAGIC[ext]
    if signatures:
        if not any(head.startswith(sig) for sig in signatures):
            logger.warning("Magic-byte mismatch for '%s' (ext=%s)", raw_name, ext)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File content does not match its extension ({ext}). Possible spoofed file.",
            )
    else:
        # Text files: must be UTF-8 decodable
        try:
            head.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text file is not valid UTF-8.",
            )

    # 4. Enforce size limit
    if len(content) > config_module.settings.max_file_bytes:
        max_mb = config_module.settings.max_file_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {max_mb:.0f} MB.",
        )

    return content


# ─────────────────────────────────────────────────────────────────
# Security Headers Middleware
# ─────────────────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds defensive HTTP security headers to every response.
    These are low-risk and widely recommended for web APIs.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )
        # Only add HSTS on HTTPS deployments (harmless to include always)
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
        return response
