# Rollback Automation

## Goal
Provide a repeatable path to roll back quickly when regressions are detected.

## Prerequisites
- Release tags are available (GitHub Releases or container tags).
- Database migrations are backward compatible or have a rollback plan.
- Rollback permissions are granted to on-call.

## Preferred Rollback (One-Click)
Use your deploy platform's rollback feature (e.g., “Redeploy previous release/tag”).

### Required Inputs
- Target release tag or image digest.
- Environment (staging/production).
- Confirmation of DB compatibility.

## Manual Rollback (Fallback)
1. Identify last known good release tag.
2. Redeploy that tag/image.
3. Verify `/health` and `/health/ready`.
4. Spot-check critical flows (login, dashboard load, query submit).

## Database Considerations
- Avoid destructive migrations without a reversible plan.
- If rollback requires schema changes, apply the documented downgrade migration.
- Validate data integrity after rollback.

## Validation Checklist
- Error rates back to baseline
- Key metrics stabilized
- Smoke tests passing

## Follow-up
- Document root cause.
- Add regression test or guardrail.
- Update flags/config to prevent recurrence.
