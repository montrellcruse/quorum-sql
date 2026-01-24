# Runbooks

## Service Health
- Health endpoints: `GET /health`, `GET /health/live`, `GET /health/ready`, `GET /health/db`
- Metrics endpoint: `GET /metrics` (when `ENABLE_METRICS=true`)
- Logs: Fastify/Pino stdout from server process

## Common Incidents
### Server not starting
1. Verify database connectivity (`DATABASE_URL` or `PGHOST/PGDATABASE/PGUSER`).
2. Check migrations ran: `node server/src/migrate.js --seed`.
3. Inspect server logs (CI uploads `server.log` on failure).

### Authentication failures
1. Confirm `SESSION_SECRET` is set and stable in the environment.
2. Check CORS settings (`CORS_ORIGIN`) for frontend origin.
3. Verify cookies are not blocked by browser settings.

### Database errors
1. Check Postgres service health (docker-compose or managed instance).
2. Validate `supabase/schema.sql` and latest migrations.
3. Inspect server logs for SQL errors and request IDs.

## Rollback (Manual)
- Redeploy previous release tag and point deployments to that version.
- Ensure the database schema is compatible with the rollback target.
