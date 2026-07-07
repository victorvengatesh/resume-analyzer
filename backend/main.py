from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config import settings
from backend.core.logging import setup_logging
from backend.core.middleware import RequestTimingMiddleware
from backend.core.security import SecurityHeadersMiddleware
from backend.db.database import check_db_connection
from backend.db.database import Base, engine
from backend.api.v1.endpoints import router as v1_router
from backend.api.v1.analytics import router as analytics_router
from backend.api.v1.exports import router as exports_router
from backend.api.v1.batch import router as batch_router
from backend.api.v1.interview import router as interview_router
from backend.api.v1.auth import router as auth_router
from datetime import datetime, timezone

# Setup Logging
logger = setup_logging()

# Import all models to ensure they're registered with SQLAlchemy
import backend.models.batch  # noqa: F401
import backend.models.interview  # noqa: F401
import backend.models.activity  # noqa: F401
import backend.models.user  # noqa: F401
import backend.models.workspace  # noqa: F401
import backend.models.audit_log  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan event handler for startup and shutdown.
    
    Gracefully handles database initialization:
    - If database is unavailable during startup, logs error but allows app to start
    - This prevents deployment failures due to temporary database connection issues
    - Compatible with both SQLite and PostgreSQL
    """
    logger.info("🚀 Starting Smart Resume Analyzer backend...")
    
    # Attempt database initialization with error handling
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created/verified successfully")
    except Exception as e:
        logger.error(f"⚠️  Database initialization failed: {e}")
        logger.error("⚠️  Application starting in degraded mode - database may be temporarily unavailable")
        logger.error("⚠️  Database operations will be retried on first request")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Smart Resume Analyzer backend...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestTimingMiddleware)

# CORS — use configured frontend_url in production, broad list in dev
origins = []
if settings.frontend_url:
    origins.append(settings.frontend_url)
else:
    origins.extend([
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Versioned API Routers ──────────────────────────────────────────
app.include_router(auth_router,      prefix="/api/v1/auth",      tags=["auth"])
app.include_router(v1_router,        prefix="/api/v1",           tags=["resumes"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(exports_router,   prefix="/api/v1/exports",   tags=["exports"])
app.include_router(batch_router,     prefix="/api/v1/batch",     tags=["batch"])
app.include_router(interview_router, prefix="/api/v1/interview", tags=["interview"])
# NOTE: Legacy root-level routes (/analyze, /batch-analyze) have been removed.
# All clients must use the versioned /api/v1/... paths.


@app.get("/health", tags=["system"])
def health():
    db_ok = check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "db": "connected" if db_ok else "unavailable",
        "mode": settings.app_mode,
        "auth_enabled": settings.enable_auth,
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/", tags=["system"])
def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/api/docs",
        "health": "/health",
    }
