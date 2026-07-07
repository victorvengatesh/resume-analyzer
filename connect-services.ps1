# PowerShell script to connect frontend and backend on Vercel
# This will open the browser tabs for you to add environment variables manually

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Vercel Deployment - Final Configuration Steps" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📦 Backend URL:" -ForegroundColor Green
Write-Host "   https://backend-98vp8uleu-victorvengateshs-projects.vercel.app" -ForegroundColor White
Write-Host ""

Write-Host "📦 Frontend URL:" -ForegroundColor Green  
Write-Host "   https://frontend-mztwp8yvz-victorvengateshs-projects.vercel.app" -ForegroundColor White
Write-Host ""

Write-Host "⚙️  Step 1: Configure Backend Environment Variables" -ForegroundColor Yellow
Write-Host "Opening backend settings page..." -ForegroundColor Gray
Start-Process "https://vercel.com/victorvengateshs-projects/backend/settings/environment-variables"

Write-Host ""
Write-Host "Add these variables (copy from VERCEL_DEPLOYMENT_COMPLETE.md):" -ForegroundColor White
Write-Host "  • SECRET_KEY" -ForegroundColor Gray
Write-Host "  • GEMINI_API_KEY" -ForegroundColor Gray
Write-Host "  • FRONTEND_URL" -ForegroundColor Gray
Write-Host "  • APP_MODE" -ForegroundColor Gray
Write-Host "  • ENABLE_AUTH" -ForegroundColor Gray
Write-Host "  • DATABASE_URL" -ForegroundColor Gray
Write-Host "  • PYTHONPATH" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter after adding backend env vars to continue..."

Write-Host ""
Write-Host "⚙️  Step 2: Configure Frontend Environment Variable" -ForegroundColor Yellow
Write-Host "Opening frontend settings page..." -ForegroundColor Gray
Start-Process "https://vercel.com/victorvengateshs-projects/frontend/settings/environment-variables"

Write-Host ""
Write-Host "Add this variable:" -ForegroundColor White
Write-Host "  Key:   VITE_API_BASE_URL" -ForegroundColor Gray
Write-Host "  Value: https://backend-98vp8uleu-victorvengateshs-projects.vercel.app" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter after adding frontend env var to continue..."

Write-Host ""
Write-Host "🔄 Step 3: Redeploy Both Services" -ForegroundColor Yellow
Write-Host "Opening deployment pages..." -ForegroundColor Gray

Start-Process "https://vercel.com/victorvengateshs-projects/backend"
Start-Sleep -Seconds 2
Start-Process "https://vercel.com/victorvengateshs-projects/frontend"

Write-Host ""
Write-Host "On each page:" -ForegroundColor White
Write-Host "  1. Click 'Deployments' tab" -ForegroundColor Gray
Write-Host "  2. Click '...' on latest deployment" -ForegroundColor Gray
Write-Host "  3. Click 'Redeploy'" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter after both redeployments start..."

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ Configuration Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Wait 2-3 minutes for deployments to complete, then test:" -ForegroundColor White
Write-Host "  👉 https://frontend-mztwp8yvz-victorvengateshs-projects.vercel.app" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check backend health:" -ForegroundColor White
Write-Host "  👉 https://backend-98vp8uleu-victorvengateshs-projects.vercel.app/health" -ForegroundColor Cyan
Write-Host ""
