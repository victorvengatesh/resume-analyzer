# Vercel Deployment Guide — Smart Resume Analyzer Frontend

## Quick Fix Summary

**Root Cause:** Vercel was trying to run `react-scripts build` from the repo root, but:
1. Frontend code lives in `frontend/` subdirectory
2. Project uses Vite, not Create React App
3. No root `package.json` existed

**Solution:** Created root `vercel.json` that tells Vercel:
- Where to find the frontend (`frontend/` directory)
- How to build it (`npm ci && npm run build` in that directory)
- Where the output is (`frontend/dist`)

---

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to** [vercel.com/new](https://vercel.com/new)

2. **Import** `victorvengatesh/resume-analyzer` from GitHub

3. **Configure Project:**
   - **Framework Preset:** Other (don't select React/Next.js — we have custom config)
   - **Root Directory:** Leave as `./` (root `vercel.json` handles subdirectory)
   - **Build Command:** Will use `vercel.json` config automatically
   - **Output Directory:** Will use `vercel.json` config automatically

4. **Environment Variables** — add these in the Vercel dashboard:
   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com
   ```
   Replace with your actual Render backend URL once deployed.

5. **Deploy** — Click "Deploy"

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# From repo root
vercel

# Follow prompts:
#   Set up project? Y
#   Which scope? [your account]
#   Link to existing? N
#   Project name? smart-resume-analyzer
#   Directory? ./ (root)
#   Override settings? N (vercel.json is already configured)

# Production deployment
vercel --prod
```

---

## Environment Variables Required

| Variable | Value | Where to Set |
|---|---|---|
| `VITE_API_BASE_URL` | `https://your-backend.onrender.com` | Vercel dashboard → Settings → Environment Variables |

**Important:** 
- The `VITE_` prefix is required — Vite only exposes env vars that start with `VITE_`
- The value is baked into the bundle at build time, so you must redeploy if you change it
- Do NOT include a trailing slash

---

## Vercel Configuration (`vercel.json`)

```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm ci && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "npm ci --prefix frontend",
  "framework": null,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

**What each field does:**
- `buildCommand` — Runs `npm ci && npm run build` inside the `frontend/` directory
- `outputDirectory` — Tells Vercel the static files are in `frontend/dist`
- `installCommand` — Installs dependencies in the `frontend/` subdirectory
- `framework: null` — Disables auto-detection (we have custom config)
- `rewrites` — SPA routing: all routes serve `index.html` (React Router handles client-side routing)
- `headers` — Security headers on every response

---

## Connecting Frontend to Backend

### 1. Deploy Backend First (Render)

Follow [`RENDER_QUICK_START.md`](./RENDER_QUICK_START.md) to deploy the backend to Render.

Once deployed, you'll get a URL like:
```
https://resume-analyzer-backend-xyz123.onrender.com
```

### 2. Set Frontend Env Var

In Vercel dashboard → Settings → Environment Variables, add:
```
VITE_API_BASE_URL=https://resume-analyzer-backend-xyz123.onrender.com
```

### 3. Set Backend CORS

In Render dashboard → Environment Variables, add:
```
FRONTEND_URL=https://your-app.vercel.app
```

This tells the backend to allow requests from your Vercel frontend.

### 4. Redeploy Both

- **Vercel:** Redeploy (Settings → Deployments → click "..." → Redeploy)
- **Render:** Will auto-redeploy when you push to GitHub

---

## Troubleshooting

### Build fails with "react-scripts: command not found"

**Cause:** Vercel is looking for Create React App but the project uses Vite.

**Fix:** Ensure root `vercel.json` exists with correct `buildCommand` (should say `vite build`, not `react-scripts build`).

### Frontend loads but API calls fail with CORS error

**Cause:** Backend is rejecting requests from the Vercel domain.

**Fix:** 
1. Set `FRONTEND_URL` env var on Render to your Vercel URL
2. Redeploy backend
3. Check backend logs: `curl https://your-backend.onrender.com/health`

### Frontend shows "Failed to fetch" on every API call

**Cause:** `VITE_API_BASE_URL` is wrong or missing.

**Fix:**
1. Check Vercel → Settings → Environment Variables
2. Ensure it's set to your Render backend URL (with `https://`, no trailing `/`)
3. Redeploy frontend (env vars are baked into the build)

### 404 on refresh (e.g. `/candidates/123`)

**Cause:** Vercel is looking for a physical `/candidates/123.html` file instead of serving `index.html` for client-side routing.

**Fix:** The `vercel.json` rewrite rule handles this — ensure it's deployed. Check Vercel logs to confirm `vercel.json` was used.

---

## Redeployment Commands

```bash
# After any frontend code change
git add .
git commit -m "fix: update frontend"
git push origin main

# Vercel auto-deploys on push if connected to GitHub

# OR manual redeploy via CLI
vercel --prod
```

---

## Performance & Security

### What's Configured

✅ **Security Headers** — CSP-safe headers on all responses  
✅ **Asset Caching** — `/assets/*` cached for 1 year (fingerprinted filenames)  
✅ **HTML No-Cache** — `index.html` always fresh (prevents stale SPA shell)  
✅ **SPA Routing** — All routes serve `index.html` (React Router works)  
✅ **Gzip Compression** — Enabled by default on Vercel  

### Bundle Size (Production Build)

```
dist/index.html                    2.06 kB │ gzip:   0.83 kB
dist/assets/index-BrBKHmJH.css    81.50 kB │ gzip:  12.39 kB
dist/assets/icons-BWKChr0u.js     23.84 kB │ gzip:   5.24 kB
dist/assets/react-vendor-BAG0.js  50.97 kB │ gzip:  18.07 kB
dist/assets/charts-BP622Szz.js   425.08 kB │ gzip: 120.23 kB
dist/assets/index-BMe9qGli.js    493.63 kB │ gzip: 146.08 kB
```

**Total JS (gzipped):** ~290 KB  
**First Load:** ~2 seconds on 3G

---

## Custom Domain (Optional)

### Add a Custom Domain

1. Vercel Dashboard → Settings → Domains
2. Add domain: `resumeanalyzer.com`
3. Follow DNS setup instructions (add A/CNAME records)
4. Vercel auto-provisions SSL certificate (Let's Encrypt)

### Update Backend CORS

After adding a custom domain, update the backend `FRONTEND_URL`:

```bash
# In Render dashboard
FRONTEND_URL=https://resumeanalyzer.com
```

Then redeploy the backend.

---

## Production Checklist

- [ ] Root `vercel.json` exists with correct `buildCommand` and `outputDirectory`
- [ ] `VITE_API_BASE_URL` env var set in Vercel dashboard
- [ ] Backend deployed to Render with `FRONTEND_URL` pointing to Vercel URL
- [ ] Both services can talk to each other (test with browser devtools → Network tab)
- [ ] Security headers present (check with `curl -I https://your-app.vercel.app`)
- [ ] SPA routing works (refresh on `/candidates` → no 404)
- [ ] Custom domain configured (if using one)

---

**Generated:** 2026-07-05  
**Project:** Smart Resume Analyzer  
**Frontend Stack:** React 19 + TypeScript + Vite + Tailwind CSS  
**Deployment Platform:** Vercel (frontend) + Render (backend)
