"""
Vercel serverless function entry point for FastAPI backend.
This file is required for Vercel's Python runtime.
"""
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.main import app

# Export the FastAPI app instance for Vercel
app = app
