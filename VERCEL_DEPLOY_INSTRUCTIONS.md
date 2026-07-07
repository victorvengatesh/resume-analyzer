# Deploy Frontend to Vercel - Step by Step

Since Vercel CLI auto-detects the Python backend and causes conflicts, use the **Vercel Dashboard** instead:

## Steps:

### 1. Go to Vercel Dashboard
Visit: https://vercel.com/new

### 2. Import GitHub Repository
- Click **"Add New... → Project"**
- Select **"Import Git Repository"**
- Choose: `victorvengatesh/resume-analyzer`
- Click **"Import"**

### 3. Configure Project Settings

**Framework Preset**: Select **"Other"**

**Root Directory**: Click **"Edit"** and set to: `frontend`
*(This tells Vercel to treat the frontend folder as the root)*

**Build & Development Settings**:
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `dist` (auto-detected from Vite)
- **Install Command**: `npm install` (auto-detected)

### 4. Add Environment Variable

Click **"Environment Variables"** and add:

```
Name: VITE_API_BASE_URL
Value: https://your-backend-url.onrender.com
```

*(Leave as placeholder for now - you'll update this after deploying the backend to Render)*

### 5. Deploy

Click **"Deploy"** button and wait ~2-3 minutes.

---

## After Deployment

1. Vercel will give you a URL like: `https://resume-analyzer-xyz.vercel.app`

2. **Deploy the backend to Render** (see `RENDER_QUICK_START.md`):
   - Set `FRONTEND_URL` on Render to your Vercel URL

3. **Update frontend env var**:
   - Go to Vercel → Your Project → Settings → Environment Variables
   - Edit `VITE_API_BASE_URL` to your Render backend URL
   - **Redeploy** (Deployments tab → Click "..." → Redeploy)

---

## Troubleshooting

**Build fails with "react-scripts not found"**:
- Make sure Root Directory is set to `frontend`
- Framework Preset should be "Other" (not Create React App)

**Blank page after deployment**:
- Check browser console for CORS errors
- Verify `VITE_API_BASE_URL` is set correctly
- Verify `FRONTEND_URL` is set on Render backend

**API calls fail**:
- Backend must be deployed and running on Render
- CORS must allow your Vercel domain
- Check Render logs for errors

---

## Your Deployment URLs (fill in after deployment)

**Frontend (Vercel)**: ___________________________________

**Backend (Render)**: ___________________________________

**GitHub Repo**: https://github.com/victorvengatesh/resume-analyzer
