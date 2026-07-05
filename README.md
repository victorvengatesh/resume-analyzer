# Smart Resume Analyzer
### Enterprise AI Recruitment Platform — ATS + AI Interview Copilot

[![Platform CI](https://github.com/your-org/smart-resume-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/smart-resume-analyzer/actions)

---

## Overview

A production-ready, full-stack Applicant Tracking System (ATS) powered by Google Gemini. Handles resume ingestion, AI-based scoring, bulk candidate ranking, and interactive AI-generated interview kits — all in a clean, modular architecture.

---

## Features

| Feature | Description |
|---|---|
| **Resume Analysis** | Upload PDF/DOCX/TXT; AI extracts skills, education, experience and scores against a job role |
| **Bulk Ranking** | Async batch processing of up to 50 resumes; live progress polling; ranked podium |
| **AI Interview Copilot** | Gemini-generated question banks (10 technical, 5 coding, 5 scenario, 5 behavioral, 5 HR) |
| **Recruiter Scorecard** | Per-category scoring (0-10), notes, decision, session history |
| **ATS Pipeline** | Status tracking: Applied → Screening → Interview → Shortlisted → Offer → Hired/Rejected |
| **Analytics Dashboard** | Score distributions, top skills, missing skills gap analysis |
| **JWT Authentication** | Access + refresh tokens, RBAC (Admin/Recruiter/HR/Viewer), password change |
| **Audit Logging** | Every user action logged with IP, user ID, and timestamp |
| **Security Headers** | CSP-safe headers, MIME validation, magic-byte file checking, rate limiting |
| **Docker** | One-command production stack: `docker compose up --build` |

---

## Architecture

```
smart-resume-analyzer/
├── backend/                  # FastAPI application
│   ├── api/v1/               # Route handlers (auth, resumes, batch, interview, analytics, exports)
│   ├── core/                 # Config, logging, middleware, security
│   ├── db/                   # SQLAlchemy engine + session factory
│   ├── migrations/           # Alembic migration versions
│   ├── models/               # SQLAlchemy ORM models
│   ├── repositories/         # Repository pattern (BaseRepository + domain repos)
│   ├── schemas/              # Pydantic request/response models
│   ├── services/             # Business logic (ResumeService, NLPService, AuthService)
│   └── tests/                # pytest test suite
└── frontend/                 # React + TypeScript + Vite
    └── src/
        ├── pages/            # Dashboard, Candidates, BulkAnalyzer, InterviewCopilot, ...
        ├── layouts/          # DashboardLayout
        └── api.ts            # Typed API client
```

### Technology Stack

**Backend:** FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 · passlib/bcrypt · python-jose · psycopg2  
**AI:** Google Gemini 1.5 Flash (via `google-genai`) · Rule-based fallback  
**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS · Recharts · React Router v7  
**Database:** SQLite (development) · PostgreSQL 15 (production)  
**Infrastructure:** Docker · Docker Compose · Nginx · GitHub Actions

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (optional — fallback scoring works without it)

### 1. Backend

```bash
# From repo root
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env — set GEMINI_API_KEY at minimum

# Run migrations (creates SQLite DB by default)
cd ..
python -m alembic -c backend/alembic.ini upgrade head

# Start server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

API docs: http://localhost:8000/api/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev   # starts on http://localhost:3000
```

---

## Docker (Production)

```bash
# 1. Configure secrets
cp .env.example .env
# Edit .env — set SECRET_KEY, GEMINI_API_KEY, POSTGRES_PASSWORD

# 2. Build and start
docker compose up --build

# Services:
#   Frontend  → http://localhost:3000
#   Backend   → http://localhost:8000
#   API Docs  → http://localhost:8000/api/docs
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes* | — | Google Gemini key (`*` rule-based fallback works without it) |
| `SECRET_KEY` | **Yes in prod** | insecure default | JWT signing key — use `secrets.token_hex(32)` |
| `DATABASE_URL` | No | SQLite | PostgreSQL URL for production |
| `ENABLE_AUTH` | No | `false` | Set `true` in production |
| `ENABLE_USAGE_LIMITS` | No | `false` | Enable per-IP rate limiting |
| `FRONTEND_URL` | No | `*` | Restrict CORS to this origin |
| `APP_MODE` | No | `demo` | `production` triggers security warnings |
| `MAX_FILE_BYTES` | No | `10485760` | Max upload size (bytes) |
| `MAX_WORKERS` | No | `10` | Batch processing thread pool size |

Full list in [`backend/.env.example`](backend/.env.example).

---

## API Reference

Base URL: `http://localhost:8000`  
Interactive docs: [`/api/docs`](http://localhost:8000/api/docs)

### Authentication
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register a new user |
| `POST` | `/api/v1/auth/login` | Login, get access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Rotate tokens using refresh token |
| `POST` | `/api/v1/auth/logout` | Log out (audit logged) |
| `GET` | `/api/v1/auth/me` | Get current user profile |
| `POST` | `/api/v1/auth/change-password` | Change own password |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset |
| `GET` | `/api/v1/auth/users` | Admin: list all users |
| `PATCH` | `/api/v1/auth/users/{id}/deactivate` | Admin: deactivate a user |

### Resumes
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/analyze` | Upload + analyze a single resume |
| `GET` | `/api/v1/resumes` | List candidates (filterable, paginated) |
| `GET` | `/api/v1/resumes/{id}` | Get full candidate profile |
| `PATCH` | `/api/v1/resumes/{id}/status` | Update pipeline status |
| `GET` | `/api/v1/resumes/{id}/notes` | Get recruiter notes |
| `POST` | `/api/v1/resumes/{id}/notes` | Add a recruiter note |
| `GET` | `/api/v1/resumes/{id}/timeline` | Get activity timeline |

### Batch
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/batch/analyze` | Start async batch job |
| `GET` | `/api/v1/batch/{id}/status` | Poll job status + results |
| `GET` | `/api/v1/batch/` | List recent batch jobs |

### Interview
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/interview/{id}/generate` | Generate AI interview kit |
| `GET` | `/api/v1/interview/{id}/kit` | Retrieve interview kit |
| `GET` | `/api/v1/interview/{id}/sessions` | List interview sessions |
| `POST` | `/api/v1/interview/{id}/sessions` | Save interview session |
| `PATCH` | `/api/v1/interview/{id}/sessions/{sid}` | Update session |

### Analytics & Exports
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/dashboard` | Dashboard statistics |
| `GET` | `/api/v1/analytics/insights` | AI-generated hiring insights |
| `GET` | `/api/v1/exports/candidates/csv` | Export all candidates as CSV |

---

## Database Migrations

```bash
# From repo root with .venv active
# Apply all pending migrations
python -m alembic -c backend/alembic.ini upgrade head

# Create a new migration after model changes
python -m alembic -c backend/alembic.ini revision --autogenerate -m "describe change"

# Check current migration version
python -m alembic -c backend/alembic.ini current
```

---

## Running Tests

```bash
# From repo root
pytest                        # run all tests
pytest -v                     # verbose
pytest backend/tests/test_auth.py   # single file
pytest -k "test_login"        # filter by name
```

---

## RBAC Roles

| Role | Permissions |
|---|---|
| **Admin** | Full access including user management |
| **Recruiter** | Upload, analyze, update status, add notes |
| **HR** | View candidates, evaluate, add notes, interview |
| **Viewer** | Read-only: dashboard, candidate list |

When `ENABLE_AUTH=false` (default), all endpoints are open (demo mode).

---

## Security

- Passwords hashed with **bcrypt** (cost factor 12)
- JWTs signed with **HS256** — rotate `SECRET_KEY` regularly
- File uploads validated by **magic bytes** (not just extension)
- Path traversal blocked on uploaded filenames
- **Security headers** on every response (X-Frame-Options, X-Content-Type-Options, etc.)
- **Rate limiting** per IP (token bucket; 5 req/s, burst 20)
- All user actions **audit logged** to database

---

## Deployment (Render)

See [`render.yaml`](render.yaml). Set the following in the Render dashboard:
- `SECRET_KEY` — generate with `python -c "import secrets; print(secrets.token_hex(32))"`
- `GEMINI_API_KEY` — from Google AI Studio
- `DATABASE_URL` — PostgreSQL connection string (Render Postgres add-on)
- `FRONTEND_URL` — your Render static site URL

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run tests: `pytest`
4. Open a pull request — CI must pass before merge
