# Smart Resume Analyzer - Startup Guide

## Quick Start

### Backend
```bash
# From project root (v:\smart-resume-analyzer)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

**Swagger UI**: http://127.0.0.1:8000/api/docs  
**Health Check**: http://127.0.0.1:8000/health

### Frontend
```bash
# From project root
cd frontend
npm run dev
```

**Development Server**: http://localhost:3000

### Production Build
```bash
# Backend (production)
cd v:\smart-resume-analyzer
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Frontend (production build)
cd frontend
npm run build
```

## Important Notes

- **Always run commands from the project root** (`v:\smart-resume-analyzer`)
- The backend uses `backend.*` imports, requiring proper Python path setup
- `python -m uvicorn` ensures correct module resolution
- Never run `cd backend && uvicorn main:app` - this breaks imports

## Verification

```bash
# Test backend
python -m pytest backend/tests/ -v

# Test frontend build
cd frontend
npm run build

# Check all API endpoints
python e2e_verify.py
```

## Docker

```bash
# Build and run with docker-compose
docker-compose up --build

# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

## Environment Variables

Create `.env` in project root:
```env
DATABASE_URL=sqlite:///./resume_ai.db
SECRET_KEY=your-secret-key-here
ENABLE_AUTH=false
GEMINI_API_KEY=your-gemini-api-key
APP_MODE=demo
```

## Troubleshooting

### ModuleNotFoundError: No module named 'backend'
- Ensure you're in the project root directory
- Use `python -m uvicorn backend.main:app` (NOT `cd backend && uvicorn main:app`)
- Verify `backend/__init__.py` exists

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Database Issues
```bash
# Recreate database
rm resume_ai.db
python -c "from backend.db.database import Base, engine; Base.metadata.create_all(bind=engine)"
```
