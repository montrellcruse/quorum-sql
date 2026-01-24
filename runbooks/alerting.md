# Alerting

## Purpose
Define how alerts are routed, triaged, and resolved so incidents are handled consistently.

## Alert Sources (recommended)
- Metrics/SLIs: `/metrics` (Prometheus scrape + alert rules)
- Error tracking: Sentry (frontend), server logs (Fastify/Pino)
- Uptime: synthetic checks hitting `/health` and `/health/ready`

## Severity Guide
- **SEV-1**: Full outage, data loss risk, or security incident
- **SEV-2**: Major feature degraded, elevated error rates
- **SEV-3**: Partial degradation or intermittent errors
- **SEV-4**: Minor issues, warnings, or non-critical alerts

## Routing & Ownership
- **Primary on-call**: <add team/alias>
- **Secondary**: <add team/alias>
- **Escalation**: <add process or paging tool>

## Initial Triage Checklist
1. Confirm scope: region/env/tenant affected.
2. Check recent deploys and flags.
3. Review logs and request IDs.
4. Verify database health and connection pool.
5. Capture timelines and impact.

## Remediation Playbook
- Roll back if regression is confirmed.
- Disable feature flags for suspected changes.
- Reduce load or enable rate limits if needed.

## Post-Incident
- Record incident summary and root cause.
- Create follow-up issues and owners.
- Update runbooks if gaps found.
