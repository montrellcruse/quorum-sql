# Privacy & Consent Guidance

## Purpose
This document outlines privacy, consent, and data handling expectations for deployments of Quorum SQL.

## Data Collected
- User identity: email, name, user ID
- Team membership and roles
- SQL query content and change history
- Audit metadata (timestamps, modifier emails)

## Consent & Notice
Deployments should provide:
- A privacy notice describing data usage and retention
- Consent or legal basis per your jurisdiction (GDPR/CCPA)
- Links to support and data access requests

## Data Retention
Recommended practices:
- Define a retention period for query history and audit records
- Implement deletion/export workflows for user data requests
- Document backups and recovery timelines

## Access & Deletion Requests
Provide a documented process for:
- User data export
- Account deletion
- Team deletion or transfer

## Analytics & Error Tracking
If enabling PostHog or Sentry:
- Disclose usage in your privacy policy
- Avoid sending PII in event metadata
- Configure sampling and data retention per policy

## Compliance Checklist
- [ ] Privacy policy published
- [ ] Consent mechanism implemented (if required)
- [ ] Data retention policy documented
- [ ] Data export/deletion process documented
- [ ] Vendor DPAs signed (if required)
