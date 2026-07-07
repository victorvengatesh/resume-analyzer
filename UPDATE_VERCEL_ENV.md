# Update Vercel Environment Variable

After deploying your backend to Render, you need to connect the frontend to it.

## Option 1: Via Vercel Dashboard (Easiest)

1. Go to: https://vercel.com/victorvengateshs-projects/frontend/settings/environment-variables

2. Click **"Add New"**

3. Fill in:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://your-backend-url.onrender.com` (your actual Render backend URL)
   - **Environments**: Check "Production", "Preview", "Development"

4. Click **"Save"**

5. Go to **Deployments** tab → Click latest deployment → Click **"..."** → **"Redeploy"**

## Option 2: Via CLI

```bash
cd v:\smart-resume-analyzer\frontend
echo https://your-backend-url.onrender.com | vercel env add VITE_API_BASE_URL production
vercel --prod
```

---

## Current Frontend URL

**Production**: https://frontend-mztwp8yvz-victorvengateshs-projects.vercel.app

**Alternate**: https://frontend-nu-cyan-63.vercel.app

---

## Verify Connection

After updating the env var and redeploying:

1. Visit your Vercel URL
2. Open browser DevTools → Network tab
3. Try uploading a resume
4. Check if API calls go to your Render backend (not localhost)
5. Verify no CORS errors in console

If CORS errors appear, make sure `FRONTEND_URL` is set correctly on Render.
