# PowerShell script to add environment variables to Vercel backend project
# Run this from the backend directory

cd backend

# Add environment variables one by one
echo "d47269471e81176b3c2d6f96dab01bceefba4d8b2a962803c427a52bc3fb7aac" | vercel env add SECRET_KEY production
echo "<your-gemini-api-key>" | vercel env add GEMINI_API_KEY production
echo "https://frontend-mztwp8yvz-victorvengateshs-projects.vercel.app" | vercel env add FRONTEND_URL production
echo "production" | vercel env add APP_MODE production
echo "true" | vercel env add ENABLE_AUTH production
echo "true" | vercel env add ENABLE_USAGE_LIMITS production
echo "true" | vercel env add ENABLE_ANALYTICS production
echo "sqlite:///tmp/resume_ai.db" | vercel env add DATABASE_URL production
echo "." | vercel env add PYTHONPATH production

Write-Host "Environment variables added to Vercel backend project!"
Write-Host "Now redeploying backend..."

vercel --prod

cd ..
