# Production Deployment Guide

## Prerequisites

- Docker & Docker Compose installed
- Domain with DNS configured
- HTTPS/SSL certificate (Let's Encrypt recommended)
- Google Gemini API key
- Minimum 2GB RAM, 20GB disk

## Quick Deploy with Docker Compose

### 1. Clone and Configure

```bash
git clone <repository-url>
cd smart-resume-analyzer

# Create environment file
cp .env.example .env
nano .env
```

### 2. Set Environment Variables

**CRITICAL SECURITY:**

```bash
# Generate a strong SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"

# Set in .env:
SECRET_KEY=<generated-value>
POSTGRES_PASSWORD=<strong-password>
GEMINI_API_KEY=<your-api-key>
APP_MODE=production
ENABLE_AUTH=true
ENABLE_USAGE_LIMITS=true
```

### 3. Launch Services

```bash
docker-compose up -d --build
```

Verify:
- Backend: http://localhost:8000/health
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/api/docs

### 4. Create Admin User

```bash
# Connect to backend container
docker exec -it talentai-backend bash

# Run Python interactively
python -c "
from backend.db.database import SessionLocal
from backend.models.user import User, Role
from backend.services.auth_service import get_password_hash
db = SessionLocal()

# Create Admin role
admin_role = Role(name='Admin', description='Full administrative permissions')
db.add(admin_role)
db.commit()
db.refresh(admin_role)

# Create admin user
admin = User(
    email='admin@example.com',
    hashed_password=get_password_hash('ChangeThisPassword123!'),
    role_id=admin_role.id,
    is_active=True
)
db.add(admin)
db.commit()
print('Admin user created: admin@example.com')
"
```

## Production Hardening

### Reverse Proxy (nginx)

Create `/etc/nginx/sites-available/resume-analyzer`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeout for file uploads
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:8000/health;
        access_log off;
    }

    # Upload size limit
    client_max_body_size 20M;
}
```

Enable and reload:
```bash
ln -s /etc/nginx/sites-available/resume-analyzer /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### SSL Certificate (Let's Encrypt)

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

### Firewall Configuration

```bash
# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Block direct access to backend/database from external
ufw deny 8000/tcp
ufw deny 5432/tcp

# Enable firewall
ufw enable
```

### Database Backups

```bash
# Create backup script: /usr/local/bin/backup-resume-db.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/resume-analyzer"
mkdir -p $BACKUP_DIR

docker exec talentai-db pg_dump -U postgres resume_ai | \
    gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Retain last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

# Add to crontab (daily at 2 AM):
# 0 2 * * * /usr/local/bin/backup-resume-db.sh
```

### Monitoring

```bash
# Check service health
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Check disk usage
df -h
docker system df

# Database connections
docker exec talentai-db psql -U postgres -d resume_ai -c \
    "SELECT count(*) FROM pg_stat_activity;"
```

## Scaling

### Horizontal Scaling (Multiple Backend Workers)

```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      replicas: 3
    # Add load balancer (nginx/HAProxy) in front
```

### Database Optimization

```sql
-- Add indexes for common queries (already in migrations)
CREATE INDEX idx_resumes_score ON resumes(total_score DESC);
CREATE INDEX idx_resumes_uploaded ON resumes(uploaded_at DESC);
CREATE INDEX idx_resumes_job ON resumes(job_applied);
```

### Redis for Rate Limiting

Replace in-memory rate limiter with Redis:

```python
# backend/core/security.py
from redis import Redis
from slowapi import Limiter
from slowapi.util import get_remote_address

redis = Redis(host='redis', port=6379)
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://redis:6379"
)
```

## Maintenance

### Update Application

```bash
cd smart-resume-analyzer
git pull origin main
docker-compose down
docker-compose up -d --build
```

### Database Migrations

```bash
# Check current version
docker exec talentai-backend alembic current

# Upgrade to latest
docker exec talentai-backend alembic upgrade head

# Rollback one version
docker exec talentai-backend alembic downgrade -1
```

### Clear Old Data

```sql
-- Delete resumes older than 1 year
DELETE FROM resumes WHERE uploaded_at < NOW() - INTERVAL '1 year';

-- Clear audit logs older than 90 days
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- Vacuum database
VACUUM ANALYZE;
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker logs talentai-backend

# Common issues:
# 1. DATABASE_URL incorrect
# 2. SECRET_KEY not set
# 3. PostgreSQL not ready (increase health check retries)
```

### Frontend can't reach backend
```bash
# Verify VITE_API_BASE_URL in .env
# Rebuild frontend after changing:
docker-compose up -d --build frontend
```

### Database connection errors
```bash
# Check PostgreSQL is running
docker exec talentai-db pg_isready -U postgres

# Check connection string
docker exec talentai-backend env | grep DATABASE_URL
```

### Out of disk space
```bash
# Clean Docker images
docker system prune -a

# Check database size
docker exec talentai-db psql -U postgres -d resume_ai -c \
    "SELECT pg_size_pretty(pg_database_size('resume_ai'));"

# Check uploads directory
du -sh uploads/
```

## Security Checklist

- [ ] SECRET_KEY is strong and unique
- [ ] POSTGRES_PASSWORD is strong
- [ ] All default passwords changed
- [ ] HTTPS enabled with valid certificate
- [ ] Firewall configured (ports 80/443 only)
- [ ] Database not exposed to internet
- [ ] ENABLE_AUTH=true in production
- [ ] ENABLE_USAGE_LIMITS=true
- [ ] Regular backups configured
- [ ] Security headers enabled (via nginx or middleware)
- [ ] File upload limits enforced
- [ ] CORS configured for specific domains only
- [ ] Logs monitored for suspicious activity

## Performance Optimization

- [ ] Database indexes applied (see migrations)
- [ ] Frontend bundle optimized (code splitting)
- [ ] Static assets cached (nginx)
- [ ] Gzip compression enabled (nginx)
- [ ] Connection pooling configured (SQLAlchemy)
- [ ] Rate limiting active
- [ ] CDN for static assets (optional)

## Support & Maintenance

- Monitor logs: `docker-compose logs -f`
- Health check: `curl https://yourdomain.com/health`
- Database backup: Daily at 2 AM (cron)
- Update cadence: Monthly security patches
- Gemini API quota: Monitor usage in Google Cloud Console
