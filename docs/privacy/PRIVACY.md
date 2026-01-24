# Privacy & Data Protection

This document outlines Quorum SQL's approach to privacy and data protection.

## Data Collection

### What We Collect

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Email address | Authentication, notifications | Account lifetime |
| Full name | Display in UI | Account lifetime |
| Password hash | Authentication | Account lifetime |
| SQL queries | Core functionality | Until deleted by user |
| Team membership | Access control | Until removed |
| Approval history | Audit trail | 7 years |

### What We Don't Collect

- Payment information (handled by third-party if applicable)
- Location data
- Device fingerprints
- Browsing history outside the application

## Data Processing

### Legal Basis (GDPR)

- **Contractual necessity**: Account data, query storage
- **Legitimate interest**: Security logs, abuse prevention
- **Consent**: Analytics (PostHog), error tracking (Sentry)

### Data Processors

| Processor | Purpose | Data Shared |
|-----------|---------|-------------|
| Supabase | Database hosting | All application data |
| Sentry | Error tracking | Error context, user ID |
| PostHog | Analytics | Anonymized usage events |

## User Rights

### GDPR Rights

Users can exercise these rights by contacting the data controller:

1. **Right to Access**: Request a copy of your data
2. **Right to Rectification**: Correct inaccurate data
3. **Right to Erasure**: Delete your account and data
4. **Right to Portability**: Export your data in JSON format
5. **Right to Object**: Opt out of analytics

### How to Exercise Rights

```
Email: privacy@[your-domain]
Subject: GDPR [Right Name] Request
Include: Your email address, specific request
```

### Data Export

Users can export their data via:
- Dashboard → Settings → Export Data
- API: `GET /api/user/export`

### Account Deletion

Users can delete their account via:
- Dashboard → Settings → Delete Account
- This triggers cascade deletion of:
  - User profile
  - Personal workspace queries
  - Team memberships (data remains with team)

## Data Security

### Encryption

- **At rest**: AES-256 (database level)
- **In transit**: TLS 1.3 (HTTPS only)
- **Passwords**: bcrypt with cost factor 12

### Access Controls

- Role-based access (admin, member)
- Session tokens with 7-day expiry
- Rate limiting on authentication endpoints

### Audit Logging

All data access is logged:
- User authentication events
- Query modifications
- Team membership changes
- Admin actions

Logs retained for 90 days.

## Cookies

### Essential Cookies

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `session` | Authentication | 7 days |
| `csrf_token` | CSRF protection | Session |

### Optional Cookies

| Cookie | Purpose | Consent Required |
|--------|---------|------------------|
| `ph_*` | PostHog analytics | Yes |

## Consent Management

### Analytics Consent

Analytics (PostHog) is opt-in:

```typescript
// Only initialize if user consented
if (localStorage.getItem('analytics_consent') === 'true') {
  posthog.init(POSTHOG_KEY);
}
```

### Cookie Banner

For new users, display consent banner:

```tsx
<CookieBanner
  onAccept={() => {
    localStorage.setItem('analytics_consent', 'true');
    posthog.init(POSTHOG_KEY);
  }}
  onDecline={() => {
    localStorage.setItem('analytics_consent', 'false');
  }}
/>
```

## Data Breach Response

### Notification Timeline

- **Detection**: Automated monitoring + manual review
- **Assessment**: Within 24 hours
- **Authority notification**: Within 72 hours (GDPR requirement)
- **User notification**: Without undue delay if high risk

### Incident Response

1. Contain the breach
2. Assess scope and impact
3. Notify affected parties
4. Document and remediate
5. Post-incident review

## Children's Privacy

Quorum SQL is not intended for users under 16. We do not knowingly collect data from children.

## International Transfers

Data may be processed in:
- United States (Supabase, Sentry)
- European Union (user's choice of region)

Transfers are protected by Standard Contractual Clauses.

## Updates to This Policy

- Material changes: 30-day notice via email
- Minor changes: Updated on this page
- Version history maintained in git

## Contact

Data Protection Officer: privacy@[your-domain]
