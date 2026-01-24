# Runbooks

## Index
- [Rollback Automation](rollback-automation.md)
- [Alerting & On-Call](alerting.md)
- [Sentry → GitHub Issues](sentry-github.md)

## Service Health
- Health endpoints: `GET /health`, `GET /health/live`, `GET /health/ready`, `GET /health/db`
- Metrics endpoint: `GET /metrics` (when `ENABLE_METRICS=true`)
- Logs: Fastify/Pino stdout from server process

## Alerting & Issue Intake
- Frontend error tracking: Sentry (when `VITE_SENTRY_DSN` is set).
- Error-to-issue automation: see [sentry-github.md](sentry-github.md).

## Common Incidents
### Server not starting
1. Verify database connectivity (`DATABASE_URL` or `PGHOST/PGDATABASE/PGUSER`).
2. Check migrations ran: `npm --prefix server run migrate:seed` (builds required for dist) or `npm --prefix server run migrate:dev`.
3. Inspect server logs (CI uploads `server.log` on failure).

### Authentication failures
1. Confirm `SESSION_SECRET` is set and stable in the environment.
2. Check CORS settings (`CORS_ORIGIN`) for frontend origin.
3. Verify cookies are not blocked by browser settings.

### Database errors
1. Check Postgres service health (docker-compose or managed instance).
2. Validate `supabase/schema.sql` and latest migrations.
3. Inspect server logs for SQL errors and request IDs.

## Rollback (Automated)
See [rollback-automation.md](rollback-automation.md) for the automated workflow, prerequisites, and safety checks.

## Rollback (Manual)
- Redeploy previous release tag and point deployments to that version.
- Ensure the database schema is compatible with the rollback target.
- If migrations are not reversible, use feature flags to disable affected functionality.
