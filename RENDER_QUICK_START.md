# 🚀 Render Deployment — Quick Start Guide

## Prerequisites

- [ ] GitHub account with this repository
- [ ] Render account (free tier works)
- [ ] Google Gemini API key ([Get it here](https://aistudio.google.com/app/apikey))

---

## Step-by-Step Deployment

### 1. Generate Secret Key

Run this locally to generate a secure `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Save the output — you'll need it in step 5.

---

### 2. Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select this repo: `smart-resume-analyzer`

---

### 3. Configure Build Settings

**Root Directory:**
```
.
```

**Build Command:**
```bash
pip install --upgrade pip && pip install -r backend/requirements.txt
```

**Start Command:**
```bash
uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1
```

---

### 4. Environment Variables (Auto-Set)

These are already configured in `render.yaml`:

- ✅ `PYTHON_VERSION=3.11.11`
- ✅ `PYTHONPATH=.`
- ✅ `APP_MODE=production`
- ✅ `ENABLE_AUTH=true`
- ✅ `UPLOAD_DIR=/tmp/uploads`

---

### 5. Environment Variables (Manual — REQUIRED)

Click **"Add Environment Variable"** and set these:

| Key | Value | Where to Get |
|-----|-------|--------------|
| `SECRET_KEY` | `<your-generated-key>` | Output from step 1 |
| `GEMINI_API_KEY` | `<your-api-key>` | https://aistudio.google.com/app/apikey |
| `FRONTEND_URL` | `<your-frontend-url>` | e.g., `https://yourapp.vercel.app` |

> **Important:** Do not include quotes around values. Paste raw values only.

---

### 6. (Optional) Add PostgreSQL Database

**For persistent storage (recommended for production):**

1. In Render dashboard, go to **"New +"** → **"PostgreSQL"**
2. Create database (choose region near your web service)
3. Copy the **Internal Database URL**
4. Add environment variable:
   - Key: `DATABASE_URL`
   - Value: `<internal-database-url>`

**For free tier / testing:**

Skip this step. The app will use SQLite (data resets on redeploy).

---

### 7. Deploy

1. Click **"Create Web Service"**
2. Wait 1-2 minutes for build to complete
3. Check logs for:
   ```
   ✅ Database tables created/verified successfully
   INFO: Application startup complete.
   INFO: Uvicorn running on http://0.0.0.0:10000
   ```

---

### 8. Verify Deployment

Your service URL will be: `https://your-app-name.onrender.com`

**Test endpoints:**

```bash
# Health check (should return 200 OK)
curl https://your-app-name.onrender.com/health

# API docs (should load Swagger UI)
curl https://your-app-name.onrender.com/api/docs
```

Expected health response:
```json
{
  "status": "ok",
  "db": "connected",
  "mode": "production",
  "auth_enabled": true,
  "time": "2026-07-05T10:00:00.000000+00:00"
}
```

---

## Frontend Configuration

Update your frontend `.env` file:

```bash
VITE_API_BASE_URL=https://your-app-name.onrender.com
```

Then rebuild your frontend:

```bash
npm run build
```

---

## Troubleshooting

### Build fails with "No module named 'backend'"

**Solution:** Verify `PYTHONPATH: "."` is in `render.yaml` (it should be already).

### Health check returns 503

**Solution:**
- Check Render logs for errors
- Verify `SECRET_KEY` and `GEMINI_API_KEY` are set correctly
- Wait 30 seconds for cold start to complete

### CORS errors in frontend

**Solution:**
- Set `FRONTEND_URL` to your exact frontend URL
- Do not include trailing slash
- Rebuild backend (Render → Manual Deploy)

### Database errors

**Solution:**
- If using SQLite: Data resets on redeploy (expected)
- If using PostgreSQL: Verify `DATABASE_URL` is correct
- Check logs for `⚠️ Database initialization failed` (non-critical if app starts)

---

## Performance Notes

- **Free Tier:** Service spins down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds.
- **Paid Tier:** Always-on. No cold starts.
- **Database:** PostgreSQL is required for persistent storage. SQLite data is lost on redeploy.

---

## Security Checklist

- [x] `SECRET_KEY` is random and unique
- [x] `GEMINI_API_KEY` is set in Render (not hardcoded)
- [x] `FRONTEND_URL` is set to exact frontend domain
- [ ] PostgreSQL password is strong (if using PostgreSQL)
- [ ] API usage limits are monitored
- [ ] HTTPS is enabled (Render does this automatically ✅)

---

## Cost Estimate

| Service | Plan | Cost |
|---------|------|------|
| Web Service | Free | $0/month (spins down after 15 min) |
| Web Service | Starter | $7/month (always-on) |
| PostgreSQL | Starter | $7/month (1GB storage) |
| **Total (Free Tier)** | | **$0/month** |
| **Total (Production)** | | **$14/month** |

---

## Next Steps

1. ✅ Deploy backend to Render
2. ✅ Deploy frontend to Vercel/Netlify
3. ✅ Update frontend `VITE_API_BASE_URL`
4. ✅ Test end-to-end resume upload
5. ⬜ Set up monitoring (Render logs)
6. ⬜ Configure custom domain (optional)
7. ⬜ Enable PostgreSQL for production

---

**Need detailed info?** See [DEPLOYMENT_REPORT.md](./DEPLOYMENT_REPORT.md)

**Questions?** Check Render logs first, then review troubleshooting section above.
