# Sentry → GitHub Issue Automation

## Purpose
Automatically convert high-signal Sentry errors into GitHub issues.

## Prerequisites
- Sentry project configured for the frontend (see `src/lib/telemetry.ts`).
- GitHub repo access with permissions to create issues.

## Setup (Sentry UI)
1. Go to **Sentry → Project Settings → Integrations**.
2. Enable the **GitHub** integration and connect the repo.
3. Create an **Alert Rule**:
   - Trigger: new issue or regression.
   - Conditions: environment = production, minimum events, and/or error type.
   - Action: **Create GitHub Issue**.

## Issue Metadata (Recommended)
- **Labels**: `sentry`, `bug`, `needs-triage`
- **Assignee**: on-call or team lead
- **Template**: include stack trace, environment, release, and links

## Operating Notes
- Keep alert volume low by tuning thresholds.
- Use releases and environments to avoid dev/test noise.
- Review and close false positives quickly.

## Troubleshooting
- No issues created: check integration permissions and alert rule status.
- Too many issues: tighten conditions or add rate limits.
- Missing context: verify Sentry source maps and release tagging.
