# Smart Resume Analyzer

### Full-Stack AI-Assisted Recruitment Platform

[![Platform CI](https://github.com/victorvengatesh/resume-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/victorvengatesh/resume-analyzer/actions)

Smart Resume Analyzer is a full-stack recruitment application for resume ingestion, structured candidate analysis, ATS-style scoring, batch ranking, hiring-pipeline tracking and interview preparation.

The project is designed to demonstrate how AI features can be integrated into a conventional web application without making the model the only source of truth.

---

## Core capabilities

| Capability | What it does |
|---|---|
| Resume analysis | Parses PDF/DOCX/TXT resumes and extracts skills, education and experience |
| ATS-style scoring | Scores candidates against job-role requirements with AI/rule-based support |
| Bulk ranking | Processes multiple resumes asynchronously and ranks candidates |
| Interview copilot | Generates role-aware technical, coding, scenario, behavioral and HR questions |
| Recruiter scorecards | Stores category scores, notes, decisions and interview-session history |
| Hiring pipeline | Tracks candidates from Applied through Hired/Rejected states |
| Analytics | Summarizes score distributions, skill trends and missing-skill patterns |
| Authentication/RBAC | Supports JWT-based access control and user roles |
| Audit logging | Records important user actions for traceability |
| Exports | Supports candidate data export for downstream review |

---

## Architecture

```text
React + TypeScript frontend
          │
          ▼
      FastAPI API
          │
          ├── Auth / RBAC
          ├── Resume ingestion
          ├── Candidate pipeline
          ├── Batch analysis
          ├── Interview workflows
          ├── Analytics / exports
          │
          ├── AI + rule-based scoring services
          └── SQLAlchemy / PostgreSQL or SQLite
```

### Technology stack

**Backend:** FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2  
**AI:** Google Gemini integration · rule-based fallback paths  
**Frontend:** React · TypeScript · Vite · Tailwind CSS · Recharts  
**Database:** SQLite for development · PostgreSQL for production-oriented setups  
**Infrastructure:** Docker · Docker Compose · GitHub Actions · Nginx

---

## Repository structure

```text
resume-analyzer/
├── backend/
│   ├── api/v1/          API routes
│   ├── core/            config, logging, middleware and security utilities
│   ├── db/              database/session setup
│   ├── migrations/      Alembic migrations
│   ├── models/          ORM models
│   ├── repositories/    persistence layer
│   ├── schemas/         request/response models
│   ├── services/        business and AI logic
│   └── tests/           pytest suite
├── frontend/            React + TypeScript application
├── docker-compose.yml   local multi-service setup
└── README.md
```

Historical deployment/status documents remain in the repository from earlier development phases. The README and active configuration files should be treated as the primary source of current setup information.

---

## Quick start

### Backend

```bash
git clone https://github.com/victorvengatesh/resume-analyzer.git
cd resume-analyzer/backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Configure environment variables using the included example file, then from the repository root run migrations:

```bash
python -m alembic -c backend/alembic.ini upgrade head
```

Start the API:

```bash
python -m uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Docker

```bash
cp .env.example .env
# Configure secrets and database values before production use.

docker compose up --build
```

Do not use development defaults for `SECRET_KEY`, database credentials or authentication settings in a public deployment.

---

## Security model

The application includes security-oriented engineering such as:

- password hashing
- JWT access/refresh flows
- role-based access control
- file type / magic-byte validation
- filename/path handling protections
- security headers
- rate-limiting support
- audit logging

These controls are implementation features, not a formal security certification. Real production use still requires threat modeling, dependency/secret scanning, authorization testing, infrastructure hardening and monitoring.

---

## Testing

```bash
pytest
pytest -v
pytest backend/tests/test_auth.py
```

The GitHub Actions workflow is the best place to verify current automated build/test status. Avoid treating undocumented percentages or benchmark claims as guarantees unless they are backed by reproducible CI artifacts.

---

## AI behavior

The project uses AI as an assistant rather than an unquestioned decision-maker. Candidate scoring and interview content should be reviewed by a human recruiter, especially for real hiring decisions.

For responsible use:

- do not infer protected characteristics
- do not treat model-generated scores as objective truth
- evaluate scoring consistency across representative candidate groups
- retain human review for hiring decisions
- protect uploaded resume data and personally identifiable information

---

## Current engineering priorities

- strengthen evaluation of resume scoring quality
- improve automated regression coverage
- consolidate historical deployment documentation
- improve production observability and failure handling
- add clearer benchmark and model-evaluation reports
- continue tightening privacy and access-control behavior

---

## Project status

**Status:** active portfolio / engineering project  
**Focus:** AI-assisted recruitment workflows, full-stack architecture and responsible automation

---

Built by **M. Victor Vengatesh**.
