"""
Vercel serverless function entry point for FastAPI backend.
"""
import sys
import os

# Set up Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the FastAPI app
from main import app as application

# Vercel expects a variable named 'app'
app = application
