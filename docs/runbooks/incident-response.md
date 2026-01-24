# Incident Response Runbook

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P1 | Service down | 15 min | API unreachable, data loss |
| P2 | Major degradation | 1 hour | Auth failing, slow queries |
| P3 | Minor issue | 4 hours | UI glitch, non-critical bug |
| P4 | Low priority | 24 hours | Cosmetic issues |

## Initial Response

### 1. Acknowledge
```bash
# Check service status
curl -s http://localhost:8787/health | jq

# Check all health endpoints
for ep in health health/live health/ready health/db; do
  echo "=== /$ep ==="
  curl -s "http://localhost:8787/$ep" | jq
done
```

### 2. Gather Information
```bash
# Recent logs
docker-compose logs --tail=100 server

# Check for errors
docker-compose logs server 2>&1 | grep -i error | tail -20

# Database connectivity
docker exec continuous-claude-postgres pg_isready
```

### 3. Communicate
- Update status page (if applicable)
- Notify stakeholders in #incidents channel
- Set expected resolution time

## Common Issues

### API Returns 503
1. Check database connectivity: `curl http://localhost:8787/health/db`
2. Verify PostgreSQL is running: `docker-compose ps`
3. Check connection pool: Review server logs for pool exhaustion

### Authentication Failures
1. Verify SESSION_SECRET is set
2. Check cookie configuration
3. Review auth logs: `docker-compose logs server | grep AUTH`

### High Latency
1. Check query performance: Review N+1 warnings in logs
2. Database load: `docker exec continuous-claude-postgres psql -U claude -c "SELECT * FROM pg_stat_activity;"`
3. Connection pool status

## Post-Incident

### Immediate
- [ ] Confirm service restored
- [ ] Communicate resolution
- [ ] Monitor for recurrence

### Within 24 Hours
- [ ] Write incident summary
- [ ] Identify root cause
- [ ] Create follow-up tickets

### Within 1 Week
- [ ] Conduct post-mortem (P1/P2 only)
- [ ] Implement preventive measures
- [ ] Update runbooks if needed
