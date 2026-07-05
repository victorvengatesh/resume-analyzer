import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.core.config import settings

logger = logging.getLogger("resume_analyzer.database")

# ─────────────────────────────────────────────────────────────────
# Engine configuration
# ─────────────────────────────────────────────────────────────────

_is_sqlite = settings.database_url.startswith("sqlite")

if _is_sqlite:
    # SQLite: single-file, dev/test only
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        # Echo only in non-production
        echo=settings.app_mode != "production",
    )

    # Enable WAL mode and foreign key enforcement for SQLite
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

else:
    # PostgreSQL: production-grade connection pool
    engine = create_engine(
        settings.database_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,          # recycle stale connections
        pool_recycle=3600,           # recycle connections after 1 hour
        echo=False,
    )
    logger.info("PostgreSQL engine created with pool_size=10, max_overflow=20")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ─────────────────────────────────────────────────────────────────
# Dependency
# ─────────────────────────────────────────────────────────────────

def get_db():
    """FastAPI dependency that yields a database session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_db_connection() -> bool:
    """Health-check helper: returns True if the DB is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        return False
