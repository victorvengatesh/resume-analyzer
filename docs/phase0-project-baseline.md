# Phase 0 – Project Baseline

## Purpose
This document captures the current state of the Smart Resume Analyzer before any Milestone 1 refactoring begins. It serves as the baseline for backward compatibility checks and future regression testing.

## 1. Current application state

### Product scope
The application currently provides a resume analysis workflow that:
- accepts a resume upload,
- extracts text from PDF, DOCX, or TXT files,
- derives contact details and experience hints,
- runs a semantic retrieval and scoring flow,
- stores analysis results in SQLite,
- returns a match score and explanation to the frontend.

### Current architecture summary
- Frontend: React + Vite + TypeScript/JavaScript UI
- Backend: FastAPI application with API endpoints and service modules
- Data storage: SQLite via SQLAlchemy
- AI layer: resume chunking, retrieval, and scoring logic using the existing NLP service
- File handling: local filesystem upload and temporary file processing

## 2. Current backend API surface

### Health
- GET /health
- Returns application health status and timestamp.

### Resume analysis
- POST /analyze
- Accepts a single uploaded file and a job role query.
- Returns extracted metadata, skills, missing skills, confidence, explanation, and scoring details.

### Batch analysis
- POST /batch-analyze
- Accepts multiple uploaded files and a job role query.
- Returns ranked analysis results for each file.

### Resume listing
- GET /resumes
- Supports basic filtering by text search, minimum score, and job role.

### Resume detail
- GET /resumes/{resume_id}
- Returns a single stored analysis record.

## 3. Current database schema
The main persisted entity is the Resume model with the following fields:
- id
- filename
- original_name
- email
- phone
- location
- linkedin
- github
- skills
- skill_score
- exp_years
- exp_score
- total_score
- job_applied
- match_level
- missing_skills
- explanation
- strengths
- gaps
- retrieved_chunks
- confidence
- size
- uploaded_at

## 4. Current folder structure

### Repository root
- docs/
- frontend/
- resume extractor/
- uploads/

### Backend structure
- resume extractor/backend/app.py
- resume extractor/backend/main.py
- resume extractor/backend/database.py
- resume extractor/backend/models.py
- resume extractor/backend/schemas.py
- resume extractor/backend/service/
- resume extractor/backend/module/
- resume extractor/backend/uploads/

### Frontend structure
- frontend/src/App.tsx
- frontend/src/App.js
- frontend/src/App.jsx
- frontend/src/data.ts
- frontend/src/main.tsx
- frontend/src/index.css

## 5. Verified functionality
The following baseline checks were completed before refactoring:
- Backend health endpoint responds successfully.
- The current application starts and serves the existing analysis API surface.
- Existing resume analysis flow is available for future regression testing.

## 6. Baseline verification commands
The following commands were used to verify the current state:
- git status --short --branch
- python health endpoint smoke test via FastAPI TestClient

## 7. Baseline reference
Git baseline tag:
- baseline/pre-milestone1

## 8. Regression checklist for future work
Before considering any Milestone 1 change complete, verify that:
- the health endpoint still works,
- single-file analysis still works,
- batch analysis still works,
- resume listing still works,
- the frontend can still load and send analysis requests,
- the database model remains readable and compatible.
