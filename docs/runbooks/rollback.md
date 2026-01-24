# Rollback Runbook

## Quick Rollback (< 5 min)

### 1. Identify the Problem
```bash
# Check current deployment
git log --oneline -5

# Check application health
curl -s http://localhost:8787/health/ready | jq
```

### 2. Revert to Previous Version

#### Option A: Git Revert (Preferred)
```bash
# Revert the problematic commit
git revert HEAD --no-edit
git push origin main
```

#### Option B: Deploy Previous Tag
```bash
# List recent tags
git tag --sort=-creatordate | head -5

# Checkout and deploy previous version
git checkout v1.4.0
```

#### Option C: Docker Rollback
```bash
# Stop current containers
docker-compose down

# Pull previous image
docker pull ghcr.io/montrellcruse/quorum-sql:previous

# Restart with previous version
docker-compose up -d
```

### 3. Verify Rollback
```bash
# Check health endpoints
curl http://localhost:8787/health
curl http://localhost:8787/health/ready
curl http://localhost:8787/health/db

# Check logs for errors
docker-compose logs --tail=50 server
```

### 4. Post-Rollback
- [ ] Notify team of rollback
- [ ] Create incident ticket
- [ ] Document root cause
- [ ] Plan fix for reverted changes

## Database Rollback

### Revert Migration
```bash
# Connect to database
docker exec -it continuous-claude-postgres psql -U claude -d continuous_claude

# Check migration history
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;

# Revert last migration (if reversible)
-- Run the down migration manually
```

### Point-in-Time Recovery
For critical data issues, contact database administrator for PITR from backup.

## Contacts

- **On-call**: Check PagerDuty rotation
- **Database**: @montrellcruse
- **Infrastructure**: @montrellcruse
