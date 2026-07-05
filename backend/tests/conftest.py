"""
Shared pytest fixtures for all backend tests.
Uses an in-memory SQLite database so tests are hermetic and fast.
"""
import warnings
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.db.database import Base, get_db
from backend.models.user import Role
from backend.core.config import settings

# Suppress httpx DeprecationWarning about 'app' shortcut (internal to starlette TestClient)
warnings.filterwarnings("ignore", category=DeprecationWarning, module="httpx")

# ─────────────────────────────────────────────────────────────────
# In-memory SQLite engine shared across the entire test session
# ─────────────────────────────────────────────────────────────────
TEST_DB_URL = "sqlite://"
_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all tables once per test session, drop at the end."""
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)
    _engine.dispose()


@pytest.fixture(scope="session")
def db():
    """Provide a session-scoped database session."""
    session = _TestingSession()
    # Seed roles
    for name, desc in [
        ("Admin",     "Full administrative permissions"),
        ("Recruiter", "Full candidate processing permissions"),
        ("HR",        "Full evaluation permissions"),
        ("Viewer",    "Read-only access"),
    ]:
        if not session.query(Role).filter_by(name=name).first():
            session.add(Role(name=name, description=desc))
    session.commit()
    yield session
    try:
        session.rollback()
    except Exception:
        pass
    session.close()


@pytest.fixture(scope="session")
def client(db):
    """TestClient with DB overridden and auth enabled."""
    def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    original = settings.enable_auth
    settings.enable_auth = True

    # NOTE: starlette >=0.21 requires app as positional arg, not keyword
    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    settings.enable_auth = original


@pytest.fixture(scope="session")
def client_no_auth(db):
    """TestClient with auth disabled — for testing open endpoints."""
    def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    original = settings.enable_auth
    settings.enable_auth = False

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    settings.enable_auth = original


# ── Token helpers ────────────────────────────────────────────────

def _register_and_login(client, email: str, password: str, role: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "role_name": role},
    )
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return r.json()


@pytest.fixture(scope="session")
def recruiter_tokens(client):
    return _register_and_login(client, "recruiter@test.com", "Password1!", "Recruiter")


@pytest.fixture(scope="session")
def admin_tokens(client):
    return _register_and_login(client, "admin@test.com", "Password1!", "Admin")


@pytest.fixture(scope="session")
def viewer_tokens(client):
    return _register_and_login(client, "viewer@test.com", "Password1!", "Viewer")
